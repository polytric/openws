const path = require('node:path')

const planIndex = {
    'csharp': {
        'unity': '../dotnet/build-plan.js',
    }
}

module.exports = function dispatchBuildPlan(ctx) {
    const { request } = ctx
    const language = Object.keys(request.target)[0]
    const environment = request.target[language].environment
    const templatePath = planIndex[language][environment]
    const plan = require(path.join(__dirname, templatePath))
    return plan(ctx)
}