const WebSocket = require('ws')

const ws = new WebSocket('ws://localhost:8082/chat')

ws.on('open', () => {
    console.log('Connected to server')
})

ws.on('message', (data) => {
    try {
        const { fromRole, messageName, payload: rawPayload } = JSON.parse(data.toString())
        console.log(`Got: ${fromRole} ${messageName} ${rawPayload}`)
    } catch (e) {
        console.log('Raw message (not JSON):', data.toString())
    }
})

ws.on('close', () => {
    console.log('Disconnected from server')
})

ws.on('error', (error) => {
    console.error('WebSocket error:', error)
})

setTimeout(() => {
    ws.send(JSON.stringify({
        fromRole: 'portal',
        messageName: 'requestStats',
        payload: JSON.stringify({ roomId: 'fake-rand-id' })
    }))
}, 1000)

// Keep the process running
process.on('SIGINT', () => {
    console.log('\nClosing connection...')
    ws.close()
    process.exit(0)
})