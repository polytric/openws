import * as Fluent from '../fluent'

import * as WS from './network'
import { HostRole, type HostRoleLikeCtor, type NetworkConfig, type RoleLikeCtor } from './types'
import { isHostRoleCtor, flattenRoles } from './utils'

export type HostRoleInstances = Record<string, unknown>

export function bindings(
    config: NetworkConfig,
    hostRoleInstances: HostRoleInstances = {}
): Fluent.NetworkBinder {
    const binder = Fluent.bindings(WS.network(config))

    const remoteRoles: Record<string, RoleLikeCtor> = {}

    const allRoles = Object.values(flattenRoles(config.roles))
    for (const role of allRoles) {
        if (!isHostRoleCtor(role)) {
            remoteRoles[role.CONFIG.name] = role
        }
    }

    for (const role of allRoles) {
        if (isHostRoleCtor(role)) {
            const hostRole = new (role as HostRoleLikeCtor)()
            for (const [handlerName, handlerConfig] of Object.entries(role.CONFIG.handlers)) {
                const from = handlerConfig.from
                    ? handlerConfig.from.map(r => r.CONFIG.name)
                    : Object.keys(remoteRoles)
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
