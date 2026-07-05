import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { IR, IRProperty, PipelineContext, PlanStep } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// From src/plans/ -> ../templates/dotnet
// From dist/plans/ -> ../templates/dotnet (same relative path!)
const TEMPLATE_DIR = path.join(__dirname, '../templates/dotnet')
const UNITY_META_GUID_PREFIX = 'openws-sdkgen/unity-meta/'

type UnityMetaTemplate =
    | 'UnityAssemblyDefinition.meta.ejs'
    | 'UnityAssemblyDefinitionReference.meta.ejs'
    | 'UnityFolder.meta.ejs'
    | 'UnityMonoScript.meta.ejs'

function pascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function camelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1)
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

    const assemblyName = `${pascalCase(ir.package.project)}.${pascalCase(ir.package.service)}.Sdk`
    ir.assemblyName = assemblyName

    const plan: PlanStep[] = []
    const folderMetaOutputs = new Set<string>()

    pushUnityAssetStep(
        plan,
        request.outputPath,
        folderMetaOutputs,
        {
            name: 'assembly definition',
            command: 'render',
            getData: () => ir,
            template: path.join(TEMPLATE_DIR, 'Service.asmdef.ejs'),
            output: path.join(request.outputPath, assemblyName, `${assemblyName}.asmdef`),
        },
        'UnityAssemblyDefinition.meta.ejs'
    )
    pushUnityAssetStep(
        plan,
        request.outputPath,
        folderMetaOutputs,
        {
            name: 'user assembly reference',
            command: 'render',
            getData: () => ir,
            template: path.join(TEMPLATE_DIR, 'UserService.asmref.ejs'),
            output: path.join(
                request.outputPath,
                `${assemblyName}.User`,
                `${assemblyName}.User.asmref`
            ),
        },
        'UnityAssemblyDefinitionReference.meta.ejs'
    )

    for (const networkIr of ir.networks) {
        const networkNamespace = `${pascalCase(ir.package.project)}.${pascalCase(ir.package.service)}.${pascalCase(networkIr.name)}`
        const networkClassName = `${pascalCase(networkIr.name)}Network`
        const networkOutputPath = path.join(
            request.outputPath,
            assemblyName,
            pascalCase(networkIr.name)
        )
        const userNetworkOutputPath = path.join(
            request.outputPath,
            `${assemblyName}.User`,
            pascalCase(networkIr.name)
        )

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
        pushUnityCSharpStep(plan, request.outputPath, folderMetaOutputs, {
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

            pushUnityCSharpStep(plan, request.outputPath, folderMetaOutputs, {
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
            pushUnityCSharpStep(plan, request.outputPath, folderMetaOutputs, {
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

            pushUnityCSharpStep(plan, request.outputPath, folderMetaOutputs, {
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
            pushUnityCSharpStep(plan, request.outputPath, folderMetaOutputs, {
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
