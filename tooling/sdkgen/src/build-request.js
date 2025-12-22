const S = require('@pocketgems/schema')
const path = require('node:path')
const { cwd } = require('node:process')

const validateBuildRequest = S.obj({
    specPath: S.str,
    outputPath: S.str,
    project: S.str,
    service: S.str,
    hostRole: S.str,
    target: S.obj({
        csharp: S.obj({
            environment: S.str.enum('unity'), // aspnet
            frameworks: S.arr(S.str.enum('newtonsoft')).optional(),
        }).optional(),
        javascript: S.obj({
            environment: S.str.enum('node'), // browser
            frameworks: S.arr(S.str.enum('fastify')).optional(),
        }).optional(),
    }).min(1).max(1).desc('The target platform to generate code for'),
}).compile('BuildRequestValidator')

module.exports = function buildRequest(ctx) {
    const { rawInput } = ctx
    const request = {
        specPath: path.join(process.cwd(), rawInput.spec),
        outputPath: path.join(process.cwd(), rawInput.out),
        service: rawInput.service,
        project: rawInput.project,
        hostRole: rawInput.hostRole,
        target: {
            [rawInput.language]: {
                environment: rawInput.environment,
                frameworks: rawInput.frameworks,
            }
        }
    }
    validateBuildRequest(request)
    return {
        ...ctx,
        request
    }
}