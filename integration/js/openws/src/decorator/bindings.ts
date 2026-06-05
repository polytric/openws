import * as Fluent from '../fluent'

import * as WS from './network'
import { handlerCache, messageCache, roleCache } from './store'
import type { NetworkConfig } from './types'

/**
 * Creates runtime bindings from decorator-style network configuration.
 *
 * This reads the metadata recorded by `@role`, `@message`, and `@handler`,
 * builds the normalized network graph, and registers decorated host handler
 * methods on the appropriate remote-role binders.
 */
export function bindings(config: NetworkConfig): Fluent.NetworkBinder {
    const network = WS.network(config)
    const binder = Fluent.bindings(network)

    const remoteRoles: { [roleName: string]: any } = {}
    for (const [roleName, role] of Object.entries(network.roles)) {
        if (role.isHost) {
            continue
        }
        remoteRoles[roleName] = role
    }

    for (const roleCtor of config.roles) {
        const role = new roleCtor()
        const roleConfig = roleCache.get(roleCtor)!
        if (!network.roles[roleConfig.name].isHost) {
            continue
        }
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

            const from = messageConfig.from ?? Object.keys(remoteRoles)
            for (const fromRoleName of from) {
                binder.fromRoles[fromRoleName].on(messageConfig.name, (payload, peer) =>
                    (role as any)[descriptor.value.name](payload, peer)
                )
            }
        }
    }

    return binder
}
