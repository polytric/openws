import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { DocModel } from './model.js'
import { renderTemplate, rstHelpers, writeFile } from './render-utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_ROOT = findTemplateRoot()
const RST_TEMPLATE_ROOT = path.join(TEMPLATE_ROOT, 'rst')
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

function resolveRstTemplate(model: DocModel, name: string): string {
    const targetTemplate = path.join(RST_TEMPLATE_ROOT, model.target, name)
    if (fs.existsSync(targetTemplate)) return targetTemplate

    return path.join(RST_TEMPLATE_ROOT, 'common', name)
}

function renderRstTemplate(model: DocModel, name: string, data: Record<string, unknown>): string {
    return renderTemplate(resolveRstTemplate(model, name), {
        ...data,
        helpers: rstHelpers,
        model,
    })
}

function writeStaticAssets(rstRoot: string): void {
    fs.cpSync(STATIC_TEMPLATE_ROOT, path.join(rstRoot, '_static'), {
        recursive: true,
    })
}

export function writeRstBoilerplate(rstRoot: string, model: DocModel): void {
    writeStaticAssets(rstRoot)
    writeFile(path.join(rstRoot, 'conf.py'), renderRstTemplate(model, 'conf.py.ejs', {}))
}

export function writeRstTree(rstRoot: string, model: DocModel): void {
    fs.rmSync(rstRoot, { recursive: true, force: true })
    fs.mkdirSync(rstRoot, { recursive: true })
    writeRstBoilerplate(rstRoot, model)
    writeFile(path.join(rstRoot, 'index.rst'), renderRstTemplate(model, 'index.rst.ejs', {}))
    writeFile(
        path.join(rstRoot, `${model.network.pagePath}.rst`),
        renderRstTemplate(model, 'network.rst.ejs', {})
    )
    for (const role of model.network.roles) {
        writeFile(
            path.join(rstRoot, `${role.pagePath}.rst`),
            renderRstTemplate(model, 'role.rst.ejs', { role })
        )
    }
    writeFile(path.join(rstRoot, 'models.rst'), renderRstTemplate(model, 'models.rst.ejs', {}))
}
