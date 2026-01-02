const path = require('node:path')
const { cwd } = require('node:process')

const S = require('@pocketgems/schema')

const validateBuildRequest = S.obj({
    specPath: S.str,
    outputPath: S.str,
    project: S.str,
    hostRoles: S.arr(S.str),
    target: S.obj({
        csharp: S.obj({
            environment: S.str.enum('unity'), // aspnet
            frameworks: S.arr(S.str.enum('newtonsoft')).optional(),
        }).optional(),
        javascript: S.obj({
            environment: S.str.enum('node'), // browser
            frameworks: S.arr(S.str.enum('fastify')).optional(),
        }).optional(),
    })
        .min(1)
        .max(1)
        .desc('The target platform to generate code for'),
}).compile('BuildRequestValidator')

module.exports = function buildRequest(ctx) {
    const { rawInput } = ctx
    console.log(rawInput.hostRole)
    const request = {
        specPath: path.join(process.cwd(), rawInput.spec),
        outputPath: path.join(process.cwd(), rawInput.out),
        project: rawInput.project,
        hostRoles: rawInput.hostRole, // naming oddity from cli --hostRole serverA --hostRole serverB is readable as singular hostRole
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
