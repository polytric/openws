import type { PipelineContext } from '../types.js'

export type Language = 'csharp' | 'javascript' | 'typescript'
export type DocTarget = 'csharp-unity' | 'javascript' | 'typescript'
type JsonObject = Record<string, unknown>

export interface DocModel {
    title: string
    description: string
    version: string
    packageName?: string
    language: Language
    languageLabel: string
    target: DocTarget
    codeLanguage: string
    importLines: string[]
    installLines: string[]
    network: NetworkDoc
}

export interface NetworkDoc {
    name: string
    slug: string
    title: string
    description: string
    className: string
    sourcePath: string
    pagePath: string
    roles: RoleDoc[]
}

export interface RoleDoc {
    name: string
    slug: string
    title: string
    description: string
    className: string
    sourcePath: string
    pagePath: string
    endpoints: string[]
    messages: MessageDoc[]
}

export interface MessageDoc {
    name: string
    title: string
    description: string
    payloadType: string
    payloadSourcePath: string
    senderRoles: string[]
    fields: FieldDoc[]
    shapeType: string
}

export interface FieldDoc {
    name: string
    type: string
    required: boolean
    description: string
}

export const ROLE_DOC_DIR = 'roles'

function pascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

function kebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
}

function titleWords(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase())
}

function plain(value: unknown, fallback = ''): string {
    const text = value == null ? fallback : String(value)
    return text.replace(/\s+/g, ' ').trim() || fallback
}

export function languageOf(ctx: PipelineContext): Language {
    const { request } = ctx
    if (!request) throw new Error('request is required')
    return Object.keys(request.target)[0] as Language
}

function targetOf(ctx: PipelineContext, language: Language): DocTarget {
    if (language === 'csharp') {
        if (!ctx.request?.target.csharp) throw new Error('csharp target is required')
        return 'csharp-unity'
    }
    return language
}

function targetCodeLanguage(language: Language): string {
    return language === 'csharp' ? 'csharp' : language
}

function languageLabel(language: Language): string {
    return (
        {
            csharp: 'C#',
            javascript: 'JavaScript',
            typescript: 'TypeScript',
        } satisfies Record<Language, string>
    )[language]
}

function schemaType(schema: unknown, language: Language): string {
    if (!schema || typeof schema !== 'object') return 'void'
    const obj = schema as JsonObject
    const ref = obj.$ref
    if (typeof ref === 'string') return ref.split('/').at(-1) ?? 'object'

    for (const key of ['allOf', 'oneOf', 'anyOf']) {
        const variants = obj[key]
        if (Array.isArray(variants) && variants.length > 0) {
            return variants.map(item => schemaType(item, language)).join(' | ')
        }
    }

    if (Array.isArray(obj.enum)) {
        return `${plain(obj.type, 'enum')} enum`
    }

    const typeName = Array.isArray(obj.type) ? obj.type[0] : obj.type
    if (typeName === 'array') {
        const itemType = schemaType(obj.items, language)
        return language === 'csharp' ? `List<${itemType}>` : `${itemType}[]`
    }
    if (typeName === 'object') {
        if (obj.title) return String(obj.title)
        if (obj.additionalProperties) {
            return language === 'csharp' ? 'Dictionary<string, object>' : 'Record<string, unknown>'
        }
        return 'object'
    }

    if (language === 'csharp') {
        return (
            {
                integer: 'int',
                number: 'double',
                boolean: 'bool',
                string: 'string',
            }[String(typeName)] ?? plain(typeName, 'object')
        )
    }

    return plain(typeName ?? obj.title, 'unknown')
}

function schemaFields(schema: unknown, language: Language): FieldDoc[] {
    if (!schema || typeof schema !== 'object') return []
    const obj = schema as JsonObject
    const properties = obj.properties
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return []

    const required = new Set(Array.isArray(obj.required) ? obj.required.map(String) : [])
    return Object.entries(properties as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, propertySchema]) => ({
            name,
            type: schemaType(propertySchema, language),
            required: required.has(name),
            description:
                propertySchema && typeof propertySchema === 'object'
                    ? plain((propertySchema as JsonObject).description, 'n/a')
                    : 'n/a',
        }))
}

function endpointText(endpoint: unknown): string {
    if (!endpoint || typeof endpoint !== 'object') return ''
    const obj = endpoint as JsonObject
    const scheme = plain(obj.scheme, 'ws')
    const host = plain(obj.host, '')
    const port = obj.port == null ? '' : `:${String(obj.port)}`
    const endpointPath = plain(obj.path, '')
    return `${scheme}://${host}${port}${endpointPath}` || 'n/a'
}

function sourcePathForNetwork(
    ctx: PipelineContext,
    language: Language,
    networkName: string
): string {
    const { request, spec } = ctx
    if (!request || !spec) throw new Error('request and spec are required')
    if (language === 'csharp') {
        const assemblyName = `${pascalCase(request.project)}.${pascalCase(spec.name)}.Sdk`
        const prefix = request.packageName ? 'Runtime/' : ''
        return `${prefix}${assemblyName}/${pascalCase(networkName)}/${pascalCase(networkName)}Network.cs`
    }

    const extension = language === 'typescript' ? 'ts' : 'js'
    return `${kebabCase(spec.name)}/${kebabCase(networkName)}/src/network.${extension}`
}

function sourcePathForRole(
    ctx: PipelineContext,
    language: Language,
    networkName: string,
    roleName: string
): string {
    const { request, spec } = ctx
    if (!request || !spec) throw new Error('request and spec are required')
    if (language === 'csharp') {
        const assemblyName = `${pascalCase(request.project)}.${pascalCase(spec.name)}.Sdk`
        const prefix = request.packageName ? 'Runtime/' : ''
        return `${prefix}${assemblyName}/${pascalCase(networkName)}/Roles/${pascalCase(roleName)}.cs`
    }

    const extension = language === 'typescript' ? 'ts' : 'js'
    return `${kebabCase(spec.name)}/${kebabCase(networkName)}/src/roles/${kebabCase(roleName)}.${extension}`
}

function sourcePathForPayload(
    ctx: PipelineContext,
    language: Language,
    networkName: string,
    roleName: string,
    messageName: string
): string {
    const { request, spec } = ctx
    if (!request || !spec) throw new Error('request and spec are required')
    if (language === 'csharp') {
        const assemblyName = `${pascalCase(request.project)}.${pascalCase(spec.name)}.Sdk`
        const prefix = request.packageName ? 'Runtime/' : ''
        return `${prefix}${assemblyName}/${pascalCase(networkName)}/Models/${pascalCase(roleName)}/${pascalCase(messageName)}Payload.cs`
    }

    const extension = language === 'typescript' ? 'ts' : 'js'
    return `${kebabCase(spec.name)}/${kebabCase(networkName)}/src/models/${kebabCase(roleName)}/${kebabCase(messageName)}-payload.${extension}`
}

function namespaceFor(ctx: PipelineContext, networkName: string): string {
    const { request, spec } = ctx
    if (!request || !spec) throw new Error('request and spec are required')
    return `${pascalCase(request.project)}.${pascalCase(spec.name)}.${pascalCase(networkName)}`
}

function buildInstallLines(language: Language, packageName?: string): string[] {
    if (!packageName) return []
    if (language === 'csharp') {
        return ['{', '  "dependencies": {', `    "${packageName}": "<version>"`, '  }', '}']
    }
    return [`pnpm add ${packageName}`]
}

function buildImportLines(ctx: PipelineContext, language: Language, networkName: string): string[] {
    const { request } = ctx
    if (!request) throw new Error('request is required')
    const networkClassName = `${pascalCase(networkName)}Network`
    if (language === 'csharp') {
        const namespaceName = namespaceFor(ctx, networkName)
        return [`using ${namespaceName};`, `using ${namespaceName}.Roles;`]
    }

    if (request.packageName) {
        return [`import { ${networkClassName}, roles, sdk } from '${request.packageName}';`]
    }

    return [`import { ${networkClassName}, roles, sdk } from './src';`]
}

function requireEffectiveVersion(
    specVersion: string | undefined,
    networkName: string,
    networkVersion: string | undefined
): string {
    const effectiveVersion = networkVersion ?? specVersion
    if (!effectiveVersion) {
        throw new Error(
            `Version is required for network "${networkName}". Set spec.version or networks.${networkName}.version.`
        )
    }
    return effectiveVersion
}

function generatedRoleNames(ctx: PipelineContext, language: Language): Set<string> | undefined {
    if (language !== 'csharp') return undefined

    const { ir, request } = ctx
    if (!ir || !request) return undefined

    const networkIr = ir.networks.find(network => network.name === request.network)
    if (!networkIr) return undefined

    return new Set(networkIr.roles.map(role => role.name))
}

export function buildDocModel(ctx: PipelineContext): DocModel {
    const { request, spec } = ctx
    if (!request) throw new Error('request is required')
    if (!spec) throw new Error('spec is required')

    const language = languageOf(ctx)
    const selectedNetwork = spec.networks[request.network]
    if (!selectedNetwork) {
        throw new Error(`Network "${request.network}" does not exist in the spec`)
    }

    const roleNames = generatedRoleNames(ctx, language)
    const roles = Object.entries(selectedNetwork.roles ?? {})
        .filter(([roleName]) => !roleNames || roleNames.has(roleName))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([roleName, role]) => {
            const messages = Object.entries(role.messages ?? {})
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([messageName, message]) => ({
                    name: messageName,
                    title: titleWords(messageName),
                    description: plain(message.description, 'n/a'),
                    payloadType: `${pascalCase(messageName)}Payload`,
                    payloadSourcePath: sourcePathForPayload(
                        ctx,
                        language,
                        request.network,
                        roleName,
                        messageName
                    ),
                    senderRoles: Array.isArray(message.from)
                        ? message.from.map(String).sort((left, right) => left.localeCompare(right))
                        : [],
                    fields: schemaFields(message.payload, language),
                    shapeType: schemaType(message.payload, language),
                }))
            const slug = kebabCase(roleName)

            return {
                name: roleName,
                slug,
                title: titleWords(roleName),
                description: plain(role.description, `Generated role surface for ${roleName}.`),
                className: pascalCase(roleName),
                sourcePath: sourcePathForRole(ctx, language, request.network, roleName),
                pagePath: `${ROLE_DOC_DIR}/${slug}`,
                endpoints: (role.endpoints ?? []).map(endpointText).filter(Boolean),
                messages,
            }
        })

    const networkTitle = titleWords(request.network)
    const networkSlug = kebabCase(request.network)
    return {
        title: `${titleWords(spec.name)} ${networkTitle} OpenWS SDK`,
        description: plain(
            selectedNetwork.description ?? spec.description,
            `Generated OpenWS SDK reference for the ${request.network} network.`
        ),
        version: requireEffectiveVersion(spec.version, request.network, selectedNetwork.version),
        packageName: request.packageName,
        language,
        languageLabel: languageLabel(language),
        target: targetOf(ctx, language),
        codeLanguage: targetCodeLanguage(language),
        installLines: buildInstallLines(language, request.packageName),
        importLines: buildImportLines(ctx, language, request.network),
        network: {
            name: request.network,
            slug: networkSlug,
            title: networkTitle,
            description: plain(selectedNetwork.description, `${networkTitle} OpenWS network.`),
            className: `${pascalCase(request.network)}Network`,
            sourcePath: sourcePathForNetwork(ctx, language, request.network),
            pagePath: networkSlug,
            roles,
        },
    }
}
