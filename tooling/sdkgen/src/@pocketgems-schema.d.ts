declare module '@pocketgems/schema' {
    interface SchemaBuilder {
        optional(): SchemaBuilder
        enum(...values: string[]): SchemaBuilder
        min(n: number): SchemaBuilder
        max(n: number): SchemaBuilder
        desc(description: string): SchemaBuilder
        compile(name: string): (value: unknown) => void
    }

    interface SchemaStatic {
        str: SchemaBuilder
        int: SchemaBuilder
        bool: SchemaBuilder
        arr(item: SchemaBuilder): SchemaBuilder
        obj(shape: Record<string, SchemaBuilder>): SchemaBuilder
    }

    const S: SchemaStatic
    export default S
}
