export function toCamelCase(str: string): string {
    return (
        str
            // Normalize multiple delimiters to single space
            .replace(/[-_\s]+/g, ' ')
            // Insert space before uppercase that follows lowercase (getHTTP -> get HTTP)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            // Insert space before last capital in abbreviation sequence (HTTPRequest -> HTTP Request)
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            // Split, filter empty, and transform
            .split(/\s+/)
            .filter(Boolean)
            .map((word, index) => {
                const lower = word.toLowerCase()
                return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
            })
            .join('')
    )
}
