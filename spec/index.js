const spec = require('./spec')

let validator

module.exports = {
    spec: require('./spec.json'),
    validate: (schema) => {
        validator = validator ?? spec.compile('Validator')
        validator(schema)
    }
}
