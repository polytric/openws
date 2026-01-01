const { validate } = require('@polytric/openws-spec')

async function main() {
    const url = process.argv[2] ?? 'http://localhost:8082/openws/spec.json'

    const res = await fetch(url, {
        headers: { accept: 'application/json' },
    })

    if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}\n${body}`)
    }

    const doc = await res.json()

    try {
        validate(doc)
        console.info('OpenWS document is valid:', url)
    } catch (error) {
        console.error('OpenWS document is INVALID')
        console.error(error)
        process.exit(1)
    }
}

main().catch(err => {
    console.error(err?.stack || String(err))
    process.exit(1)
})
