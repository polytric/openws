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
        const assemblyName = `${pascalCase(request.project)}.${pascalCase(spec.name)}.${pascalCase(request.network)}.Sdk`
        // Assemblies used to be service-scoped with per-network subfolders; remove that
        // layout so regeneration migrates old output cleanly.
        const legacyAssemblyName = `${pascalCase(request.project)}.${pascalCase(spec.name)}.Sdk`
        const networkFolder = pascalCase(request.network)
        const outputRoot = request.packageName
            ? path.join(request.outputPath, 'Runtime')
            : request.outputPath
        const cleanupPaths = [
            path.join(outputRoot, assemblyName),
            path.join(outputRoot, `${assemblyName}.meta`),
            path.join(outputRoot, `${assemblyName}.User`),
            path.join(outputRoot, `${assemblyName}.User.meta`),
            path.join(outputRoot, legacyAssemblyName),
            path.join(outputRoot, `${legacyAssemblyName}.meta`),
            path.join(outputRoot, `${legacyAssemblyName}.User`),
            path.join(outputRoot, `${legacyAssemblyName}.User.meta`),
        ]

        if (request.packageName) {
            const legacyNetworkFolder = path.join(request.outputPath, networkFolder)
            const legacyAssemblyDefinition = path.join(
                request.outputPath,
                `${legacyAssemblyName}.asmdef`
            )
            cleanupPaths.push(
                path.join(request.outputPath, 'package.json'),
                path.join(request.outputPath, 'package.json.meta'),
                path.join(request.outputPath, 'README.md'),
                path.join(request.outputPath, 'README.md.meta'),
                path.join(request.outputPath, legacyAssemblyName),
                path.join(request.outputPath, `${legacyAssemblyName}.User`),
                legacyNetworkFolder,
                `${legacyNetworkFolder}.meta`,
                legacyAssemblyDefinition,
                `${legacyAssemblyDefinition}.meta`
            )
        }

        return cleanupPaths
    }

    return [path.join(request.outputPath, kebabCase(spec.name), kebabCase(request.network))]
}
