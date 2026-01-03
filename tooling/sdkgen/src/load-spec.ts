import fs from 'node:fs'

import type { OpenWsSpec, PipelineContext } from './types.js'

export default function loadSpec(ctx: PipelineContext): PipelineContext {
    const { request } = ctx
    if (!request) throw new Error('request is required')

    const { specPath } = request
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as OpenWsSpec

    return {
        ...ctx,
        spec,
    }
}
