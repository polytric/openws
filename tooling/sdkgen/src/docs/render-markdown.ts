import fs from 'node:fs'
import path from 'node:path'

import type { DocModel } from './model.js'
import { markdownHelpers, writeFile } from './render-utils.js'

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

        out.push(
            line
                .replace(/:doc:`([^`<]+?)\s*<([^`>]+)>`/g, '[$1](./$2.md)')
                .replace(/``([^`]+)``/g, '`$1`')
        )
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

export function writeMarkdownFromRstTree(rstRoot: string, outputRoot: string): void {
    fs.rmSync(outputRoot, { recursive: true, force: true })
    fs.mkdirSync(outputRoot, { recursive: true })
    for (const rstPath of listRstFiles(rstRoot)) {
        const relativePath = path.relative(rstRoot, rstPath)
        const outputPath = path.join(outputRoot, relativePath.replace(/\.rst$/, '.md'))
        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(outputPath, convertRstToMarkdown(fs.readFileSync(rstPath, 'utf8')), 'utf8')
    }
}

export function writeMarkdownDocs(outputRoot: string, model: DocModel): void {
    fs.rmSync(outputRoot, { recursive: true, force: true })
    fs.mkdirSync(outputRoot, { recursive: true })
    const { markdownCodeList, markdownTable, roleMessageCount } = markdownHelpers
    const networkFile = `${model.network.pagePath}.md`

    writeFile(
        path.join(outputRoot, 'index.md'),
        [
            `# ${model.title}`,
            '',
            model.description,
            '',
            `Use this reference to find the generated ${model.languageLabel} surfaces for \`${model.network.name}\`.`,
            '',
            markdownTable(
                ['Network', 'Roles', 'Messages', 'Version'],
                [
                    [
                        `[${model.network.title}](./${networkFile})`,
                        String(model.network.roles.length),
                        String(roleMessageCount(model)),
                        `\`${model.version}\``,
                    ],
                ]
            ),
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
            ...model.network.roles.map(role => `- [${role.title} Role](./${role.pagePath}.md)`),
            '- [Payload Models](./models.md)',
            '',
        ].join('\n')
    )

    const networkLines = [`# ${model.network.title} Network`, '', model.network.description, '']
    networkLines.push(`Network class: \`${model.network.className}\``, '')
    networkLines.push(`Source: \`${model.network.sourcePath}\``, '')
    networkLines.push(
        markdownTable(
            ['Role', 'Generated class', 'Messages', 'Endpoints', 'Source'],
            model.network.roles.map(role => [
                `[${role.title}](./${role.pagePath}.md)`,
                `\`${role.className}\``,
                String(role.messages.length),
                role.endpoints.length > 0 ? String(role.endpoints.length) : 'none',
                `\`${role.sourcePath}\``,
            ])
        )
    )
    writeFile(path.join(outputRoot, networkFile), networkLines.join('\n'))

    for (const role of model.network.roles) {
        const roleLines = [`# ${role.title} Role`, '', role.description, '']
        roleLines.push(`Role class: \`${role.className}\``, '')
        roleLines.push(`Source: \`${role.sourcePath}\``, '')
        if (role.endpoints.length > 0) {
            roleLines.push('## Endpoints', '')
            for (const endpoint of role.endpoints) roleLines.push(`- \`${endpoint}\``)
            roleLines.push('')
        }
        if (role.messages.length > 0) {
            roleLines.push(
                '## Messages',
                '',
                markdownTable(
                    ['Message', 'Accepted from', 'Payload', 'Description'],
                    role.messages.map(message => [
                        `\`${message.name}\``,
                        markdownCodeList(message.senderRoles, 'any role'),
                        `\`${message.payloadType}\``,
                        message.description,
                    ])
                )
            )
        }

        for (const message of role.messages) {
            roleLines.push(`## ${message.title}`, '')
            roleLines.push(message.description, '')
            roleLines.push(`Payload: \`${message.payloadType}\``, '')
            roleLines.push(`Payload source: \`${message.payloadSourcePath}\``, '')
            roleLines.push(
                `Accepted from: ${markdownCodeList(message.senderRoles, 'any role')}`,
                ''
            )
            if (message.fields.length > 0) {
                roleLines.push(
                    markdownTable(
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
                roleLines.push(`Shape: \`${message.shapeType}\``, '')
            }
        }
        writeFile(path.join(outputRoot, `${role.pagePath}.md`), roleLines.join('\n'))
    }

    const modelLines = ['# Payload Models', '']
    for (const role of model.network.roles) {
        if (role.messages.length === 0) continue
        modelLines.push(`## ${role.title} Role Payloads`, '')
        for (const message of role.messages) {
            modelLines.push(`### ${message.payloadType}`, '')
            modelLines.push(`Message: \`${message.name}\``, '')
            modelLines.push(`Role: [${role.title}](./${role.pagePath}.md)`, '')
            modelLines.push(
                `Accepted from: ${markdownCodeList(message.senderRoles, 'any role')}`,
                ''
            )
            modelLines.push(`Source: \`${message.payloadSourcePath}\``, '')
            if (message.fields.length > 0) {
                modelLines.push(
                    markdownTable(
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
    writeFile(path.join(outputRoot, 'models.md'), modelLines.join('\n'))
}
