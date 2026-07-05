import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { PipelineContext, Spec } from './types.js'

type Language = 'csharp' | 'javascript' | 'typescript'
type JsonObject = Record<string, unknown>

interface DocModel {
    title: string
    description: string
    packageName?: string
    language: Language
    codeLanguage: string
    importLines: string[]
    installLines: string[]
    network: NetworkDoc
}

interface NetworkDoc {
    name: string
    title: string
    description: string
    className: string
    sourcePath: string
    roles: RoleDoc[]
}

interface RoleDoc {
    name: string
    title: string
    description: string
    className: string
    sourcePath: string
    endpoints: string[]
    messages: MessageDoc[]
}

interface MessageDoc {
    name: string
    title: string
    description: string
    payloadType: string
    payloadSourcePath: string
    fields: FieldDoc[]
    shapeType: string
}

interface FieldDoc {
    name: string
    type: string
    required: boolean
    description: string
}

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

function code(value: unknown): string {
    return `\`\`${plain(value).replaceAll('`', '')}\`\``
}

function heading(title: string, marker: string): string[] {
    return [title, marker.repeat(title.length), '']
}

function languageOf(ctx: PipelineContext): Language {
    const { request } = ctx
    if (!request) throw new Error('request is required')
    return Object.keys(request.target)[0] as Language
}

function targetCodeLanguage(language: Language): string {
    return language === 'csharp' ? 'csharp' : language
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

    return plain(typeName ?? obj.title, language === 'javascript' ? 'unknown' : 'unknown')
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

function buildDocModel(ctx: PipelineContext): DocModel {
    const { request, spec } = ctx
    if (!request) throw new Error('request is required')
    if (!spec) throw new Error('spec is required')

    const language = languageOf(ctx)
    const selectedNetwork = spec.networks[request.network]
    if (!selectedNetwork) {
        throw new Error(`Network "${request.network}" does not exist in the spec`)
    }

    const roles = Object.entries(selectedNetwork.roles ?? {})
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
                    fields: schemaFields(message.payload, language),
                    shapeType: schemaType(message.payload, language),
                }))

            return {
                name: roleName,
                title: titleWords(roleName),
                description: plain(role.description, `Generated role surface for ${roleName}.`),
                className: pascalCase(roleName),
                sourcePath: sourcePathForRole(ctx, language, request.network, roleName),
                endpoints: (role.endpoints ?? []).map(endpointText).filter(Boolean),
                messages,
            }
        })

    const networkTitle = titleWords(request.network)
    return {
        title: `${titleWords(spec.name)} ${networkTitle} OpenWS SDK`,
        description: plain(
            selectedNetwork.description ?? spec.description,
            `Generated OpenWS SDK reference for the ${request.network} network.`
        ),
        packageName: request.packageName,
        language,
        codeLanguage: targetCodeLanguage(language),
        installLines: buildInstallLines(language, request.packageName),
        importLines: buildImportLines(ctx, language, request.network),
        network: {
            name: request.network,
            title: networkTitle,
            description: plain(selectedNetwork.description, `${networkTitle} OpenWS network.`),
            className: `${pascalCase(request.network)}Network`,
            sourcePath: sourcePathForNetwork(ctx, language, request.network),
            roles,
        },
    }
}

function listTable(headers: string[], rows: string[][]): string[] {
    const lines = ['.. list-table::', '   :header-rows: 1', '']
    const addRow = (values: string[]) => {
        const [first, ...rest] = values
        lines.push(`   * - ${first || 'n/a'}`)
        for (const value of rest) {
            lines.push(`     - ${value || 'n/a'}`)
        }
    }

    addRow(headers)
    for (const row of rows) addRow(row)
    lines.push('')
    return lines
}

function writeFileLines(output: string, lines: string[]): void {
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, `${lines.join('\n')}\n`, 'utf8')
}

function writeSphinxConfig(rstRoot: string, model: DocModel): void {
    writeFileLines(path.join(rstRoot, 'conf.py'), [
        'html_copy_source = False',
        'html_show_sourcelink = False',
        'html_theme = "alabaster"',
        'html_theme_options = {',
        '    "fixed_sidebar": True,',
        '    "show_powered_by": False,',
        '}',
        `html_title = ${JSON.stringify(model.title)}`,
        `project = ${JSON.stringify(model.title)}`,
    ])
}

function writeRstIndex(rstRoot: string, model: DocModel): void {
    const networkSlug = kebabCase(model.network.name)
    const lines = heading(model.title, '=')
    lines.push(model.description, '', '.. rst-class:: lead', '')
    lines.push(
        `Generated ${model.language} OpenWS SDK reference for ${code(model.packageName ?? model.network.name)}.`,
        ''
    )
    if (model.installLines.length > 0) {
        lines.push(
            'Install',
            '-------',
            '',
            '.. code-block:: ' + (model.language === 'csharp' ? 'json' : 'shell'),
            ''
        )
        lines.push(...model.installLines.map(line => `   ${line}`), '')
    }
    lines.push('Import Surface', '--------------', '', `.. code-block:: ${model.codeLanguage}`, '')
    lines.push(...model.importLines.map(line => `   ${line}`), '')
    lines.push(
        'Network',
        '-------',
        '',
        `This SDK reference covers the ${code(model.network.name)} network, ${model.network.roles.length} roles, and ${model.network.roles.reduce((sum, role) => sum + role.messages.length, 0)} messages.`,
        '',
        '.. toctree::',
        '   :maxdepth: 2',
        '',
        `   ${networkSlug}`,
        '',
        '.. toctree::',
        '   :hidden:',
        '',
        '   models',
        ''
    )
    writeFileLines(path.join(rstRoot, 'index.rst'), lines)
}

function writeRstNetwork(rstRoot: string, model: DocModel): void {
    const { network } = model
    const lines = heading(`${network.title} Network`, '=')
    lines.push(network.description, '', `Network class: ${code(network.className)}`, '')
    lines.push(`Source: ${code(network.sourcePath)}`, '')
    lines.push(
        ...listTable(
            ['Role', 'Generated class', 'Messages', 'Source'],
            network.roles.map(role => [
                code(role.name),
                code(role.className),
                String(role.messages.length),
                code(role.sourcePath),
            ])
        )
    )

    for (const role of network.roles) {
        lines.push(...heading(`${role.title} Role`, '-'))
        lines.push(role.description, '', `Role class: ${code(role.className)}`, '')
        lines.push(`Source: ${code(role.sourcePath)}`, '')
        if (role.endpoints.length > 0) {
            lines.push('Endpoints', '~~~~~~~~~', '')
            for (const endpoint of role.endpoints) lines.push(`- ${code(endpoint)}`)
            lines.push('')
        }
        if (role.messages.length > 0) {
            lines.push(
                ...listTable(
                    ['Message', 'Payload', 'Description'],
                    role.messages.map(message => [
                        code(message.name),
                        code(message.payloadType),
                        message.description,
                    ])
                )
            )
        }
    }

    writeFileLines(path.join(rstRoot, `${kebabCase(network.name)}.rst`), lines)
}

function writeRstModels(rstRoot: string, model: DocModel): void {
    const lines = heading('Payload Models', '=')
    lines.push('Payload model shapes referenced by generated OpenWS role messages.', '')
    for (const role of model.network.roles) {
        for (const message of role.messages) {
            lines.push(...heading(message.payloadType, '-'))
            lines.push(`Message: ${code(message.name)}`, '')
            lines.push(`Source: ${code(message.payloadSourcePath)}`, '')
            if (message.fields.length > 0) {
                lines.push(
                    ...listTable(
                        ['Field', 'Type', 'Required', 'Description'],
                        message.fields.map(field => [
                            code(field.name),
                            code(field.type),
                            field.required ? 'yes' : 'no',
                            field.description,
                        ])
                    )
                )
            } else {
                lines.push(`Shape: ${code(message.shapeType)}`, '')
            }
        }
    }
    writeFileLines(path.join(rstRoot, 'models.rst'), lines)
}

function writeRstTree(rstRoot: string, model: DocModel): void {
    fs.rmSync(rstRoot, { recursive: true, force: true })
    fs.mkdirSync(rstRoot, { recursive: true })
    writeSphinxConfig(rstRoot, model)
    writeRstIndex(rstRoot, model)
    writeRstNetwork(rstRoot, model)
    writeRstModels(rstRoot, model)
}

function assertRstInput(inputPath: string): void {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`RST input directory does not exist: ${inputPath}`)
    }
}

function markdownTable(headers: string[], rows: string[][]): string[] {
    const escapeCell = (value: string) => value.replaceAll('|', '\\|').replace(/\s+/g, ' ')
    return [
        `| ${headers.map(escapeCell).join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map(row => `| ${row.map(escapeCell).join(' | ')} |`),
        '',
    ]
}

function writeMarkdownDocs(outputRoot: string, model: DocModel): void {
    fs.rmSync(outputRoot, { recursive: true, force: true })
    fs.mkdirSync(outputRoot, { recursive: true })
    const networkFile = `${kebabCase(model.network.name)}.md`

    writeFileLines(path.join(outputRoot, 'index.md'), [
        `# ${model.title}`,
        '',
        model.description,
        '',
        `Generated ${model.language} OpenWS SDK reference.`,
        '',
        ...(model.installLines.length > 0
            ? [
                  '## Install',
                  '',
                  '```' + (model.language === 'csharp' ? 'json' : 'shell'),
                  ...model.installLines,
                  '```',
                  '',
              ]
            : []),
        '## Import Surface',
        '',
        '```' + model.codeLanguage,
        ...model.importLines,
        '```',
        '',
        '## Pages',
        '',
        `- [${model.network.title} Network](./${networkFile})`,
        '- [Payload Models](./models.md)',
        '',
    ])

    const networkLines = [`# ${model.network.title} Network`, '', model.network.description, '']
    networkLines.push(`Network class: \`${model.network.className}\``, '')
    networkLines.push(`Source: \`${model.network.sourcePath}\``, '')
    networkLines.push(
        ...markdownTable(
            ['Role', 'Generated class', 'Messages', 'Source'],
            model.network.roles.map(role => [
                `\`${role.name}\``,
                `\`${role.className}\``,
                String(role.messages.length),
                `\`${role.sourcePath}\``,
            ])
        )
    )
    for (const role of model.network.roles) {
        networkLines.push(`## ${role.title} Role`, '', role.description, '')
        networkLines.push(`Role class: \`${role.className}\``, '')
        if (role.endpoints.length > 0) {
            networkLines.push('### Endpoints', '')
            for (const endpoint of role.endpoints) networkLines.push(`- \`${endpoint}\``)
            networkLines.push('')
        }
        if (role.messages.length > 0) {
            networkLines.push(
                ...markdownTable(
                    ['Message', 'Payload', 'Description'],
                    role.messages.map(message => [
                        `\`${message.name}\``,
                        `\`${message.payloadType}\``,
                        message.description,
                    ])
                )
            )
        }
    }
    writeFileLines(path.join(outputRoot, networkFile), networkLines)

    const modelLines = ['# Payload Models', '']
    for (const role of model.network.roles) {
        for (const message of role.messages) {
            modelLines.push(`## ${message.payloadType}`, '')
            modelLines.push(`Message: \`${message.name}\``, '')
            modelLines.push(`Source: \`${message.payloadSourcePath}\``, '')
            if (message.fields.length > 0) {
                modelLines.push(
                    ...markdownTable(
                        ['Field', 'Type', 'Required', 'Description'],
                        message.fields.map(field => [
                            `\`${field.name}\``,
                            `\`${field.type}\``,
                            field.required ? 'yes' : 'no',
                            field.description,
                        ])
                    )
                )
            } else {
                modelLines.push(`Shape: \`${message.shapeType}\``, '')
            }
        }
    }
    writeFileLines(path.join(outputRoot, 'models.md'), modelLines)
}

function rstHeadingLevel(marker: string): string | undefined {
    return (
        {
            '=': '#',
            '-': '##',
            '~': '###',
            '^': '####',
        }[marker] ?? undefined
    )
}

function convertRstToMarkdown(content: string): string {
    const lines = content.split(/\r?\n/)
    const out: string[] = []
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index]
        const next = lines[index + 1]
        if (
            next &&
            /^([=\-~^])\1*$/.test(next.trim()) &&
            next.trim().length >= line.trim().length
        ) {
            const marker = next.trim()[0]
            out.push(`${rstHeadingLevel(marker) ?? '#'} ${line.trim()}`, '')
            index++
            continue
        }

        const codeBlock = line.match(/^\.\. code-block::\s*(\S+)?/)
        if (codeBlock) {
            const language = codeBlock[1] ?? ''
            out.push(`\`\`\`${language}`)
            index++
            if (lines[index]?.trim() === '') index++
            while (index < lines.length) {
                const codeLine = lines[index]
                if (!codeLine.startsWith('   ') && codeLine.trim() !== '') {
                    index--
                    break
                }
                out.push(codeLine.startsWith('   ') ? codeLine.slice(3) : '')
                index++
            }
            out.push('```', '')
            continue
        }

        if (line.startsWith('.. toctree::')) {
            out.push('')
            index++
            while (index < lines.length) {
                const treeLine = lines[index]
                if (treeLine.trim() === '') {
                    index++
                    continue
                }
                if (!treeLine.startsWith('   ')) {
                    index--
                    break
                }
                const item = treeLine.trim()
                if (!item.startsWith(':')) out.push(`- ${item}`)
                index++
            }
            out.push('')
            continue
        }

        if (line.startsWith('.. ')) {
            continue
        }

        out.push(line.replace(/``([^`]+)``/g, '`$1`'))
    }

    return `${out
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()}\n`
}

function listRstFiles(rootPath: string): string[] {
    const files: string[] = []
    const walk = (directoryPath: string) => {
        for (const name of fs.readdirSync(directoryPath)) {
            const absolutePath = path.join(directoryPath, name)
            const stats = fs.statSync(absolutePath)
            if (stats.isDirectory()) {
                walk(absolutePath)
                continue
            }
            if (absolutePath.endsWith('.rst')) files.push(absolutePath)
        }
    }
    walk(rootPath)
    return files.sort()
}

function writeMarkdownFromRstTree(rstRoot: string, outputRoot: string): void {
    fs.rmSync(outputRoot, { recursive: true, force: true })
    fs.mkdirSync(outputRoot, { recursive: true })
    for (const rstPath of listRstFiles(rstRoot)) {
        const relativePath = path.relative(rstRoot, rstPath)
        const outputPath = path.join(outputRoot, relativePath.replace(/\.rst$/, '.md'))
        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(outputPath, convertRstToMarkdown(fs.readFileSync(rstPath, 'utf8')), 'utf8')
    }
}

function htmlEscape(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}

function htmlTable(headers: string[], rows: string[][]): string {
    return [
        '<table>',
        '<thead><tr>',
        ...headers.map(header => `<th>${htmlEscape(header)}</th>`),
        '</tr></thead>',
        '<tbody>',
        ...rows.map(
            row => `<tr>${row.map(value => `<td>${htmlEscape(value)}</td>`).join('')}</tr>`
        ),
        '</tbody>',
        '</table>',
    ].join('')
}

function htmlPage(title: string, body: string): string {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  <style>
    body { color: #1f2937; font: 16px/1.55 system-ui, sans-serif; margin: 0; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
    code, pre { background: #f3f4f6; border-radius: 4px; padding: 0.12rem 0.28rem; }
    pre { overflow-x: auto; padding: 12px; }
    table { border-collapse: collapse; margin: 16px 0 28px; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f9fafb; }
    nav a { margin-right: 16px; }
  </style>
</head>
<body><main>${body}</main></body>
</html>
`
}

function writeNativeHtmlDocs(outputRoot: string, model: DocModel): void {
    fs.rmSync(outputRoot, { recursive: true, force: true })
    fs.mkdirSync(outputRoot, { recursive: true })
    const networkFile = `${kebabCase(model.network.name)}.html`

    const install =
        model.installLines.length > 0
            ? `<h2>Install</h2><pre><code>${htmlEscape(model.installLines.join('\n'))}</code></pre>`
            : ''
    const indexBody = `<h1>${htmlEscape(model.title)}</h1>
<p>${htmlEscape(model.description)}</p>
${install}
<h2>Import Surface</h2>
<pre><code>${htmlEscape(model.importLines.join('\n'))}</code></pre>
<h2>Pages</h2>
<nav><a href="./${networkFile}">${htmlEscape(model.network.title)} Network</a><a href="./models.html">Payload Models</a></nav>`
    fs.writeFileSync(path.join(outputRoot, 'index.html'), htmlPage(model.title, indexBody), 'utf8')

    let networkBody = `<h1>${htmlEscape(model.network.title)} Network</h1>
<p>${htmlEscape(model.network.description)}</p>
<p>Network class: <code>${htmlEscape(model.network.className)}</code></p>
<p>Source: <code>${htmlEscape(model.network.sourcePath)}</code></p>`
    networkBody += htmlTable(
        ['Role', 'Generated class', 'Messages', 'Source'],
        model.network.roles.map(role => [
            role.name,
            role.className,
            String(role.messages.length),
            role.sourcePath,
        ])
    )
    for (const role of model.network.roles) {
        networkBody += `<h2>${htmlEscape(role.title)} Role</h2><p>${htmlEscape(role.description)}</p>`
        if (role.endpoints.length > 0) {
            networkBody += `<h3>Endpoints</h3><ul>${role.endpoints.map(endpoint => `<li><code>${htmlEscape(endpoint)}</code></li>`).join('')}</ul>`
        }
        if (role.messages.length > 0) {
            networkBody += htmlTable(
                ['Message', 'Payload', 'Description'],
                role.messages.map(message => [
                    message.name,
                    message.payloadType,
                    message.description,
                ])
            )
        }
    }
    fs.writeFileSync(
        path.join(outputRoot, networkFile),
        htmlPage(`${model.network.title} Network`, networkBody),
        'utf8'
    )

    let modelsBody = '<h1>Payload Models</h1>'
    for (const role of model.network.roles) {
        for (const message of role.messages) {
            modelsBody += `<h2>${htmlEscape(message.payloadType)}</h2>
<p>Message: <code>${htmlEscape(message.name)}</code></p>
<p>Source: <code>${htmlEscape(message.payloadSourcePath)}</code></p>`
            if (message.fields.length > 0) {
                modelsBody += htmlTable(
                    ['Field', 'Type', 'Required', 'Description'],
                    message.fields.map(field => [
                        field.name,
                        field.type,
                        field.required ? 'yes' : 'no',
                        field.description,
                    ])
                )
            } else {
                modelsBody += `<p>Shape: <code>${htmlEscape(message.shapeType)}</code></p>`
            }
        }
    }
    fs.writeFileSync(
        path.join(outputRoot, 'models.html'),
        htmlPage('Payload Models', modelsBody),
        'utf8'
    )
}

function sphinxCommand(): string | undefined {
    const candidates = [process.env.PYTHON, 'python', 'python3'].filter(
        (candidate): candidate is string => Boolean(candidate)
    )
    for (const candidate of candidates) {
        try {
            execFileSync(candidate, ['-m', 'sphinx', '--version'], { stdio: 'ignore' })
            return candidate
        } catch {
            continue
        }
    }
    return undefined
}

function renderHtmlDocs(
    rstRoot: string,
    outputRoot: string,
    model: DocModel,
    requiresSphinx: boolean
): void {
    const python = sphinxCommand()
    if (!python) {
        if (requiresSphinx) {
            throw new Error('Sphinx is required to render --rst-in to HTML')
        }
        writeNativeHtmlDocs(outputRoot, model)
        return
    }

    const doctrees = fs.mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-sphinx-'))
    try {
        fs.rmSync(outputRoot, { recursive: true, force: true })
        fs.mkdirSync(outputRoot, { recursive: true })
        execFileSync(
            python,
            ['-m', 'sphinx', '-b', 'html', '-d', doctrees, '-q', rstRoot, outputRoot],
            {
                stdio: 'pipe',
            }
        )
    } finally {
        fs.rmSync(doctrees, { recursive: true, force: true })
    }
}

function prepareRstInputForSphinx(inputPath: string, model: DocModel): string {
    assertRstInput(inputPath)
    const renderRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-rst-in-'))
    writeSphinxConfig(renderRoot, model)
    fs.cpSync(inputPath, renderRoot, { recursive: true, force: true })
    return renderRoot
}

export default function generateDocs(ctx: PipelineContext): PipelineContext {
    const { request } = ctx
    if (!request) throw new Error('request is required')
    if (!request.rstOutputPath && !request.docOutputPath) return ctx

    const model = buildDocModel(ctx)
    const rstRoot =
        request.rstOutputPath ?? fs.mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-rst-'))
    const shouldRemoveRstRoot = !request.rstOutputPath
    let preparedRstInput: string | undefined

    try {
        writeRstTree(rstRoot, model)
        if (request.rstInputPath) {
            assertRstInput(request.rstInputPath)
        }

        if (request.docOutputPath) {
            const format = request.docFormat ?? 'html'
            const renderRstRoot = request.rstInputPath ?? rstRoot
            if (format === 'markdown') {
                if (request.rstInputPath) {
                    writeMarkdownFromRstTree(renderRstRoot, request.docOutputPath)
                } else {
                    writeMarkdownDocs(request.docOutputPath, model)
                }
            } else {
                if (request.rstInputPath) {
                    preparedRstInput = prepareRstInputForSphinx(request.rstInputPath, model)
                }
                renderHtmlDocs(
                    preparedRstInput ?? renderRstRoot,
                    request.docOutputPath,
                    model,
                    Boolean(request.rstInputPath)
                )
            }
        }
    } finally {
        if (shouldRemoveRstRoot) {
            fs.rmSync(rstRoot, { recursive: true, force: true })
        }
        if (preparedRstInput) {
            fs.rmSync(preparedRstInput, { recursive: true, force: true })
        }
    }

    return ctx
}
