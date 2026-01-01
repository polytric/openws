import type { Endpoint } from '@polytric/openws-spec/types'

export function toUrl(ep: Endpoint) {
    const h = ep.host.trim()
    const pt = ep.port.toString().trim()
    return `${ep.scheme}://${h}${pt ? `:${pt}` : ''}${ep.path.startsWith('/') ? ep.path : `/${ep.path}`}`
}
