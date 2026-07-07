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
        // The scoped <out>/<service>/<network>/ directory is fully generated, so it can
        // be removed wholesale. Everything else below migrates legacy layouts that wrote
        // directly into the output path.
        const packageRootPath = path.join(
            request.outputPath,
            kebabCase(spec.name),
            kebabCase(request.network)
        )
        const cleanupPaths = [packageRootPath, `${packageRootPath}.meta`]

        const assemblyName = `${pascalCase(request.project)}.${pascalCase(spec.name)}.${pascalCase(request.network)}.Sdk`
        const legacyAssemblyName = `${pascalCase(request.project)}.${pascalCase(spec.name)}.Sdk`
        if (request.packageName) {
            const legacyNetworkFolder = path.join(request.outputPath, pascalCase(request.network))
            const legacyAssemblyDefinition = path.join(
                request.outputPath,
                `${legacyAssemblyName}.asmdef`
            )
            cleanupPaths.push(
                path.join(request.outputPath, 'package.json'),
                path.join(request.outputPath, 'package.json.meta'),
                path.join(request.outputPath, 'README.md'),
                path.join(request.outputPath, 'README.md.meta'),
                path.join(request.outputPath, 'Runtime'),
                path.join(request.outputPath, 'Runtime.meta'),
                legacyNetworkFolder,
                `${legacyNetworkFolder}.meta`,
                legacyAssemblyDefinition,
                `${legacyAssemblyDefinition}.meta`
            )
        } else {
            for (const legacy of [assemblyName, legacyAssemblyName]) {
                cleanupPaths.push(
                    path.join(request.outputPath, legacy),
                    path.join(request.outputPath, `${legacy}.meta`),
                    path.join(request.outputPath, `${legacy}.User`),
                    path.join(request.outputPath, `${legacy}.User.meta`)
                )
            }
        }

        return cleanupPaths
    }

    return [path.join(request.outputPath, kebabCase(spec.name), kebabCase(request.network))]
}
