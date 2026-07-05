import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import type { PipelineContext, RawInput } from './types.js'

export default function parseInput(ctx: PipelineContext): PipelineContext {
    const args = yargs(hideBin(ctx.argv))
        .scriptName('openws-sdkgen')
        .version(false)
        .option('spec', {
            type: 'string',
            description: 'The path to the OpenWS spec file',
            demandOption: true,
        })
        .option('out', {
            type: 'string',
            description: 'The path to the output directory',
            demandOption: true,
        })
        .option('project', {
            type: 'string',
            description: 'The project name',
            demandOption: true,
        })
        .option('network', {
            type: 'string',
            description: 'The network to be generated',
            demandOption: true,
        })
        .option('hostRole', {
            type: 'array',
            string: true,
            description: 'The target peer roles that use the generated code',
            demandOption: true,
        })
        .option('package-name', {
            type: 'string',
            description: 'Generate a package manifest with this package name',
        })
        .option('rst-in', {
            type: 'string',
            description: 'Optional RST source directory to use as the rendered docs input',
        })
        .option('rst-out', {
            type: 'string',
            description: 'Optional output directory for the generated RST source tree',
        })
        .option('doc-out', {
            type: 'string',
            description: 'Optional output directory for rendered documentation',
        })
        .option('doc-format', {
            type: 'string',
            description: 'Rendered documentation format',
            choices: ['html', 'markdown'] as const,
        })
        .option('language', {
            type: 'string',
            description: 'The language to generate code for',
            choices: ['csharp', 'javascript', 'typescript'] as const,
            default: 'csharp' as const,
        })
        .option('environment', {
            type: 'string',
            description: 'The environment to generate code for',
            choices: ['unity', 'node', 'browser'] as const,
            default: 'unity' as const,
        })
        .option('frameworks', {
            type: 'array',
            string: true,
            description: 'The frameworks to generate code for',
            choices: ['fastify', 'newtonsoft'],
        })
        .strict()
        .help()
        .parseSync()

    return {
        ...ctx,
        rawInput: args as unknown as RawInput,
    }
}
