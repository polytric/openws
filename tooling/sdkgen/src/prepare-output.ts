import fs from 'node:fs'

import type { PipelineContext } from './types.js'

export default function prepareOutput(ctx: PipelineContext): PipelineContext {
    const { request } = ctx
    if (!request) throw new Error('request is required')

    const { outputPath } = request
    fs.rmSync(outputPath, { recursive: true, force: true })
    fs.mkdirSync(outputPath, { recursive: true })

    return ctx
}
