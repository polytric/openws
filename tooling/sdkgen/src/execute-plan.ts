import fs from 'node:fs'
import path from 'node:path'

import ejs from 'ejs'
import * as prettier from 'prettier'

import type { PipelineContext } from './types.js'

const rendererCache: Record<string, ejs.TemplateFunction> = {}
const parserByExtension: Record<string, prettier.BuiltInParserName> = {
    '.js': 'babel',
    '.json': 'json',
    '.ts': 'typescript',
}
const fallbackFormatOptions = {
    semi: false,
    singleQuote: true,
    tabWidth: 4,
    trailingComma: 'es5',
    printWidth: 100,
    arrowParens: 'avoid',
    endOfLine: 'lf',
} satisfies prettier.Options

function renderTemplate(templatePath: string, data: ejs.Data): string {
    if (rendererCache[templatePath]) {
        return rendererCache[templatePath](data)
    }
    const templateContent = fs.readFileSync(templatePath, 'utf8')
    const renderer = ejs.compile(templateContent)
    rendererCache[templatePath] = renderer
    return renderer(data)
}

async function formatRenderedOutput(output: string, content: string): Promise<string> {
    const parser = parserByExtension[path.extname(output)]
    if (!parser) return content

    const config = await prettier.resolveConfig(output, { editorconfig: true })
    return prettier.format(content, {
        ...fallbackFormatOptions,
        ...config,
        parser,
    })
}

export default async function executePlan(ctx: PipelineContext): Promise<PipelineContext> {
    const { plan } = ctx
    if (!plan) throw new Error('plan is required')

    for (const step of plan) {
        switch (step.command) {
            case 'copy':
                if (step.input) {
                    fs.cpSync(step.input, step.output, { recursive: true })
                }
                break
            case 'render': {
                const { getData, template, output } = step
                if (!getData || !template) continue

                const data = getData()
                fs.mkdirSync(path.dirname(output), { recursive: true })
                const rendered = renderTemplate(template, { ctx: data })
                fs.writeFileSync(output, await formatRenderedOutput(output, rendered))
                break
            }
        }
    }

    return ctx
}
