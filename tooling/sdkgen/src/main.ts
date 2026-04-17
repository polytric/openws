#!/usr/bin/env node
import buildIr from './build-ir.js'
import dispatchBuildPlan from './build-plan.js'
import buildRequest from './build-request.js'
import executePlan from './execute-plan.js'
import loadSpec from './load-spec.js'
import parseInput from './parse-input.js'
import prepareOutput from './prepare-output.js'
import type { PipelineContext, PipelineStep } from './types.js'

const Pipeline: PipelineStep[] = [
    parseInput,
    buildRequest,
    loadSpec,
    prepareOutput,
    buildIr,
    dispatchBuildPlan,
    executePlan,
]

async function main(): Promise<PipelineContext> {
    let ctx: PipelineContext = { argv: process.argv }
    for (const step of Pipeline) {
        ctx = await step(ctx)
    }
    return ctx
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
