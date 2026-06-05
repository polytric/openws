import * as Fluent from '../fluent'

import type {
    HostRoleLikeCtor,
    RoleLikeCtor,
    RoleConfig,
    MessageConfig,
    NetworkConfig,
} from './types'
import { isHostRoleCtor, flattenRoles } from './utils'

/**
 * Copies common message metadata from class-first config into a fluent message.
 */
export function addCommonMetadata(message: Fluent.Message, messageConfig: MessageConfig) {
    const { description, payload, version, ...metadata } = messageConfig
    if (description) message.description(description)
    if (payload) message.payload(payload)
    if (version) message.version(version)

    for (const [key, value] of Object.entries(metadata)) {
        message.metadata(key, value as any)
    }
}

/**
 * Builds a declarative OpenWS network graph from class-first role config.
 *
 * The returned network is the normalized spec memory graph. It does not attach
 * runtime behavior by itself; pass the same config to `bindings(config)` when
 * you want host handler methods wired into a runtime binder.
 */
export function network(config: NetworkConfig): Fluent.Network {
    const { roles, name, description, version, ...metadata } = config

    const network = Fluent.network(name)
    if (description) network.description(description)
    if (version) network.version(version)
    for (const [key, value] of Object.entries(metadata ?? {})) {
        network.metadata(key, value as any)
    }

    // One loop to find all roles (not everything is flattened into a single array)
    const allRoles = flattenRoles(roles)

    // One loop to build the network spec
    for (const [roleName, roleCtor] of Object.entries(allRoles)) {
        const role = Fluent.role(roleName)

        if (isHostRoleCtor(roleCtor)) {
            role.asHost()
            const handlers = (roleCtor as HostRoleLikeCtor).CONFIG.handlers
            for (const [handlerName, handlerConfig] of Object.entries(handlers)) {
                const message = Fluent.message(handlerName)
                const { from, ...messageMetadata } = handlerConfig
                addCommonMetadata(message, messageMetadata)

                for (const f of from ?? []) {
                    message.from(f.CONFIG.name)
                }
                role.message(message)
            }
            for (const endpoint of roleCtor.CONFIG.endpoints ?? []) {
                role.endpoint(Fluent.endpoint(endpoint))
            }
        } else {
            const cfg = (roleCtor as RoleLikeCtor).CONFIG as RoleConfig
            for (const [messageName, messageConfig] of Object.entries(cfg.messages ?? {})) {
                const message = Fluent.message(messageName)
                addCommonMetadata(message, messageConfig)
                role.message(message)
            }
        }
        network.role(role)
    }
    return network
}
