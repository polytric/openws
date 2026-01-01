import type { Message } from '@polytric/openws-spec/types'

import * as Fluent from '../fluent'

import { handlerCache, messageCache, roleCache } from './store'
import type { NetworkConfig } from './types'

function addCommonMetadata(
    base: Fluent.Base,
    config: { description?: string; version?: string; [key: string]: any }
) {
    const { description, version, ...metadata } = config
    if (description) base.description(description)
    if (version) base.version(version)
    for (const [key, value] of Object.entries(metadata ?? {})) {
        base.metadata(key, value as any)
    }
}

export function network(config: NetworkConfig): Fluent.Network {
    const { roles, name, ...metadata } = config

    const network = Fluent.network(name)
    addCommonMetadata(network, metadata)

    // One loop to find all roles (not everything is flattened into a single array)
    for (const roleCtor of roles) {
        const roleConfig = roleCache.get(roleCtor)!

        const roleName = roleConfig.name
        const role = Fluent.role(roleName)
        network.role(role)
        addCommonMetadata(role, roleConfig)
        for (const key of Object.getOwnPropertyNames(roleCtor.prototype)) {
            const descriptor = Object.getOwnPropertyDescriptor(roleCtor.prototype, key)
            if (!descriptor?.value || !(descriptor.value instanceof Function)) {
                continue
            }
            const messageConfig =
                messageCache.get(descriptor.value) ?? handlerCache.get(descriptor.value)
            if (!messageConfig) {
                // not a message or handler (no decorator applied)
                continue
            }

            const message = Fluent.message(messageConfig.name)
            const { payload, from, ...messageMetadata } = messageConfig
            addCommonMetadata(message, messageMetadata)
            message.from(...(from as string[]))
            if (payload) {
                message.payload(payload)
            } else {
                message.payload({})
            }
            role.message(message)
            role.isHost = handlerCache.has(descriptor.value)
            roleConfig.messages[messageConfig.name] = message.valueOf()
        }
    }

    return network
}
