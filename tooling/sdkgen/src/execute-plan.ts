import fs from 'node:fs'
import path from 'node:path'

import ejs from 'ejs'

import type { PipelineContext } from './types.js'

const rendererCache: Record<string, ejs.TemplateFunction> = {}

function renderTemplate(templatePath: string, data: ejs.Data): string {
    if (rendererCache[templatePath]) {
        return rendererCache[templatePath](data)
    }
    const templateContent = fs.readFileSync(templatePath, 'utf8')
    const renderer = ejs.compile(templateContent)
    rendererCache[templatePath] = renderer
    return renderer(data)
}

export default function executePlan(ctx: PipelineContext): PipelineContext {
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
                console.log(data)
                fs.mkdirSync(path.dirname(output), { recursive: true })
                fs.writeFileSync(output, renderTemplate(template, { ctx: data }))
                break
            }
        }
    }

    return ctx
}
