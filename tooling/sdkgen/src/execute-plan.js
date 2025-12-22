const fs = require('node:fs')
const path = require('node:path')
const ejs = require('ejs')

const rendererCache = {}

function renderTemplate(templatePath, data) {
    if (rendererCache[templatePath]) {
        return rendererCache[templatePath](data)
    }
    const templateContent = fs.readFileSync(templatePath, 'utf8')
    const renderer = ejs.compile(templateContent)
    rendererCache[templatePath] = renderer
    return renderer(data)
}

function executePlan(ctx) {
    const { plan } = ctx
    for (const step of plan) {
        switch (step.command) {
            case 'copy':
                fs.cpSync(step.input, step.output, { recursive: true })
                break
            case 'render':
                const { getData, template, output } = step
                const data = getData()
                fs.mkdirSync(path.dirname(output), { recursive: true, force: true })
                fs.writeFileSync(output, renderTemplate(template, { ctx: data }))
                break
        }
    }
    return ctx
}

module.exports = executePlan