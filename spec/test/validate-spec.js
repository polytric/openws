const specSchema = require("../index")
const spec = require('./chat-spec.json')

specSchema.validate(spec)
