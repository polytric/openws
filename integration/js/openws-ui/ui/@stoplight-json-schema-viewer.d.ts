// Type declaration for @stoplight/json-schema-viewer
// The package has types but exports field doesn't expose them properly
declare module '@stoplight/json-schema-viewer' {
    import { ComponentType } from 'react'

    export interface JsonSchemaViewerProps {
        schema: any
        defaultExpandedDepth?: number
        renderRootTreeLines?: boolean
        maxRefDepth?: number
        hideExamples?: boolean
        hideTopBar?: boolean
        emptyText?: string
        className?: string
    }

    export const JsonSchemaViewer: ComponentType<JsonSchemaViewerProps>
}

