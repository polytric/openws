import { Endpoint, Spec } from '@polytric/openws-spec/types'

export type * from '@polytric/openws-spec/types'

export type JsonSchema = import('ajv').SchemaObject

// Pipeline context types
export interface PipelineContext {
    argv: string[]
    rawInput?: RawInput
    request?: BuildRequest
    spec?: Spec
    ir?: IR
    plan?: PlanStep[]
}

export interface RawInput {
    spec: string
    out: string
    project: string
    hostRole: string[]
    language: 'csharp' | 'javascript' | 'typescript'
    environment: 'unity' | 'node' | 'browser'
    frameworks?: string[]
}

export interface BuildRequest {
    specPath: string
    outputPath: string
    project: string
    hostRoles: string[]
    target: {
        csharp?: {
            environment: 'unity'
            frameworks?: string[]
        }
        javascript?: {
            environment: 'node' | 'browser'
            frameworks?: string[]
        }
        typescript?: {
            environment: 'node' | 'browser'
            frameworks?: string[]
        }
    }
}

// IR types
export interface IR {
    package: IRPackage
    networks: IRNetwork[]
    assemblyName?: string
}

export interface IRPackage {
    project: string
    service: string
    description?: string
    version?: string
}

export interface IRNetwork {
    name: string
    description?: string
    version?: string
    roles: IRRole[]
    handlers: IRHandler[]
    messages: IRMessage[]
    models: IRModel[]
}

export interface IRRole {
    name: string
    description?: string
    isHost: boolean
    endpoints: Endpoint[]
}

export interface IRHandler {
    roleName: string
    handlerName: string
    description?: string
    modelClassName?: string
    messageName?: string
    methodName?: string
}

export interface IRMessage {
    roleName: string
    handlerName: string
    description?: string
    modelClassName?: string
    messageName?: string
    methodName?: string
}

export interface IRModel {
    scopeName: string
    modelName: string
    type: string
    description?: string
    properties?: IRProperty[]
    namespace?: string
    className?: string
}

export interface IRProperty {
    type: string
    scopeName: string
    modelName: string
    description?: string
    required?: boolean
    items?: {
        type: string
        scopeName: string
        modelName: string
        description?: string
    }
    propertyName?: string
    typeName?: string
}

// Plan types
export interface PlanStep {
    name: string
    command: 'copy' | 'render'
    input?: string
    output: string
    template?: string
    getData?: () => unknown
}

export type PipelineStep = (ctx: PipelineContext) => PipelineContext | Promise<PipelineContext>
