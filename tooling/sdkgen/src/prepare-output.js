const fs = require("node:fs");

// 1. Create / clear output directory
// 2. Load OpenWS spec
// 3. Generate plan
module.exports = function prepareOutput(ctx) {
    const { request } = ctx
    const { outputPath } = request
    fs.rmSync(outputPath, { recursive: true, force: true });
    fs.mkdirSync(outputPath, { recursive: true });
    return ctx
}