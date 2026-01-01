// Type declaration for esbuild's ?inline CSS imports
declare module '*.css?inline' {
    const content: string
    export default content
}

