import S from '@pocketgems/schema'

import type { IR, IRModel, IRProperty, JsonSchema, PipelineContext } from './types.js'

const validateIr = S.obj({
    package: S.obj({
        project: S.str,
        service: S.str,
        description: S.str.optional(),
        version: S.str.optional(),
    }),
    networks: S.arr(
        S.obj({
            name: S.str,
            description: S.str.optional(),
            version: S.str.optional(),
            roles: S.arr(
                S.obj({
                    name: S.str,
                    description: S.str.optional(),
                    isHost: S.bool,
                    endpoints: S.arr(
                        S.obj({
                            scheme: S.str.enum('ws', 'wss'),
                            host: S.str,
                            port: S.int.min(0).max(65535),
                            path: S.str,
                        })
                    ),
                })
            ),
            handlers: S.arr(
                S.obj({
                    roleName: S.str,
                    handlerName: S.str,
                    description: S.str.optional(),
                })
            ),
            messages: S.arr(
                S.obj({
                    roleName: S.str,
                    handlerName: S.str,
                    description: S.str.optional(),
                })
            ),
            models: S.arr(
                S.obj({
                    scopeName: S.str,
                    modelName: S.str,
                    type: S.str,
                    description: S.str.optional(),
                    properties: S.arr(
                        S.obj({
                            type: S.str,
                            scopeName: S.str,
                            modelName: S.str,
                            description: S.str.optional(),
                            required: S.bool.optional(),
                            items: S.obj({
                                type: S.str,
                                scopeName: S.str,
                                modelName: S.str,
                                description: S.str.optional(),
                            }).optional(),
                        })
                    ).optional(),
                })
            ),
        })
    ).desc('An array of network definitions'),
}).compile('IrValidator')

function buildIrModels(scopeName: string, modelName: string, schema: JsonSchema): IRModel[] {
    const type = schema.type
    const model: IRModel = {
        type,
        scopeName,
        modelName,
        description: schema.description,
    }

    switch (type) {
        case 'string':
        case 'number':
        case 'integer':
        case 'boolean':
        case 'null':
            return []
        case 'array': {
            if (!schema.items) return []
            return buildIrModels(scopeName, modelName, schema.items)
        }
        case 'object': {
            const properties: IRProperty[] = []
            model.properties = properties
            const models: IRModel[] = []

            if (!schema.properties) return [model]

            for (const [subName, subSchema] of Object.entries(schema.properties) as [
                string,
                JsonSchema,
            ][]) {
                const subModels = buildIrModels(scopeName, subName, subSchema)
                const mainModel: IRModel | JsonSchema =
                    subModels.find(m => m.modelName === subName) ?? subSchema

                const property: IRProperty = {
                    type: mainModel.type,
                    description: mainModel.description,
                    scopeName: (mainModel as IRModel).scopeName ?? scopeName,
                    modelName: (mainModel as IRModel).modelName ?? subName,
                    required: schema.required?.includes(subName),
                }

                const itemsSource =
                    (mainModel as IRModel).properties?.[0]?.items ?? (mainModel as JsonSchema).items
                if (itemsSource) {
                    property.items = {
                        type: itemsSource.type,
                        description: itemsSource.description,
                        scopeName: (itemsSource as IRProperty['items'])?.scopeName ?? scopeName,
                        modelName: (itemsSource as IRProperty['items'])?.modelName ?? subName,
                    }
                }

                properties.push(property)
                models.push(...subModels)
            }
            return [model, ...models]
        }
        default:
            return []
    }
}

export default function buildIr(ctx: PipelineContext): PipelineContext {
    const { request, spec } = ctx
    if (!request) throw new Error('request is required')
    if (!spec) throw new Error('spec is required')

    const { hostRoles } = request

    const ir: IR = {
        package: {
            project: request.project,
            service: spec.name,
            description: spec.description,
            version: spec.version,
        },
        networks: [],
    }

    for (const [networkName, networkSpec] of Object.entries(spec.networks)) {
        const hostRoleSpecs = hostRoles.map(hostRole => networkSpec.roles[hostRole])
        const otherRoleSpecs: Record<string, (typeof networkSpec.roles)[string]> = {}

        for (const [roleName, roleSpec] of Object.entries(networkSpec.roles)) {
            if (!hostRoles.includes(roleName)) {
                otherRoleSpecs[roleName] = roleSpec
            }
        }

        const requiredRoles = new Set<string>()
        for (const hostRoleSpec of hostRoleSpecs) {
            for (const handlerSpec of Object.values(hostRoleSpec.messages)) {
                if (handlerSpec.from) {
                    for (const fromRoleName of handlerSpec.from) {
                        requiredRoles.add(fromRoleName)
                    }
                } else {
                    for (const key of Object.keys(otherRoleSpecs)) {
                        requiredRoles.add(key)
                    }
                    break
                }
            }
        }

        const irNetwork = {
            name: networkName,
            description: networkSpec.description,
            version: networkSpec.version,
            roles: [] as IR['networks'][0]['roles'],
            handlers: [] as IR['networks'][0]['handlers'],
            messages: [] as IR['networks'][0]['messages'],
            models: [] as IR['networks'][0]['models'],
        }

        // Add host roles
        for (const hostRoleSpec of hostRoleSpecs) {
            irNetwork.roles.push({
                name: hostRoleSpec.name,
                description: hostRoleSpec.description,
                isHost: true,
                endpoints: hostRoleSpec.endpoints || [],
            })

            for (const [handlerName, handlerSpec] of Object.entries(hostRoleSpec.messages)) {
                irNetwork.handlers.push({
                    roleName: hostRoleSpec.name,
                    handlerName,
                    description: handlerSpec.description,
                })
                irNetwork.models.push(
                    ...buildIrModels(
                        hostRoleSpec.name,
                        handlerName + 'Payload',
                        handlerSpec.payload
                    )
                )
            }
        }

        // Add remote roles
        for (const [roleName, roleSpec] of Object.entries(otherRoleSpecs)) {
            if (!requiredRoles.has(roleName)) continue

            irNetwork.roles.push({
                name: roleName,
                description: roleSpec.description,
                isHost: false,
                endpoints: roleSpec.endpoints || [],
            })

            for (const [handlerName, handlerSpec] of Object.entries(roleSpec.messages)) {
                irNetwork.messages.push({
                    roleName,
                    handlerName,
                    description: handlerSpec.description,
                })
                irNetwork.models.push(
                    ...buildIrModels(roleName, handlerName + 'Payload', handlerSpec.payload)
                )
            }
        }

        ir.networks.push(irNetwork)
    }

    validateIr(ir)

    return {
        ...ctx,
        ir,
    }
}
