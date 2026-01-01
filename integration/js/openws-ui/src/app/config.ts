export type OpenWsUiConfig = {
    specUrl: string
}

export function readOpenWsUiConfig(): OpenWsUiConfig {
    const el = document.getElementById('openws-config')
    if (el?.textContent) {
        try {
            return JSON.parse(el.textContent) as OpenWsUiConfig
        } catch {
            // fall through
        }
    }
    // Safe default: same folder as index.html
    return { specUrl: './openws.json' }
}
