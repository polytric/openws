import path from 'node:path'
import process from 'node:process'

import S from '@pocketgems/schema'

import type { BuildRequest, PipelineContext } from './types.js'
import { toCamelCase } from './utils.js'

const validateBuildRequest = S.obj({
    specPath: S.str,
    outputPath: S.str,
    project: S.str,
    network: S.str,
    hostRoles: S.arr(S.str),
    packageName: S.str.optional(),
    rstInputPath: S.str.optional(),
    rstOutputPath: S.str.optional(),
    docOutputPath: S.str.optional(),
    docFormat: S.str.enum('html', 'markdown').optional(),
    target: S.obj({
        csharp: S.obj({
            environment: S.str.enum('unity'),
            frameworks: S.arr(S.str.enum('newtonsoft')).optional(),
        }).optional(),
        javascript: S.obj({
            environment: S.str.enum('node', 'browser'),
            frameworks: S.arr(S.str.enum('fastify')).optional(),
        }).optional(),
        typescript: S.obj({
            environment: S.str.enum('node', 'browser'),
            frameworks: S.arr(S.str.enum('fastify')).optional(),
        }).optional(),
    })
        .min(1)
        .max(1)
        .desc('The target platform to generate code for'),
}).compile('BuildRequestValidator')

function optionalPath(value: string | undefined): string | undefined {
    const trimmed = value?.trim()
    return trimmed ? path.resolve(process.cwd(), trimmed) : undefined
}

function requiredPath(value: string): string {
    return path.resolve(process.cwd(), value)
}

export default function buildRequest(ctx: PipelineContext): PipelineContext {
    const { rawInput } = ctx
    if (!rawInput) throw new Error('rawInput is required')

    const packageName = rawInput.packageName?.trim()
    const rstInputPath = optionalPath(rawInput.rstIn)
    const rstOutputPath = optionalPath(rawInput.rstOut)
    const docOutputPath = optionalPath(rawInput.docOut)
    const request: BuildRequest = {
        specPath: requiredPath(rawInput.spec),
        outputPath: requiredPath(rawInput.out),
        project: rawInput.project,
        network: toCamelCase(rawInput.network),
        hostRoles: rawInput.hostRole.map(r => toCamelCase(r)),
        ...(packageName ? { packageName } : {}),
        ...(rstInputPath ? { rstInputPath } : {}),
        ...(rstOutputPath ? { rstOutputPath } : {}),
        ...(docOutputPath ? { docOutputPath } : {}),
        ...(docOutputPath ? { docFormat: rawInput.docFormat ?? 'html' } : {}),
        target: {
            [rawInput.language]: {
                environment: rawInput.environment,
                frameworks: rawInput.frameworks,
            },
        },
    }

    validateBuildRequest(request)
    if (rawInput.docFormat && !request.docOutputPath) {
        throw new Error('--doc-format requires --doc-out')
    }
    if (request.rstInputPath && !request.rstOutputPath && !request.docOutputPath) {
        throw new Error('--rst-in requires --rst-out or --doc-out')
    }

    return {
        ...ctx,
        request,
    }
}
