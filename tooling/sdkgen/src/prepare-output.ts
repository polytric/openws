import fs from 'node:fs'
import path from 'node:path'

import type { PipelineContext } from './types.js'

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

export default function prepareOutput(ctx: PipelineContext): PipelineContext {
    const { request, spec } = ctx
    if (!request) throw new Error('request is required')
    if (!spec) throw new Error('spec is required')

    if (!spec.networks[request.network]) {
        throw new Error(`Network "${request.network}" does not exist in the spec`)
    }

    const cleanupPaths = getNetworkOutputPaths(ctx)
    for (const cleanupPath of cleanupPaths) {
        fs.rmSync(cleanupPath, { recursive: true, force: true })
    }
    fs.mkdirSync(request.outputPath, { recursive: true })

    return ctx
}

function getNetworkOutputPaths(ctx: PipelineContext): string[] {
    const { request, spec } = ctx
    if (!request) throw new Error('request is required')
    if (!spec) throw new Error('spec is required')

    if (request.target.csharp) {
        const assemblyName = `${pascalCase(request.project)}.${pascalCase(spec.name)}.Sdk`
        const networkFolder = pascalCase(request.network)
        return [path.join(request.outputPath, assemblyName, networkFolder)]
    }

    return [path.join(request.outputPath, 'src', kebabCase(request.network))]
}
