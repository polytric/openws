declare module 'yargs' {
    interface Options {
        type?: 'string' | 'array' | 'boolean' | 'number' | 'count'
        string?: boolean
        description?: string
        demandOption?: boolean
        choices?: readonly string[]
        default?: unknown
    }

    interface Argv<T = object> {
        scriptName(name: string): Argv<T>
        version(version: string | false): Argv<T>
        option<K extends string>(key: K, options: Options): Argv<T>
        strict(): Argv<T>
        help(): Argv<T>
        parseSync(): T
    }

    function yargs(args: string[]): Argv
    export default yargs
}

declare module 'yargs/helpers' {
    export function hideBin(argv: string[]): string[]
}
