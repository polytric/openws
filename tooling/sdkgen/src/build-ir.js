const S = require('@pocketgems/schema')

const validateIr = S.obj({
    package: S.obj({
        project: S.str,
        service: S.str,
        description: S.str.optional(),
        version: S.str.optional(),
    }),
    networks: S.arr(S.obj({
        name: S.str,
        description: S.str.optional(),
        version: S.str.optional(),
        handlers: S.arr(S.obj({
            participantName: S.str,
            handlerName: S.str,
            description: S.str.optional(),
        })),
        messages: S.arr(S.obj({
            participantName: S.str,
            handlerName: S.str,
            description: S.str.optional(),
        })),
        endpoints: S.arr(S.obj({
            participantName: S.str,
            endpoints: S.arr(S.obj({
                host: S.str,
                port: S.int.min(0).max(65535),
                path: S.str,
            })),
        })),
        models: S.arr(S.obj({
            scopeName: S.str,
            modelName: S.str,
            type: S.str,
            description: S.str.optional(),
            properties: S.arr(S.obj({
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
            })).optional(),
        })),    
    })).desc('An array of network definitions'),
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
    const { hostRole } = request
    
    const irPackage = {
        project: request.project,
        service: request.service,
        description: spec.info.description,
        version: spec.info.version,
    }
    const irNetworks = []
    const ir = {
        package: irPackage,
        networks: irNetworks,
    }

    for (const [networkName, networkSpec] of Object.entries(spec.networks)) {
        const hostParticipantSpec = networkSpec.participants[hostRole]
        const otherParticipantSpecs = {}
        for (const [participantName, participantSpec] of Object.entries(networkSpec.participants)) {
            if (participantName !== hostRole) {
                otherParticipantSpecs[participantName] = participantSpec
            }
        }
    
        const irHandlers = []
        const irMessages = []
        const irEndpoints = []
        const irModels = []
        for (const [handlerName, handlerSpec] of Object.entries(hostParticipantSpec.handlers)) {
            irHandlers.push({
                participantName: hostRole,
                handlerName,
                description: handlerSpec.description,
            })
            irModels.push(...buildIrModels(hostRole, handlerName, handlerSpec.payload))
        }
    
        for (const [participantName, participantSpec] of Object.entries(otherParticipantSpecs)) {
            if (participantSpec.endpoints) {
                irEndpoints.push({
                    participantName,
                    endpoints: participantSpec.endpoints,
                })
            }
            for (const [handlerName, handlerSpec] of Object.entries(participantSpec.handlers)) {
                irMessages.push({
                    participantName,
                    handlerName,
                    description: handlerSpec.description,
                })
                irModels.push(...buildIrModels(participantName, handlerName, handlerSpec.payload))
            }
        }
    
        const irNetwork = {
            name: networkName,
            description: networkSpec.description,
            version: networkSpec.version,
            handlers: irHandlers,
            messages: irMessages,
            endpoints: irEndpoints,
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