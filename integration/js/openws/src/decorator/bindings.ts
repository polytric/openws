import * as Fluent from '../fluent'

import * as WS from './network'
import { handlerCache, messageCache, roleCache } from './store'
import type { NetworkConfig } from './types'

export function bindings(config: NetworkConfig): Fluent.NetworkBinder {
    const network = WS.network(config)
    const binder = Fluent.bindings(network)

    const clientRoles: { [roleName: string]: any } = {}
    for (const [roleName, role] of Object.entries(network.roles)) {
        if (role.isHost) {
            continue
        }
        clientRoles[roleName] = role
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

            const from = messageConfig.from ?? Object.keys(clientRoles)
            for (const fromRoleName of from) {
                console.log('on', fromRoleName, messageConfig.name, descriptor.value.name)
                binder.fromRoles[fromRoleName].on(messageConfig.name, (payload, api) =>
                    (role as any)[descriptor.value.name](payload, api)
                )
            }
        }
    }

    return binder
}
