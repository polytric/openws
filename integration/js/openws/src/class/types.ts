import type { SchemaObject, ValidateFunction } from 'ajv'

import type { Endpoint } from '@polytric/openws-spec/types'

export type AnyCtor = abstract new (...args: any[]) => unknown

/**
 * Metadata shared by class-first network and role declarations.
 */
export type CommonRoleConfig = {
    name: string
    description?: string
    version?: string
}

/**
 * Declares a message in the class-first role model.
 *
 * Remote roles use messages as outbound methods. Host roles use handler
 * configs, which extend this shape, to declare inbound messages.
 */
export type MessageConfig = {
    name?: string
    description?: string
    version?: string
    payload: SchemaObject
}

/**
 * Class-first configuration for a remote role.
 *
 * Each key in `messages` becomes an outbound method on the connected peer
 * handle that the host can call when handling a connection from that role.
 */
export type RoleConfig = CommonRoleConfig & {
    messages: Record<string, MessageConfig>
}

/**
 * Class-first configuration for an inbound host handler.
 */
export type HandlerConfig = MessageConfig & {
    /** Which roles are allowed to send this inbound message */
    from?: RoleLikeCtor[]
}

/**
 * Class-first configuration for a host role.
 *
 * Host role handlers become messages that remote roles may send to the host.
 * Endpoints are copied into the normalized network spec for adapters and
 * tooling.
 */
export type HostRoleConfig = CommonRoleConfig & {
    handlers: Record<string, HandlerConfig>
    endpoints?: Endpoint[]
}

/**
 * Constructor for a class-first remote role.
 */
export type RoleLikeCtor = {
    new (...args: any[]): unknown
    CONFIG: RoleConfig
}

/**
 * Constructor for a class-first host role.
 */
export type HostRoleLikeCtor = {
    new (...args: any[]): unknown
    CONFIG: HostRoleConfig
}

/**
 * Class-first network configuration.
 *
 * `network(config)` turns this into a declarative OpenWS network graph.
 * `bindings(config)` attaches host-role handler methods to that graph and
 * returns a fluent `NetworkBinder`.
 */
export type NetworkConfig = CommonRoleConfig & {
    roles: (RoleLikeCtor | HostRoleLikeCtor)[]
}

export type DispatchEntry = {
    toHostRole: string
    handlerName: string
    fromAllowed?: Set<string>
    validator: ValidateFunction
    invoke: (fromRole: string, payload: any, peer: any) => Promise<void>
}

export class Role {
    static CONFIG: RoleConfig = {
        name: this.name,
        messages: {},
    }
}

/**
 * Base class for class-first host roles.
 *
 * Extend this when a role owns inbound handlers that remote roles send to.
 */
export class HostRole {
    static CONFIG: HostRoleConfig = {
        name: this.name,
        handlers: {},
    }
}

/** =========================
 *  Peer<T> typing helper
 *  ========================= */

type ConfigOf<T> = T extends { CONFIG: infer C } ? C : never

/**
 * Type helper for a connected class-first peer role constructor.
 *
 * `Peer<typeof Client>` maps the messages declared on
 * `Client.CONFIG.messages` to async methods available inside host handlers.
 */
export type Peer<T extends { CONFIG: any }> =
    ConfigOf<T> extends { messages: infer M extends Record<string, any> }
        ? { [K in keyof M & string]: (payload: any) => Promise<void> }
        : never
