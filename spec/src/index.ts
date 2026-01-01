import pkg from '../package.json'

import specSchemaValidator from './spec-schema'

export const VERSION = pkg.version

export { default as specSchema } from './spec-schema.json'

let validator: (spec: any) => void

export function validate(spec: any): void {
    validator = validator ?? specSchemaValidator.compile('Validator')
    validator(spec)
}
