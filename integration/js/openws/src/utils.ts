export function toCamelCase(name: string) {
    return name
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map(s => s.charAt(0).toLowerCase() + s.slice(1))
        .join('')
}
