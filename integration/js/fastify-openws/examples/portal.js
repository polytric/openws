const WebSocket = require('ws')

const ws = new WebSocket('ws://localhost:8082/chat')

ws.on('open', () => {
    console.info('Connected to server')
})

ws.on('message', data => {
    try {
        const { fromRole, messageName, payload: rawPayload } = JSON.parse(data.toString())
        console.info(`Got: portal -> ${fromRole} ${messageName} ${rawPayload}`)
    } catch (e) {
        console.error('error in onMessage handler:', e)
    }
})

ws.on('close', () => {
    console.info('Disconnected from server')
})

ws.on('error', error => {
    console.error('WebSocket error:', error)
})

setTimeout(() => {
    ws.send(
        JSON.stringify({
            fromRole: 'portal',
            messageName: 'requestRoomStats',
            payload: JSON.stringify({ roomId: 'chat-room' }),
        })
    )
}, 1000)

// Keep the process running
process.on('SIGINT', () => {
    console.info('\nClosing connection...')
    ws.close()
    process.exit(0)
})
