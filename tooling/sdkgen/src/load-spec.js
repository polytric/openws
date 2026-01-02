module.exports = function loadSpec(ctx) {
    const { request } = ctx
    const { specPath } = request
    const spec = require(specPath)
    return {
        ...ctx,
        spec,
    }
}
