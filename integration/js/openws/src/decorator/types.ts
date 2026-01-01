import type { SchemaObject } from 'ajv'

import type { Endpoint } from '@polytric/openws-spec/builder'

export type MessageConfig = {
    name?: string
    description?: string
    payload?: SchemaObject
    from?: string | { name: string } | (string | { name: string })[]
}

export type RoleConfig = {
    name?: string
    description?: string
    version?: string
    endpoints?: Endpoint[]
}

export type NetworkConfig = {
    name: string
    description?: string
    version?: string
    roles: any[]
}
