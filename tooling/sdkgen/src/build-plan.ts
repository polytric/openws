import dotnetPlan from './dotnet/build-plan.js'
import type { PipelineContext } from './types.js'

const planIndex: Record<string, Record<string, typeof dotnetPlan>> = {
    csharp: {
        unity: dotnetPlan,
    },
}

export default function dispatchBuildPlan(ctx: PipelineContext): PipelineContext {
    const { request } = ctx
    if (!request) throw new Error('request is required')

    const language = Object.keys(request.target)[0]
    const targetConfig = request.target[language as keyof typeof request.target]
    if (!targetConfig) throw new Error(`No target config for language: ${language}`)

    const environment = targetConfig.environment
    const plan = planIndex[language]?.[environment]
    if (!plan) throw new Error(`No plan for ${language}/${environment}`)

    return plan(ctx)
}
