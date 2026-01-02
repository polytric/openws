const path = require('node:path')

function pascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function camelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1)
}

function createPlan(ctx) {
    const { ir, request } = ctx
    const assemblyName = `${pascalCase(ir.package.project)}.${pascalCase(ir.package.service)}.Sdk`
    ir.assemblyName = assemblyName

    const plan = [
        {
            name: 'assembly definition',
            command: 'render',
            getData: () => ctx.ir,
            template: path.join(__dirname, 'template', 'Service.asmdef.ejs'),
            output: path.join(ctx.request.outputPath, assemblyName, `${assemblyName}.asmdef`),
        },
        {
            name: 'user assembly reference',
            command: 'render',
            getData: () => ctx.ir,
            template: path.join(__dirname, 'template', 'UserService.asmref.ejs'),
            output: path.join(
                ctx.request.outputPath,
                `${assemblyName}.User`,
                `${assemblyName}.User.asmref`
            ),
        },
    ]

    for (const networkIr of ir.networks) {
        const networkNamespace = `${pascalCase(ir.package.project)}.${pascalCase(ir.package.service)}.${pascalCase(networkIr.name)}`
        const networkClassName = `${pascalCase(networkIr.name)}Network`
        const networkOutputPath = path.join(
            ctx.request.outputPath,
            assemblyName,
            pascalCase(networkIr.name)
        )
        const userNetworkOutputPath = path.join(
            ctx.request.outputPath,
            `${assemblyName}.User`,
            pascalCase(networkIr.name)
        )

        // Build role info from IR
        const hostRoles = []
        const remoteRoles = []

        for (const role of networkIr.roles) {
            const roleInfo = {
                roleName: role.name,
                className: pascalCase(role.name),
                varName: camelCase(role.name),
                description: role.description || '',
                baseClassName: role.isHost ? 'HostRole' : 'RemoteRole',
                endpoints: role.endpoints || [],
            }
            if (role.isHost) {
                hostRoles.push(roleInfo)
            } else {
                remoteRoles.push(roleInfo)
            }
        }

        const allRoles = [...hostRoles, ...remoteRoles]

        // Build all model imports for user templates
        const allModelImports = allRoles.map(role => `${networkNamespace}.Models.${role.className}`)

        // Generate Network.cs
        plan.push({
            name: `network ${networkIr.name}`,
            command: 'render',
            getData: () => ({
                namespace: networkNamespace,
                networkClassName,
                networkName: networkIr.name,
                description: networkIr.description,
                version: networkIr.version,
                allRoles,
            }),
            template: path.join(__dirname, 'template', 'Network.cs.ejs'),
            output: path.join(networkOutputPath, `${networkClassName}.cs`),
        })

        // Process models
        for (const modelIr of networkIr.models) {
            modelIr.namespace = `${networkNamespace}.Models.${pascalCase(modelIr.scopeName)}`
            modelIr.className = pascalCase(modelIr.modelName)
            if (modelIr.properties) {
                for (const propertyIr of modelIr.properties) {
                    propertyIr.propertyName = pascalCase(propertyIr.modelName)
                    propertyIr.typeName = mapType(propertyIr)
                }
            }
        }

        // Process handlers (incoming messages for host roles)
        for (const handlerIr of networkIr.handlers) {
            handlerIr.modelClassName = pascalCase(handlerIr.handlerName)
            handlerIr.messageName = handlerIr.handlerName
            handlerIr.methodName = pascalCase(handlerIr.handlerName)
        }

        // Process messages (outgoing messages to remote roles)
        for (const messageIr of networkIr.messages) {
            messageIr.modelClassName = pascalCase(messageIr.handlerName)
            messageIr.messageName = messageIr.handlerName
            messageIr.methodName = pascalCase(messageIr.handlerName)
        }

        // Generate HostRole classes
        for (const hostRole of hostRoles) {
            const roleHandlers = networkIr.handlers.filter(h => h.roleName === hostRole.roleName)
            const modelImports = [`${networkNamespace}.Models.${hostRole.className}`]

            plan.push({
                name: `host role ${hostRole.className}`,
                command: 'render',
                getData: () => ({
                    namespace: `${networkNamespace}.Roles`,
                    handlers: roleHandlers,
                    remoteRoles,
                    modelImports,
                    ...hostRole,
                }),
                template: path.join(__dirname, 'template', 'HostRole.cs.ejs'),
                output: path.join(networkOutputPath, 'Roles', `${hostRole.className}.cs`),
            })

            // Generate User stub for HostRole
            plan.push({
                name: `user host role ${hostRole.className}`,
                command: 'render',
                getData: () => ({
                    namespace: `${networkNamespace}.Roles`,
                    handlers: roleHandlers,
                    remoteRoles,
                    modelImports: allModelImports,
                    ...hostRole,
                }),
                template: path.join(__dirname, 'template', 'UserHostRole.cs.ejs'),
                output: path.join(userNetworkOutputPath, 'Roles', `${hostRole.className}.cs`),
            })
        }

        // Generate RemoteRole classes
        for (const remoteRole of remoteRoles) {
            const roleMessages = networkIr.messages.filter(m => m.roleName === remoteRole.roleName)
            const modelImports = [`${networkNamespace}.Models.${remoteRole.className}`]

            plan.push({
                name: `remote role ${remoteRole.className}`,
                command: 'render',
                getData: () => ({
                    namespace: `${networkNamespace}.Roles`,
                    messages: roleMessages,
                    modelImports,
                    ...remoteRole,
                }),
                template: path.join(__dirname, 'template', 'RemoteRole.cs.ejs'),
                output: path.join(networkOutputPath, 'Roles', `${remoteRole.className}.cs`),
            })
        }

        // Generate Models
        for (const modelIr of networkIr.models) {
            if (modelIr.type !== 'object') continue
            plan.push({
                name: `model ${modelIr.className}`,
                command: 'render',
                getData: () => modelIr,
                template: path.join(__dirname, 'template', 'Model.cs.ejs'),
                output: path.join(
                    networkOutputPath,
                    'Models',
                    pascalCase(modelIr.scopeName),
                    `${modelIr.className}.cs`
                ),
            })
        }
    }

    return {
        ...ctx,
        plan,
    }
}

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
            return pascalCase(property.modelName)
        default:
            return 'object'
    }
}

module.exports = createPlan
