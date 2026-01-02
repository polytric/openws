const S = require('@pocketgems/schema')

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

function buildIrModels(scopeName, modelName, schema) {
    const type = schema.type
    const model = {
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
            return buildIrModels(scopeName, modelName, schema.items)
        }
        case 'object': {
            const properties = []
            model.properties = properties
            const models = []
            for (const [subName, subSchema] of Object.entries(schema.properties)) {
                const subModels = buildIrModels(scopeName, subName, subSchema)
                const mainModel = subModels.find(m => m.modelName === subName) ?? subSchema
                const property = {
                    type: mainModel.type,
                    description: mainModel.description,
                    scopeName: mainModel.scopeName ?? scopeName,
                    modelName: mainModel.modelName ?? subName,
                    required: schema.required?.includes(subName),
                }

                if (mainModel.items) {
                    property.items = {
                        type: mainModel.items.type,
                        description: mainModel.items.description,
                        scopeName: mainModel.items.scopeName ?? scopeName,
                        modelName: mainModel.items.modelName ?? subName,
                    }
                }
                properties.push(property)
                models.push(...subModels)
            }
            return [model, ...models]
        }
    }
}

module.exports = function buildIr(ctx) {
    const { request, spec } = ctx
    const { hostRoles } = request

    const irPackage = {
        project: request.project,
        service: spec.name,
        description: spec.description,
        version: spec.version,
    }
    const irNetworks = []
    const ir = {
        package: irPackage,
        networks: irNetworks,
    }

    for (const [networkName, networkSpec] of Object.entries(spec.networks)) {
        const hostRoleSpecs = hostRoles.map(hostRole => networkSpec.roles[hostRole])
        const otherRoleSpecs = {}
        for (const [roleName, roleSpec] of Object.entries(networkSpec.roles)) {
            if (!hostRoles.includes(roleName)) {
                otherRoleSpecs[roleName] = roleSpec
            }
        }

        const requiredRoles = new Set()
        for (const hostRoleSpec of hostRoleSpecs) {
            for (const handlerSpec of Object.values(hostRoleSpec.messages)) {
                if (handlerSpec.from) {
                    for (const fromRoleName of handlerSpec.from) {
                        requiredRoles.add(fromRoleName)
                    }
                } else {
                    requiredRoles.add(...Object.keys(otherRoleSpecs))
                    break
                }
            }
        }

        const irRoles = []
        const irHandlers = []
        const irMessages = []
        const irModels = []

        // Add host roles
        for (const hostRoleSpec of hostRoleSpecs) {
            irRoles.push({
                name: hostRoleSpec.name,
                description: hostRoleSpec.description,
                isHost: true,
                endpoints: hostRoleSpec.endpoints || [],
            })
            for (const [handlerName, handlerSpec] of Object.entries(hostRoleSpec.messages)) {
                irHandlers.push({
                    roleName: hostRoleSpec.name,
                    handlerName,
                    description: handlerSpec.description,
                })
                irModels.push(...buildIrModels(hostRoleSpec.name, handlerName, handlerSpec.payload))
            }
        }

        // Add remote roles
        for (const [roleName, roleSpec] of Object.entries(otherRoleSpecs)) {
            if (!requiredRoles.has(roleName)) {
                continue
            }
            irRoles.push({
                name: roleName,
                description: roleSpec.description,
                isHost: false,
                endpoints: roleSpec.endpoints || [],
            })
            for (const [handlerName, handlerSpec] of Object.entries(roleSpec.messages)) {
                irMessages.push({
                    roleName,
                    handlerName,
                    description: handlerSpec.description,
                })
                irModels.push(...buildIrModels(roleName, handlerName, handlerSpec.payload))
            }
        }

        const irNetwork = {
            name: networkName,
            description: networkSpec.description,
            version: networkSpec.version,
            roles: irRoles,
            handlers: irHandlers,
            messages: irMessages,
            models: irModels,
        }
        irNetworks.push(irNetwork)
    }

    validateIr(ir)
    return {
        ...ctx,
        ir,
    }
}
