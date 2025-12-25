import specSchemaJson from './spec-schema.json'
import specSchemaValidator from './spec-schema'
import { WS } from './builder'

let validator: (spec: Record<string, any>) => void

export const specSchema = specSchemaJson

export function validate(spec: Record<string, any>): void {
    validator = validator ?? specSchemaValidator.compile('Validator')
    validator(spec)
}

export { WS }
