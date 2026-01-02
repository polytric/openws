const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')

module.exports = function parseInput(ctx) {
    const args = yargs(hideBin(ctx.argv))
        .scriptName('sdkgen')
        .version(false)
        .option('spec', {
            type: 'string',
            description: 'The path to the OpenWS spec file',
        })
        .option('out', {
            type: 'string',
            description: 'The path to the output directory',
        })
        .option('project', {
            type: 'string',
            description: 'The path to the project directory',
        })
        .option('hostRole', {
            type: 'array',
            description: 'The target participant roles that use the generated code',
        })
        .option('language', {
            type: 'string',
            description: 'The language to generate code for',
            choices: ['csharp', 'javascript'],
            default: 'csharp',
        })
        .option('environment', {
            type: 'string',
            description: 'The environments to generate code for',
            choices: ['unity', 'node', 'browser'],
            default: ['unity'],
        })
        .option('frameworks', {
            type: 'array',
            description: 'The frameworks to generate code for',
            choices: ['fastify', 'newtonsoft'],
        })
        .strict()
        .help()
        .parse()

    return {
        ...ctx,
        rawInput: args,
    }
}
