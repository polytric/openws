import * as Fluent from '../fluent'

import * as WS from './network'
import type { HostRoleLikeCtor, NetworkConfig, RoleLikeCtor } from './types'
import { isHostRoleCtor, flattenRoles } from './utils'

export function bindings(config: NetworkConfig): Fluent.NetworkBinder {
    const binder = Fluent.bindings(WS.network(config))

    const clientRoles: Record<string, RoleLikeCtor> = {}

    const allRoles = Object.values(flattenRoles(config.roles))
    for (const role of allRoles) {
        if (!isHostRoleCtor(role)) {
            clientRoles[role.CONFIG.name] = role
        }
    }

    for (const role of allRoles) {
        if (isHostRoleCtor(role)) {
            const hostRole = new (role as HostRoleLikeCtor)()
            for (const [handlerName, handlerConfig] of Object.entries(role.CONFIG.handlers)) {
                const from = handlerConfig.from
                    ? handlerConfig.from.map(r => r.CONFIG.name)
                    : Object.keys(clientRoles)
                for (const fromRoleName of from) {
                    binder.fromRoles[fromRoleName].on(handlerName, (payload, api) =>
                        (hostRole as any)[handlerName](payload, api)
                    )
                }
            }
        }
    }

    return binder
}
