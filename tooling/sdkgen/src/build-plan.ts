import type { PipelineContext } from './types.js'

type Plan = (ctx: PipelineContext) => PipelineContext

const planIndex: Record<string, Record<string, string>> = {
    csharp: {
        unity: './plans/dotnet.js',
    },
}

export default async function dispatchBuildPlan(ctx: PipelineContext): Promise<PipelineContext> {
    const { request } = ctx
    if (!request) throw new Error('request is required')

    const language = Object.keys(request.target)[0]
    const targetConfig = request.target[language as keyof typeof request.target]
    if (!targetConfig) throw new Error(`No target config for language: ${language}`)

    const environment = targetConfig.environment
    const planPath = planIndex[language]?.[environment]
    if (!planPath) throw new Error(`No plan for ${language}/${environment}`)

    // Dynamic import keeps plans as separate bundles with correct __dirname
    const { default: plan } = (await import(planPath)) as { default: Plan }
    return plan(ctx)
}
