import type { SchemaObject } from 'ajv'

type PrimitiveValue = string | number | boolean | null
type JsonObject = { [key: string]: JsonValue }
export type JsonValue = PrimitiveValue | Array<JsonValue> | JsonObject

export interface CommonMetadata {
    name: string
    description?: string
    version?: string

    [key: string]: any
}

export interface Message extends CommonMetadata {
    payload: SchemaObject
    from?: string[]
}

export interface Endpoint {
    scheme: string
    host: string
    port: number
    path: string
}

export interface Role extends CommonMetadata {
    messages: { [key: string]: Message }
    endpoints?: Endpoint[]
}

export interface Network extends CommonMetadata {
    roles: { [key: string]: Role }
}

export interface Spec extends CommonMetadata {
    openws: string
    networks: { [key: string]: Network }
}
