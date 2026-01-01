export type OpenWsUiRuntimeConfig = {
    specUrl: string
    networkHosts: { [key: string]: string[] }
    isProduction: boolean
}

export function readRuntimeConfig(): OpenWsUiRuntimeConfig {
    const el = document.getElementById('openws-ui-config')
    if (!el?.textContent) {
        throw new Error(
            'OpenWS UI missing runtime config. ' +
                'Make sure @polytric/openws-ui injects <script id="openws-ui-config" type="application/json">...</script>.'
        )
    }
    return JSON.parse(el.textContent) as OpenWsUiRuntimeConfig
}
