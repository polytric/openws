import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { buildDocModel } from './model.js'
import { writeNativeHtmlDocs } from './render-html.js'
import { writeMarkdownDocs, writeMarkdownFromRstTree } from './render-markdown.js'
import { writeRstTree } from './render-rst.js'
import type { PipelineContext } from '../types.js'

function assertRstInput(inputPath: string): void {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`RST input directory does not exist: ${inputPath}`)
    }
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
    model: ReturnType<typeof buildDocModel>,
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

export default function generateDocs(ctx: PipelineContext): PipelineContext {
    const { request } = ctx
    if (!request) throw new Error('request is required')
    if (!request.rstOutputPath && !request.docOutputPath) return ctx

    const model = buildDocModel(ctx)
    const rstRoot =
        request.rstOutputPath ?? fs.mkdtempSync(path.join(os.tmpdir(), 'openws-sdkgen-rst-'))
    const shouldRemoveRstRoot = !request.rstOutputPath

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
                renderHtmlDocs(
                    renderRstRoot,
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
    }

    return ctx
}
