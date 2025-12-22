const path = require('node:path')

function pascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function createPlan(ctx) {
    const { ir } = ctx
    const assemblyName = `${pascalCase(ctx.ir.package.project)}.OpenWsSdk.${pascalCase(ctx.ir.package.service)}` 
    ir.assemblyName = assemblyName

    for (const networkIr of ir.networks) {
        networkIr.namespace = `${assemblyName}.${pascalCase(networkIr.name)}`
        for (const modelIr of networkIr.models) {
            modelIr.namespace = `${networkIr.namespace}.Models`
            modelIr.className = `${pascalCase(modelIr.scopeName)}${pascalCase(modelIr.modelName)}`
            if (modelIr.properties) {
                for (const propertyIr of modelIr.properties) {
                    propertyIr.propertyName = pascalCase(propertyIr.modelName)
                    function mapType(property) {
                        switch (property.type) {
                            case 'string':
                                return 'string'
                            case 'number':
                                return 'double'
                            case 'integer':
                                return 'int'
                            case 'boolean':
                                return 'bool'
                            case 'array':
                                return `List<${mapType(property.items)}>`
                            case 'object':
                                return `${pascalCase(property.scopeName)}${pascalCase(property.modelName)}`
                        }
                    }
                    propertyIr.typeName = mapType(propertyIr)
                }
            }
        }
        for (const handlerIr of networkIr.handlers) {
            handlerIr.modelClassName = `${pascalCase(handlerIr.participantName)}${pascalCase(handlerIr.handlerName)}`
        }
        for (const messageIr of networkIr.messages) {
            messageIr.modelClassName = `${pascalCase(messageIr.participantName)}${pascalCase(messageIr.handlerName)}`
        }
        for (const endpointIr of networkIr.endpoints) {
            endpointIr.propertyName = `${pascalCase(endpointIr.participantName)}`
        }
    }

    const plan = [
        {
            name: "assembly definition",
            command: 'render',
            getData: () => ctx,
            template: path.join(__dirname, "template", "Service.asmdef.ejs"),
            output: path.join(ctx.request.outputPath, assemblyName, `${assemblyName}.asmdef`),
        },
    ]
    for (const networkIr of ctx.ir.networks) {
        const networkOutputPath = path.join(ctx.request.outputPath, assemblyName, "Generated", pascalCase(networkIr.name))
        plan.push({
            name: `network ${networkIr.name}`,
            command: 'render',
            getData: () => networkIr,
            template: path.join(__dirname, "template", "Network.cs.ejs"),
            output: path.join(networkOutputPath, `Network.cs`),
        }, {
            name: `endpoints ${networkIr.name}`,
            command: 'render',
            getData: () => networkIr,
            template: path.join(__dirname, "template", "Endpoints.cs.ejs"),
            output: path.join(networkOutputPath, `Endpoints.cs`),
        })

        for (const modelIr of networkIr.models) {
            plan.push({
                name: `model ${modelIr.className}`,
                command: 'render',
                getData: () => modelIr,
                template: path.join(__dirname, "template", "Model.cs.ejs"),
                output: path.join(networkOutputPath, "Models", `${modelIr.className}.cs`),
            })
        }
    }

    return {
        ...ctx,
        plan,
    }
}

module.exports = createPlan