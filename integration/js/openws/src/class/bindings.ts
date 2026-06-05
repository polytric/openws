import * as Fluent from '../fluent'

import * as WS from './network'
import { HostRole, type HostRoleLikeCtor, type NetworkConfig, type RoleLikeCtor } from './types'
import { isHostRoleCtor, flattenRoles } from './utils'

/**
 * Optional host-role instances accepted by the class-first binding signature.
 */
export type HostRoleInstances = Record<string, unknown>

/**
 * Creates runtime bindings from class-first network configuration.
 *
 * This first normalizes the class config into the declarative network graph,
 * then registers each host handler method on the matching remote-role binder.
 * Use `runtime(bindings(config))` to materialize those bindings into sessions
 * or peer handles.
 */
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
                    binder.fromRoles[fromRoleName].on(handlerName, (payload, peer) =>
                        (hostRole as any)[handlerName](payload, peer)
                    )
                }
            }
        }
    }

    return binder
}
