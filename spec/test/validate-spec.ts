import { validate } from '../src/index'
import type { Spec } from '../src/types'

import spec from './chat-spec.json'

validate(spec as unknown as Spec)
console.log('spec is valid')
