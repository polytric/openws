import type { Message, Role } from '@polytric/openws-spec/types'

import { toCamelCase } from '../utils'

import { roleCache } from './store'
import type { RoleConfig } from './types'

/**
 * Marks a class as an OpenWS role in the decorator authoring style.
 *
 * The decorator records role metadata for later use by `network(config)` and
 * `bindings(config)`. Methods decorated with `@message` become outbound
 * messages; methods decorated with `@handler` make the role a host role.
 */
export function role(config: RoleConfig = {}) {
    return (target: any, context: ClassDecoratorContext) => {
        if (context.kind !== 'class') {
            throw new Error('role decorator can only be used on classes')
        }
        roleCache.set(target, {
            ...config,
            name: toCamelCase(config.name ?? target.name),
            messages: {} as { [key: string]: Message },
        } as Role)
    }
}
