export async function fetchOpenWsSpec(specUrl: string): Promise<any> {
    const res = await fetch(specUrl, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Failed to load spec: ${res.status} ${res.statusText}`)
    return res.json()
}
