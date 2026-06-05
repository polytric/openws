import { toCamelCase } from '../utils'

import { messageCache, handlerCache } from './store'
import type { MessageConfig } from './types'

/**
 * Creates the shared method decorator used by `message` and `handler`.
 */
function getDecorator(cache: Map<any, any>, config: MessageConfig) {
    return (fn: (...args: any[]) => any, context: ClassMethodDecoratorContext) => {
        if (context.kind !== 'method') {
            throw new Error('message decorator can only be used on methods')
        }
        if (context.static) {
            throw new Error('message decorator can only be used on instance methods')
        }
        if (context.private) {
            throw new Error('message decorator can only be used on public methods')
        }

        const { from, ...messageConfig } = config
        const arrayFrom = (from instanceof Array ? from : [from])
            .map(f => {
                if (typeof f === 'string') {
                    return f
                }
                if (f?.name) {
                    return toCamelCase(f!.name)
                }
                return undefined
            })
            .filter(Boolean)

        cache.set(fn, {
            ...messageConfig,
            name: toCamelCase(messageConfig.name ?? fn.name),
            from: arrayFrom,
        })
    }
}

/**
 * Marks a public instance method as an outbound message for a decorated role.
 *
 * The method body is not called by the runtime; it acts as a convenient place
 * to declare the message name, payload schema, and metadata that will become
 * part of the network spec.
 */
export function message(config: MessageConfig = {}) {
    return getDecorator(messageCache, config)
}

/**
 * Marks a public instance method as an inbound host handler.
 *
 * `bindings(config)` instantiates the host role and wires this method into the
 * matching remote-role binders. The optional `from` field restricts which roles
 * may send the message.
 */
export function handler(config: MessageConfig = {}) {
    return getDecorator(handlerCache, config)
}
