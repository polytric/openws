import type { Message, Role } from '@polytric/openws-spec/types'

export const roleCache = new Map<any, Role>()
export const messageCache = new Map<any, Message>()
export const handlerCache = new Map<any, Message>()
