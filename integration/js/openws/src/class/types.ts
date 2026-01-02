import type { SchemaObject, ValidateFunction } from 'ajv'

import type { Endpoint } from '@polytric/openws-spec/types'

export type AnyCtor = abstract new (...args: any[]) => unknown

export type CommonRoleConfig = {
    name: string
    description?: string
    version?: string
}

export type MessageConfig = {
    name?: string
    description?: string
    version?: string
    payload: SchemaObject
}

export type RoleConfig = CommonRoleConfig & {
    messages: Record<string, MessageConfig>
}

export type HandlerConfig = MessageConfig & {
    /** Which roles are allowed to send this inbound message */
    from?: RoleLikeCtor[]
}

export type HostRoleConfig = CommonRoleConfig & {
    handlers: Record<string, HandlerConfig>
    endpoints?: Endpoint[]
}

export type RoleLikeCtor = {
    new (...args: any[]): unknown
    CONFIG: RoleConfig
}

export type HostRoleLikeCtor = {
    new (...args: any[]): unknown
    CONFIG: HostRoleConfig
}

export type NetworkConfig = CommonRoleConfig & {
    roles: (RoleLikeCtor | HostRoleLikeCtor)[]
}

export type DispatchEntry = {
    toHostRole: string
    handlerName: string
    fromAllowed?: Set<string>
    validator: ValidateFunction
    invoke: (fromRole: string, payload: any, api: any) => Promise<void>
}

export class Role {
    static CONFIG: RoleConfig = {
        name: this.name,
        messages: {},
    }
}

export class HostRole {
    static CONFIG: HostRoleConfig = {
        name: this.name,
        handlers: {},
    }
}

/** =========================
 *  Api<T> typing helper
 *  ========================= */

type ConfigOf<T> = T extends { CONFIG: infer C } ? C : never

export type Api<T extends { CONFIG: any }> =
    ConfigOf<T> extends { messages: infer M extends Record<string, any> }
        ? { [K in keyof M & string]: (payload: any) => Promise<void> }
        : never
