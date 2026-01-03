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
    prepareOutput,
    loadSpec,
    buildIr,
    dispatchBuildPlan,
    executePlan,
]

function main(): PipelineContext {
    return Pipeline.reduce<PipelineContext>((acc, step) => step(acc), { argv: process.argv })
}

console.log(JSON.stringify(main(), null, 2))
