import type { Message, Role } from '@polytric/openws-spec/types'

import { toCamelCase } from '../utils'

import { roleCache } from './store'
import type { RoleConfig } from './types'

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
