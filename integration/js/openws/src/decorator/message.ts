import { toCamelCase } from '../utils'

import { messageCache, handlerCache } from './store'
import type { MessageConfig } from './types'

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

export function message(config: MessageConfig = {}) {
    return getDecorator(messageCache, config)
}

export function handler(config: MessageConfig = {}) {
    return getDecorator(handlerCache, config)
}
