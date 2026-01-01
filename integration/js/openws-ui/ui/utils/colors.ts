// Generate consistent, light pastel colors from strings (like Swagger)
export function stringToColor(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash // Convert to 32bit integer
    }

    // Generate HSL with light, desaturated colors
    const hue = Math.abs(hash % 360)
    const saturation = 45 + (Math.abs(hash) % 20) // 45-65%
    const lightness = 92 // Very light for backgrounds

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function stringToBorderColor(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash
    }

    const hue = Math.abs(hash % 360)
    const saturation = 55 + (Math.abs(hash) % 25) // 55-80%
    const lightness = 60 // Medium for borders

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function getEnvBgColor(isProduction: boolean): string {
    return isProduction ? 'rgba(148, 20, 171, 0.06)' : 'rgba(180, 224, 181, 0.18)'
}

// Subtle gray background for role accordions
// Adjust the alpha value (0-1) to control subtlety: lower = more subtle, higher = more visible
export const ROLE_BG_COLOR = 'rgba(147, 147, 147, 0.1)'
