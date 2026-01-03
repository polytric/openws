import path from 'node:path'
import process from 'node:process'

import S from '@pocketgems/schema'

import type { BuildRequest, PipelineContext } from './types.js'

const validateBuildRequest = S.obj({
    specPath: S.str,
    outputPath: S.str,
    project: S.str,
    hostRoles: S.arr(S.str),
    target: S.obj({
        csharp: S.obj({
            environment: S.str.enum('unity'),
            frameworks: S.arr(S.str.enum('newtonsoft')).optional(),
        }).optional(),
        javascript: S.obj({
            environment: S.str.enum('node', 'browser'),
            frameworks: S.arr(S.str.enum('fastify')).optional(),
        }).optional(),
    })
        .min(1)
        .max(1)
        .desc('The target platform to generate code for'),
}).compile('BuildRequestValidator')

export default function buildRequest(ctx: PipelineContext): PipelineContext {
    const { rawInput } = ctx
    if (!rawInput) throw new Error('rawInput is required')

    console.log('Host roles:', rawInput.hostRole)

    const request: BuildRequest = {
        specPath: path.join(process.cwd(), rawInput.spec),
        outputPath: path.join(process.cwd(), rawInput.out),
        project: rawInput.project,
        hostRoles: rawInput.hostRole,
        target: {
            [rawInput.language]: {
                environment: rawInput.environment,
                frameworks: rawInput.frameworks,
            },
        },
    }

    validateBuildRequest(request)

    return {
        ...ctx,
        request,
    }
}
