import type { SchemaObject } from 'ajv'

import type { Endpoint } from '@polytric/openws-spec/builder'

/**
 * Decorator metadata for a role method.
 *
 * `@message` uses this to declare outbound messages on a remote role.
 * `@handler` uses the same shape to declare inbound host messages.
 */
export type MessageConfig = {
    name?: string
    description?: string
    payload?: SchemaObject
    from?: string | { name: string } | (string | { name: string })[]
}

/**
 * Decorator metadata for a role class.
 */
export type RoleConfig = {
    name?: string
    description?: string
    version?: string
    endpoints?: Endpoint[]
}

/**
 * Decorator-style network configuration.
 *
 * `network(config)` reads the metadata recorded by `@role`, `@message`, and
 * `@handler`. `bindings(config)` uses the same metadata to attach host handler
 * behavior to the runtime binder.
 */
export type NetworkConfig = {
    name: string
    description?: string
    version?: string
    roles: any[]
}
