import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { DocModel } from './model.js'
import { htmlHelpers, renderTemplate, writeFile } from './render-utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_ROOT = findTemplateRoot()
const HTML_TEMPLATE_ROOT = path.join(TEMPLATE_ROOT, 'html/common')
const STATIC_TEMPLATE_ROOT = path.join(TEMPLATE_ROOT, 'static')

function findTemplateRoot(): string {
    for (const candidate of [
        path.join(__dirname, 'templates/docs'),
        path.join(__dirname, '../templates/docs'),
    ]) {
        if (fs.existsSync(candidate)) return candidate
    }
    return path.join(__dirname, '../templates/docs')
}

function renderHtmlTemplate(name: string, data: Record<string, unknown>): string {
    return renderTemplate(path.join(HTML_TEMPLATE_ROOT, name), {
        ...data,
        helpers: htmlHelpers,
    })
}

function renderPage(title: string, body: string): string {
    const css = fs.readFileSync(path.join(STATIC_TEMPLATE_ROOT, 'openws-sdk-sphinx.css'), 'utf8')
    return renderHtmlTemplate('page.html.ejs', {
        body,
        css,
        title,
    })
}

function writeHtmlPage(output: string, title: string, bodyTemplate: string, data: object): void {
    const body = renderHtmlTemplate(bodyTemplate, data as Record<string, unknown>)
    writeFile(output, renderPage(title, body))
}

export function writeNativeHtmlDocs(outputRoot: string, model: DocModel): void {
    fs.rmSync(outputRoot, { recursive: true, force: true })
    fs.mkdirSync(path.join(outputRoot, 'roles'), { recursive: true })

    writeHtmlPage(path.join(outputRoot, 'index.html'), model.title, 'index.html.ejs', { model })
    writeHtmlPage(
        path.join(outputRoot, `${model.network.pagePath}.html`),
        `${model.network.title} Network`,
        'network.html.ejs',
        { model }
    )
    for (const role of model.network.roles) {
        writeHtmlPage(
            path.join(outputRoot, `${role.pagePath}.html`),
            `${role.title} Role`,
            'role.html.ejs',
            { model, role }
        )
    }
    writeHtmlPage(path.join(outputRoot, 'models.html'), 'Payload Models', 'models.html.ejs', {
        model,
    })
}
