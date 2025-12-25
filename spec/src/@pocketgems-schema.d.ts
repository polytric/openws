declare module '@pocketgems/schema' {
    export interface Schema {
        jsonSchema(): any
        compile(name: string): (data: any) => void
        desc(description: string): Schema
        enum(...values: any[]): Schema
        min(value: number): Schema
        max(value: number): Schema
        optional(): Schema
        desc(description: string): Schema
        keyPattern(pattern?: string): Schema
        value(schema: Schema): Schema
        default(value: any): Schema
        additionalProperties?: boolean
    }
    
    export interface SchemaBuilder {
        obj(props?: any): Schema
        str: Schema
        int: Schema
        bool: Schema
        arr(item: Schema): Schema
        map: Schema
    }
    
    const S: SchemaBuilder
    export default S
}