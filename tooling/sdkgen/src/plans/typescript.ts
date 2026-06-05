import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
    IR,
    IRModel,
    IRProperty,
    JsonSchema,
    PipelineContext,
    PlanStep,
    Spec,
} from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = path.join(__dirname, '../templates/typescript')
const SRC_TEMPLATE_DIR = path.join(TEMPLATE_DIR, 'src')
const ROLES_TEMPLATE_DIR = path.join(SRC_TEMPLATE_DIR, 'roles')
const MODELS_TEMPLATE_DIR = path.join(SRC_TEMPLATE_DIR, 'models')
const SDK_TEMPLATE_DIR = path.join(SRC_TEMPLATE_DIR, 'sdk')

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

interface RoleInfo {
    roleName: string
    className: string
    roleClassName: string
    hostRoleClassName: string
    peerName: string
    varName: string
    peerVarName: string
    fileName: string
    roleFileName: string
    description: string
    endpoints: IR['networks'][0]['roles'][0]['endpoints']
}

interface ScopedRoleInfo extends RoleInfo {
    scopedPeerName: string
    allowedMethodNames: string[]
}

interface MessageInfo {
    methodName: string
    messageName: string
    payloadType: string
    payloadFileName: string
    schema: JsonValue
    fromRoles?: RoleInfo[]
    bindFromRoles?: RoleInfo[]
}

interface ModelScope {
    scopeName: string
    className: string
    varName: string
    fileName: string
    models: ModelInfo[]
}

interface ModelInfo {
    scopeName: string
    className: string
    fileName: string
    schema: JsonValue
    properties: Array<{
        name: string
        optional: boolean
        typeName: string
    }>
    imports: Array<{
        className: string
        fileName: string
    }>
}

interface PackageExport {
    subpath: string
    outputPath: string
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }
type SpecNetwork = Spec['networks'][string]
type SpecRole = SpecNetwork['roles'][string]
type SpecMessage = SpecRole['messages'][string]

export default function createPlan(ctx: PipelineContext): PipelineContext {
    const { ir, request, spec } = ctx
    if (!ir) throw new Error('ir is required')
    if (!request) throw new Error('request is required')
    if (!spec) throw new Error('spec is required')

    const language = Object.keys(request.target)[0] as 'javascript' | 'typescript'
    const isTypeScript = language === 'typescript'
    const extension = isTypeScript ? 'ts' : 'js'
    const serviceFileName = kebabCase(ir.package.service)
    const networkFileName = kebabCase(request.network)
    const packageOutputPath = path.join(request.outputPath, serviceFileName, networkFileName)
    const packageName = `@${kebabCase(ir.package.project)}/${serviceFileName}-${networkFileName}-openws-sdk`

    const plan: PlanStep[] = []

    const selectedNetworkSpec = spec.networks[request.network]
    if (!selectedNetworkSpec) {
        throw new Error(`Network "${request.network}" does not exist in the spec`)
    }

    for (const [networkName, networkSpec] of [[request.network, selectedNetworkSpec]] as const) {
        const sourceOutputPath = path.join(packageOutputPath, 'src')
        const sdkOutputPath = path.join(sourceOutputPath, 'sdk')
        const allRoles = Object.values(networkSpec.roles).map(toRoleInfo)
        const rolesByName = new Map(allRoles.map(role => [role.roleName, role]))
        const hostRoles = request.hostRoles.map(hostRole => {
            const role = rolesByName.get(hostRole)
            if (!role) {
                throw new Error(
                    `Host role "${hostRole}" does not exist in network "${networkName}"`
                )
            }
            return role
        })
        const modelScopes = buildModelScopes(buildSpecModels(networkSpec))
        const packageEntries = buildPackageEntries(extension, allRoles, hostRoles, modelScopes)
        const packageExports = buildPackageExports(packageEntries)

        plan.push(
            {
                name: `${language} package manifest`,
                command: 'render',
                getData: () => ({
                    isTypeScript,
                    packageName,
                    description: ir.package.description,
                    version: ir.package.version ?? '0.0.1',
                    packageExports,
                }),
                template: path.join(TEMPLATE_DIR, 'package.json.ejs'),
                output: path.join(packageOutputPath, 'package.json'),
            },
            {
                name: `${language} tsup config`,
                command: 'render',
                getData: () => ({
                    isTypeScript,
                    packageEntries,
                }),
                template: path.join(TEMPLATE_DIR, 'tsup.config.ts.ejs'),
                output: path.join(packageOutputPath, 'tsup.config.ts'),
            }
        )

        if (isTypeScript) {
            plan.push({
                name: `${language} tsconfig`,
                command: 'render',
                getData: () => ({}),
                template: path.join(TEMPLATE_DIR, 'tsconfig.json.ejs'),
                output: path.join(packageOutputPath, 'tsconfig.json'),
            })
        }

        plan.push({
            name: `${language} network ${networkName}`,
            command: 'render',
            getData: () => ({
                isTypeScript,
                networkName,
                networkClassName: `${pascalCase(networkName)}Network`,
                description: networkSpec.description,
                version: networkSpec.version,
                hostRoles,
                allRoles,
                extension,
            }),
            template: path.join(SRC_TEMPLATE_DIR, 'network.ts.ejs'),
            output: path.join(sourceOutputPath, `network.${extension}`),
        })

        const roleMessagesByName = new Map<string, MessageInfo[]>()
        for (const role of allRoles) {
            const roleSpec = networkSpec.roles[role.roleName]
            const messages = Object.entries(roleSpec.messages).map(([messageName, messageSpec]) =>
                toMessageInfo(messageName, messageSpec, rolesByName)
            )
            roleMessagesByName.set(role.roleName, messages)
        }

        const rolesWithMessages = allRoles.map(role => ({
            ...role,
            messages: roleMessagesByName.get(role.roleName) ?? [],
        }))

        for (const role of rolesWithMessages) {
            plan.push({
                name: `${language} core role ${role.className}`,
                command: 'render',
                getData: () => ({
                    isTypeScript,
                    extension,
                    peerRoles: allRoles.filter(peerRole => peerRole.roleName !== role.roleName),
                    ...role,
                }),
                template: path.join(ROLES_TEMPLATE_DIR, 'role.ts.ejs'),
                output: path.join(sourceOutputPath, 'roles', `${role.fileName}.${extension}`),
            })
        }

        plan.push({
            name: `${language} core role exports ${networkName}`,
            command: 'render',
            getData: () => ({
                isTypeScript,
                extension,
                roles: allRoles,
            }),
            template: path.join(ROLES_TEMPLATE_DIR, 'index.ts.ejs'),
            output: path.join(sourceOutputPath, 'roles', `index.${extension}`),
        })

        for (const modelScope of modelScopes) {
            plan.push({
                name: `${language} model exports ${modelScope.scopeName}`,
                command: 'render',
                getData: () => ({
                    isTypeScript,
                    extension,
                    ...modelScope,
                }),
                template: path.join(MODELS_TEMPLATE_DIR, 'index.ts.ejs'),
                output: path.join(
                    sourceOutputPath,
                    'models',
                    modelScope.fileName,
                    `index.${extension}`
                ),
            })

            for (const model of modelScope.models) {
                plan.push({
                    name: `${language} model ${model.className}`,
                    command: 'render',
                    getData: () => ({
                        isTypeScript,
                        ...model,
                    }),
                    template: path.join(MODELS_TEMPLATE_DIR, 'model.ts.ejs'),
                    output: path.join(
                        sourceOutputPath,
                        'models',
                        modelScope.fileName,
                        `${model.fileName}.${extension}`
                    ),
                })
            }
        }

        for (const hostRole of hostRoles) {
            const remoteRoles = getPeerRoles(networkSpec, rolesByName, hostRole.roleName).map(
                remoteRole =>
                    ({
                        ...remoteRole,
                        scopedPeerName: `${hostRole.className}${remoteRole.className}Peer`,
                        allowedMethodNames: getAllowedMessageMethodNames(
                            networkSpec,
                            remoteRole.roleName,
                            hostRole.roleName
                        ),
                    }) satisfies ScopedRoleInfo
            )
            const roleSpec = networkSpec.roles[hostRole.roleName]
            const roleHandlers = Object.entries(roleSpec.messages).map(
                ([messageName, messageSpec]) =>
                    toHandlerInfo(
                        messageName,
                        messageSpec,
                        rolesByName,
                        hostRole.roleName,
                        allRoles
                    )
            )

            plan.push({
                name: `${language} sdk role ${hostRole.className}`,
                command: 'render',
                getData: () => ({
                    isTypeScript,
                    extension,
                    handlers: roleHandlers,
                    networkName,
                    networkDescription: networkSpec.description,
                    networkVersion: networkSpec.version,
                    remoteRoles,
                    ...hostRole,
                }),
                template: path.join(SDK_TEMPLATE_DIR, 'role.ts.ejs'),
                output: path.join(sdkOutputPath, `${hostRole.fileName}.${extension}`),
            })
        }

        plan.push({
            name: `${language} sdk exports ${networkName}`,
            command: 'render',
            getData: () => ({
                isTypeScript,
                extension,
                roles: hostRoles,
            }),
            template: path.join(SDK_TEMPLATE_DIR, 'index.ts.ejs'),
            output: path.join(sdkOutputPath, `index.${extension}`),
        })

        plan.push({
            name: `${language} package exports`,
            command: 'render',
            getData: () => ({
                isTypeScript,
                extension,
                modelScopes,
            }),
            template: path.join(SRC_TEMPLATE_DIR, 'index.ts.ejs'),
            output: path.join(sourceOutputPath, `index.${extension}`),
        })
    }

    return {
        ...ctx,
        plan,
    }
}

function buildModelScopes(models: IRModel[]): ModelScope[] {
    const scopes = new Map<string, ModelScope>()
    const objectModels = models.filter(model => model.type === 'object')

    for (const model of objectModels) {
        const scopeName = model.scopeName
        const scope =
            scopes.get(scopeName) ??
            ({
                scopeName,
                className: pascalCase(scopeName),
                varName: camelCase(scopeName),
                fileName: kebabCase(scopeName),
                models: [],
            } satisfies ModelScope)

        scope.models.push({
            scopeName,
            className: pascalCase(model.modelName),
            fileName: kebabCase(model.modelName),
            schema: buildModelSchema(model, objectModels),
            properties: (model.properties ?? []).map(property => ({
                name: property.modelName,
                optional: !property.required,
                typeName: mapType(property),
            })),
            imports: buildModelImports(model),
        })
        scopes.set(scopeName, scope)
    }

    return [...scopes.values()]
}

function buildPackageEntries(
    extension: string,
    allRoles: RoleInfo[],
    hostRoles: RoleInfo[],
    modelScopes: ModelScope[]
): Record<string, string> {
    const entries: Record<string, string> = {
        index: `src/index.${extension}`,
        network: `src/network.${extension}`,
        'roles/index': `src/roles/index.${extension}`,
        'sdk/index': `src/sdk/index.${extension}`,
    }

    for (const role of allRoles) {
        entries[`roles/${role.fileName}`] = `src/roles/${role.fileName}.${extension}`
    }

    for (const role of hostRoles) {
        entries[`sdk/${role.fileName}`] = `src/sdk/${role.fileName}.${extension}`
    }

    for (const modelScope of modelScopes) {
        entries[`models/${modelScope.fileName}/index`] =
            `src/models/${modelScope.fileName}/index.${extension}`
        for (const model of modelScope.models) {
            entries[`models/${modelScope.fileName}/${model.fileName}`] =
                `src/models/${modelScope.fileName}/${model.fileName}.${extension}`
        }
    }

    return entries
}

function buildPackageExports(packageEntries: Record<string, string>): PackageExport[] {
    return Object.keys(packageEntries).map(entryName => ({
        subpath: entryName === 'index' ? '.' : `./${entryName.replace(/\/index$/, '')}`,
        outputPath: `./dist/${entryName}`,
    }))
}

function toRoleInfo(role: SpecRole): RoleInfo {
    const className = pascalCase(role.name)
    const fileName = kebabCase(role.name)
    return {
        roleName: role.name,
        className,
        roleClassName: className,
        hostRoleClassName: `${className}Host`,
        peerName: `${className}Peer`,
        varName: camelCase(role.name),
        peerVarName: `${camelCase(role.name)}Peer`,
        fileName,
        roleFileName: `${fileName}-role`,
        description: role.description || '',
        endpoints: role.endpoints || [],
    }
}

function getMessageFromRoles(
    message: SpecMessage,
    rolesByName: Map<string, RoleInfo>,
    currentRoleName: string,
    allRoles: RoleInfo[]
): RoleInfo[] {
    const fromRoleNames = getMessageFromRoleNames(
        message,
        currentRoleName,
        allRoles.map(role => role.roleName)
    )
    return fromRoleNames
        .map(roleName => rolesByName.get(roleName))
        .filter((role): role is RoleInfo => Boolean(role))
}

function getExplicitMessageFromRoles(
    message: SpecMessage,
    rolesByName: Map<string, RoleInfo>
): RoleInfo[] | undefined {
    if (!message.from) return undefined
    return message.from
        .map(roleName => rolesByName.get(roleName))
        .filter((role): role is RoleInfo => Boolean(role))
}

function getPeerRoles(
    network: SpecNetwork,
    rolesByName: Map<string, RoleInfo>,
    hostRoleName: string
): RoleInfo[] {
    const peers = new Set<string>()
    const hostRole = network.roles[hostRoleName]
    const allRoleNames = Object.keys(network.roles)

    for (const message of Object.values(hostRole.messages)) {
        for (const roleName of getMessageFromRoleNames(message, hostRoleName, allRoleNames)) {
            peers.add(roleName)
        }
    }

    for (const [roleName, role] of Object.entries(network.roles)) {
        if (roleName === hostRoleName) continue
        for (const message of Object.values(role.messages)) {
            if (getMessageFromRoleNames(message, roleName, allRoleNames).includes(hostRoleName)) {
                peers.add(roleName)
            }
        }
    }

    return [...peers]
        .map(roleName => rolesByName.get(roleName))
        .filter((role): role is RoleInfo => Boolean(role))
}

function getMessageFromRoleNames(
    message: SpecMessage,
    targetRoleName: string,
    allRoleNames: string[]
): string[] {
    return message.from ?? allRoleNames.filter(roleName => roleName !== targetRoleName)
}

function getAllowedMessageMethodNames(
    network: SpecNetwork,
    targetRoleName: string,
    fromRoleName: string
): string[] {
    const targetRole = network.roles[targetRoleName]
    const allRoleNames = Object.keys(network.roles)

    return Object.entries(targetRole.messages)
        .filter(([, message]) =>
            getMessageFromRoleNames(message, targetRoleName, allRoleNames).includes(fromRoleName)
        )
        .map(([messageName]) => camelCase(messageName))
}

function buildSpecModels(network: SpecNetwork): IRModel[] {
    const models: IRModel[] = []
    for (const role of Object.values(network.roles)) {
        for (const [messageName, message] of Object.entries(role.messages)) {
            models.push(...buildIrModels(role.name, `${messageName}Payload`, message.payload))
        }
    }
    return models
}

function buildIrModels(scopeName: string, modelName: string, schema: JsonSchema): IRModel[] {
    const type = schema.type as string
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
            const items = schema.items as JsonSchema | undefined
            if (!items) return []
            return buildIrModels(scopeName, modelName, items)
        }
        case 'object': {
            const properties: IRProperty[] = []
            model.properties = properties
            const models: IRModel[] = []
            const schemaProperties = schema.properties as Record<string, JsonSchema> | undefined

            if (!schemaProperties) return [model]

            for (const [subName, subSchema] of Object.entries(schemaProperties)) {
                const subModels = buildIrModels(scopeName, subName, subSchema)
                const mainModel: IRModel | JsonSchema =
                    subModels.find(m => m.modelName === subName) ?? subSchema

                const property: IRProperty = {
                    type: mainModel.type as string,
                    description: mainModel.description,
                    scopeName: (mainModel as IRModel).scopeName ?? scopeName,
                    modelName: (mainModel as IRModel).modelName ?? subName,
                    required: (schema.required as string[] | undefined)?.includes(subName),
                }

                const itemsSource =
                    (mainModel as IRModel).properties?.[0]?.items ??
                    ((mainModel as JsonSchema).items as JsonSchema | undefined)
                if (itemsSource) {
                    property.items = {
                        type: itemsSource.type as string,
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

function buildModelImports(model: IRModel): ModelInfo['imports'] {
    const imports = new Map<string, { className: string; fileName: string }>()
    const addImport = (modelName: string | undefined) => {
        if (!modelName || modelName === model.modelName) return
        const className = pascalCase(modelName)
        imports.set(className, {
            className,
            fileName: kebabCase(modelName),
        })
    }

    for (const property of model.properties ?? []) {
        if (property.type === 'object') {
            addImport(property.modelName)
        }
        if (property.type === 'array' && property.items?.type === 'object') {
            addImport(property.items.modelName)
        }
    }

    return [...imports.values()]
}

function buildModelSchema(model: IRModel, models: IRModel[], seen = new Set<string>()): JsonObject {
    const key = `${model.scopeName}:${model.modelName}`
    if (seen.has(key)) return { type: 'object' }

    const nextSeen = new Set(seen)
    nextSeen.add(key)

    const properties: JsonObject = {}
    const required: string[] = []

    for (const property of model.properties ?? []) {
        properties[property.modelName] = buildPropertySchema(property, models, nextSeen)
        if (property.required) required.push(property.modelName)
    }

    const schema: JsonObject = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties,
        additionalProperties: false,
    }
    if (model.description) schema.description = model.description
    if (required.length > 0) schema.required = required
    return schema
}

function buildNestedObjectSchema(model: IRModel, models: IRModel[], seen: Set<string>): JsonObject {
    const { $schema: _schema, ...schema } = buildModelSchema(model, models, seen)
    return schema
}

function buildPropertySchema(
    property: IRProperty,
    models: IRModel[],
    seen: Set<string>
): JsonObject {
    const schema = buildSchemaForType(
        property.type,
        property.scopeName,
        property.modelName,
        models,
        seen
    )
    if (property.description) schema.description = property.description
    if (property.type === 'array' && property.items) {
        schema.items = buildSchemaForType(
            property.items.type,
            property.items.scopeName,
            property.items.modelName,
            models,
            seen
        )
        if (
            property.items.description &&
            typeof schema.items === 'object' &&
            schema.items !== null
        ) {
            const itemSchema = schema.items as JsonObject
            itemSchema.description = property.items.description
        }
    }
    return schema
}

function buildSchemaForType(
    type: string,
    scopeName: string,
    modelName: string,
    models: IRModel[],
    seen: Set<string>
): JsonObject {
    switch (type) {
        case 'string':
        case 'number':
        case 'integer':
        case 'boolean':
        case 'null':
            return { type }
        case 'array':
            return { type: 'array' }
        case 'object': {
            const model = findModel(models, scopeName, modelName)
            if (!model) return { type: 'object' }
            return buildNestedObjectSchema(model, models, seen)
        }
        default:
            return {}
    }
}

function findModel(models: IRModel[], scopeName: string, modelName: string): IRModel | undefined {
    return models.find(model => model.scopeName === scopeName && model.modelName === modelName)
}

function toHandlerInfo(
    messageName: string,
    message: SpecMessage,
    rolesByName: Map<string, RoleInfo>,
    _currentRoleName: string,
    _allRoles: RoleInfo[]
) {
    const payloadType = pascalCase(messageName) + 'Payload'
    const methodSuffix = pascalCase(messageName)
    return {
        dispatchMethodName: camelCase(messageName),
        onMethodName: `on${methodSuffix}`,
        listenerFieldName: `${camelCase(messageName)}Handlers`,
        messageName,
        payloadType,
        payloadFileName: kebabCase(payloadType),
        schema: toJsonValue(message.payload),
        fromRoles: getExplicitMessageFromRoles(message, rolesByName),
        bindFromRoles: getMessageFromRoles(message, rolesByName, _currentRoleName, _allRoles),
    }
}

function toMessageInfo(
    messageName: string,
    message: SpecMessage,
    rolesByName: Map<string, RoleInfo>
): MessageInfo {
    const payloadType = pascalCase(messageName) + 'Payload'
    return {
        methodName: camelCase(messageName),
        messageName,
        payloadType,
        payloadFileName: kebabCase(payloadType),
        schema: toJsonValue(message.payload),
        fromRoles: getExplicitMessageFromRoles(message, rolesByName),
    }
}

function toJsonValue(value: unknown): JsonValue {
    return JSON.parse(JSON.stringify(value)) as JsonValue
}

function mapType(property: IRProperty): string {
    switch (property.type) {
        case 'string':
            return 'string'
        case 'number':
        case 'integer':
            return 'number'
        case 'boolean':
            return 'boolean'
        case 'null':
            return 'null'
        case 'array':
            if (!property.items) return 'unknown[]'
            return `${mapType(property.items as IRProperty)}[]`
        case 'object':
            return pascalCase(property.modelName)
        default:
            return 'unknown'
    }
}
