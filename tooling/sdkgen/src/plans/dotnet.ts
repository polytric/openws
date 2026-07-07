import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { BuildRequest, IR, IRProperty, PipelineContext, PlanStep } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// From src/plans/ -> ../templates/dotnet
// From dist/plans/ -> ../templates/dotnet (same relative path!)
const TEMPLATE_DIR = path.join(__dirname, '../templates/dotnet')
const UNITY_META_GUID_PREFIX = 'openws-sdkgen/unity-meta/'
const UNITY_NEWTONSOFT_JSON_PACKAGE = 'com.unity.nuget.newtonsoft-json'
const UNITY_NEWTONSOFT_JSON_VERSION = '3.2.2'

type UnityMetaTemplate =
    | 'UnityAssemblyDefinition.meta.ejs'
    | 'UnityAssemblyDefinitionReference.meta.ejs'
    | 'UnityDefaultAsset.meta.ejs'
    | 'UnityFolder.meta.ejs'
    | 'UnityMonoScript.meta.ejs'

function pascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function camelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1)
}

function kebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
}

function displayName(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase())
}

interface RoleInfo {
    roleName: string
    className: string
    varName: string
    description: string
    baseClassName: 'HostRole' | 'RemoteRole'
    endpoints: IR['networks'][0]['roles'][0]['endpoints']
}

export default function createPlan(ctx: PipelineContext): PipelineContext {
    const { ir, request } = ctx
    if (!ir) throw new Error('ir is required')
    if (!request) throw new Error('request is required')

    const assemblyName = `${pascalCase(ir.package.project)}.${pascalCase(ir.package.service)}.${pascalCase(request.network)}.Sdk`
    ir.assemblyName = assemblyName

    const plan: PlanStep[] = []
    const folderMetaOutputs = new Set<string>()
    // Match the JS/TS targets: --out is the root and each network's package lands in
    // <out>/<service>/<network>/ so packages can evolve side by side.
    const packageRootPath = path.join(
        request.outputPath,
        kebabCase(ir.package.service),
        kebabCase(request.network)
    )
    const outputRootPath = request.packageName
        ? path.join(packageRootPath, 'Runtime')
        : packageRootPath

    if (request.packageName) {
        pushUnityAssetStep(
            plan,
            packageRootPath,
            folderMetaOutputs,
            {
                name: 'unity package manifest',
                command: 'render',
                getData: () => ({
                    name: request.packageName,
                    version: ir.package.version,
                    displayName: `${displayName(ir.package.project)} ${displayName(ir.package.service)} ${displayName(request.network)} SDK`,
                    description: ir.networks[0]?.description ?? ir.package.description ?? '',
                    dependencies: {
                        [UNITY_NEWTONSOFT_JSON_PACKAGE]: UNITY_NEWTONSOFT_JSON_VERSION,
                    },
                }),
                template: path.join(TEMPLATE_DIR, 'package.json.ejs'),
                output: path.join(packageRootPath, 'package.json'),
            },
            'UnityDefaultAsset.meta.ejs'
        )
        pushUnityAssetStep(
            plan,
            packageRootPath,
            folderMetaOutputs,
            {
                name: 'unity readme',
                command: 'render',
                getData: () => buildReadmeData(request, ir, assemblyName),
                template: path.join(TEMPLATE_DIR, 'README.md.ejs'),
                output: path.join(packageRootPath, 'README.md'),
            },
            'UnityDefaultAsset.meta.ejs'
        )
    }

    pushUnityAssetStep(
        plan,
        packageRootPath,
        folderMetaOutputs,
        {
            name: 'assembly definition',
            command: 'render',
            getData: () => ir,
            template: path.join(TEMPLATE_DIR, 'Service.asmdef.ejs'),
            output: path.join(outputRootPath, assemblyName, `${assemblyName}.asmdef`),
        },
        'UnityAssemblyDefinition.meta.ejs'
    )
    pushUnityAssetStep(
        plan,
        packageRootPath,
        folderMetaOutputs,
        {
            name: 'user assembly reference',
            command: 'render',
            getData: () => ir,
            template: path.join(TEMPLATE_DIR, 'UserService.asmref.ejs'),
            output: path.join(
                outputRootPath,
                `${assemblyName}.User`,
                `${assemblyName}.User.asmref`
            ),
        },
        'UnityAssemblyDefinitionReference.meta.ejs'
    )

    for (const networkIr of ir.networks) {
        const networkNamespace = `${pascalCase(ir.package.project)}.${pascalCase(ir.package.service)}.${pascalCase(networkIr.name)}`
        const networkClassName = `${pascalCase(networkIr.name)}Network`
        const networkOutputPath = path.join(outputRootPath, assemblyName)
        const userNetworkOutputPath = path.join(outputRootPath, `${assemblyName}.User`)

        // Build role info from IR
        const hostRoles: RoleInfo[] = []
        const remoteRoles: RoleInfo[] = []

        for (const role of networkIr.roles) {
            const roleInfo: RoleInfo = {
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
        pushUnityCSharpStep(plan, packageRootPath, folderMetaOutputs, {
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
            template: path.join(TEMPLATE_DIR, 'Network.cs.ejs'),
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
            handlerIr.modelClassName = pascalCase(handlerIr.handlerName) + 'Payload'
            handlerIr.messageName = handlerIr.handlerName
            handlerIr.methodName = pascalCase(handlerIr.handlerName)
        }

        // Process messages (outgoing messages to remote roles)
        for (const messageIr of networkIr.messages) {
            messageIr.modelClassName = pascalCase(messageIr.handlerName) + 'Payload'
            messageIr.messageName = messageIr.handlerName
            messageIr.methodName = pascalCase(messageIr.handlerName)
        }

        // Generate HostRole classes
        for (const hostRole of hostRoles) {
            const roleHandlers = networkIr.handlers.filter(h => h.roleName === hostRole.roleName)
            const modelImports = [`${networkNamespace}.Models.${hostRole.className}`]

            pushUnityCSharpStep(plan, packageRootPath, folderMetaOutputs, {
                name: `host role ${hostRole.className}`,
                command: 'render',
                getData: () => ({
                    namespace: `${networkNamespace}.Roles`,
                    handlers: roleHandlers,
                    remoteRoles,
                    modelImports,
                    ...hostRole,
                }),
                template: path.join(TEMPLATE_DIR, 'HostRole.cs.ejs'),
                output: path.join(networkOutputPath, 'Roles', `${hostRole.className}.cs`),
            })

            // Generate User stub for HostRole
            pushUnityCSharpStep(plan, packageRootPath, folderMetaOutputs, {
                name: `user host role ${hostRole.className}`,
                command: 'render',
                getData: () => ({
                    namespace: `${networkNamespace}.Roles`,
                    handlers: roleHandlers,
                    remoteRoles,
                    modelImports: allModelImports,
                    ...hostRole,
                }),
                template: path.join(TEMPLATE_DIR, 'UserHostRole.cs.ejs'),
                output: path.join(userNetworkOutputPath, 'Roles', `${hostRole.className}.cs`),
            })
        }

        // Generate RemoteRole classes
        for (const remoteRole of remoteRoles) {
            const roleMessages = networkIr.messages.filter(m => m.roleName === remoteRole.roleName)
            const modelImports = [`${networkNamespace}.Models.${remoteRole.className}`]

            pushUnityCSharpStep(plan, packageRootPath, folderMetaOutputs, {
                name: `remote role ${remoteRole.className}`,
                command: 'render',
                getData: () => ({
                    namespace: `${networkNamespace}.Roles`,
                    messages: roleMessages,
                    modelImports,
                    ...remoteRole,
                }),
                template: path.join(TEMPLATE_DIR, 'RemoteRole.cs.ejs'),
                output: path.join(networkOutputPath, 'Roles', `${remoteRole.className}.cs`),
            })
        }

        // Generate Models
        for (const modelIr of networkIr.models) {
            if (modelIr.type !== 'object') continue
            pushUnityCSharpStep(plan, packageRootPath, folderMetaOutputs, {
                name: `model ${modelIr.className}`,
                command: 'render',
                getData: () => modelIr,
                template: path.join(TEMPLATE_DIR, 'Model.cs.ejs'),
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

// Each network ships as its own package so it can be versioned and evolved
// independently: the README documents only the generated network, built from the IR so
// it reflects the actual --hostRole selection and the roles present in the package.
function buildReadmeData(request: BuildRequest, ir: IR, assemblyName: string) {
    const network = ir.networks[0]
    if (!network) throw new Error('ir.networks is empty')

    const namespace = `${pascalCase(ir.package.project)}.${pascalCase(ir.package.service)}.${pascalCase(network.name)}`
    const roles = network.roles.map(role => ({
        name: role.name,
        className: pascalCase(role.name),
        varName: camelCase(role.name),
        description: role.description ?? '',
        isHost: role.isHost,
        endpoints: role.endpoints,
    }))

    const hostRole = roles.find(role => role.isHost)
    const remoteRoles = roles.filter(role => !role.isHost)
    const remoteRole = remoteRoles.find(role => role.endpoints.length > 0) ?? remoteRoles[0]

    const sendMessage = remoteRole
        ? network.messages.find(message => message.roleName === remoteRole.name)
        : undefined
    const receiveHandler = hostRole
        ? network.handlers.find(handler => handler.roleName === hostRole.name)
        : undefined
    const sendExample = sendMessage
        ? {
              methodName: pascalCase(sendMessage.handlerName),
              payloadClassName: `${pascalCase(sendMessage.handlerName)}Payload`,
          }
        : undefined
    const receiveExample = receiveHandler
        ? {
              methodName: pascalCase(receiveHandler.handlerName),
              payloadClassName: `${pascalCase(receiveHandler.handlerName)}Payload`,
          }
        : undefined
    const exampleModelNamespaces = [
        ...new Set([
            ...(sendExample && remoteRole ? [`${namespace}.Models.${remoteRole.className}`] : []),
            ...(receiveExample && hostRole ? [`${namespace}.Models.${hostRole.className}`] : []),
        ]),
    ]

    return {
        packageName: request.packageName,
        title: `${displayName(ir.package.project)} ${displayName(ir.package.service)} ${displayName(network.name)} SDK`,
        description: network.description ?? ir.package.description ?? '',
        serviceName: ir.package.service,
        version: ir.package.version,
        hostRoleNames: request.hostRoles,
        network: {
            name: network.name,
            namespace,
            assemblyName,
            userAssemblyName: `${assemblyName}.User`,
            networkClassName: `${pascalCase(network.name)}Network`,
            behaviourClassName: `${pascalCase(network.name)}Behaviour`,
            roles,
            hostRole,
            remoteRole,
            sendExample,
            receiveExample,
            exampleModelNamespaces,
        },
    }
}

function pushUnityCSharpStep(
    plan: PlanStep[],
    outputRoot: string,
    folderMetaOutputs: Set<string>,
    step: PlanStep
): void {
    pushUnityAssetStep(plan, outputRoot, folderMetaOutputs, step, 'UnityMonoScript.meta.ejs')
}

function pushUnityAssetStep(
    plan: PlanStep[],
    outputRoot: string,
    folderMetaOutputs: Set<string>,
    step: PlanStep,
    metaTemplate: UnityMetaTemplate
): void {
    pushUnityFolderMetaSteps(plan, outputRoot, folderMetaOutputs, path.dirname(step.output))
    plan.push(step)
    plan.push({
        name: `${step.name} meta`,
        command: 'render',
        getData: () => ({
            guid: unityMetaGuid(outputRoot, step.output),
        }),
        template: path.join(TEMPLATE_DIR, metaTemplate),
        output: `${step.output}.meta`,
    })
}

function pushUnityFolderMetaSteps(
    plan: PlanStep[],
    outputRoot: string,
    folderMetaOutputs: Set<string>,
    leafFolderPath: string
): void {
    const folders = getGeneratedFolders(outputRoot, leafFolderPath)
    for (const folderPath of folders) {
        const metaOutput = `${folderPath}.meta`
        if (folderMetaOutputs.has(metaOutput)) continue

        folderMetaOutputs.add(metaOutput)
        plan.push({
            name: `folder ${normalizeRelativeAssetPath(outputRoot, folderPath)} meta`,
            command: 'render',
            getData: () => ({
                guid: unityMetaGuid(outputRoot, folderPath),
            }),
            template: path.join(TEMPLATE_DIR, 'UnityFolder.meta.ejs'),
            output: metaOutput,
        })
    }
}

function getGeneratedFolders(outputRoot: string, leafFolderPath: string): string[] {
    const folders: string[] = []
    let folderPath = path.normalize(leafFolderPath)

    while (isGeneratedPath(outputRoot, folderPath)) {
        folders.push(folderPath)
        const parentPath = path.dirname(folderPath)
        if (parentPath === folderPath) break
        folderPath = parentPath
    }

    return folders.reverse()
}

function isGeneratedPath(outputRoot: string, assetPath: string): boolean {
    const relativePath = path.relative(path.normalize(outputRoot), path.normalize(assetPath))
    return (
        relativePath !== '' &&
        relativePath !== '..' &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath)
    )
}

function unityMetaGuid(outputRoot: string, assetPath: string): string {
    return createHash('md5')
        .update(`${UNITY_META_GUID_PREFIX}${normalizeRelativeAssetPath(outputRoot, assetPath)}`)
        .digest('hex')
}

function normalizeRelativeAssetPath(outputRoot: string, assetPath: string): string {
    return path
        .relative(path.normalize(outputRoot), path.normalize(assetPath))
        .replaceAll(path.sep, '/')
        .replaceAll('\\', '/')
}

function mapType(property: IRProperty): string {
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
            if (!property.items) return 'List<object>'
            return `List<${mapType(property.items as IRProperty)}>`
        case 'object':
            return pascalCase(property.modelName)
        default:
            return 'object'
    }
}
