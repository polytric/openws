export function toPascalCase(name: string): string {
    return name
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join('')
}

declare const __UI_VERSION__: string
