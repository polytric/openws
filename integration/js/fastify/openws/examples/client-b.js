const WebSocket = require('ws')

const ws = new WebSocket('ws://localhost:8082/chat')

ws.on('open', () => {
    console.log('Connected to server')
})

ws.on('message', (data) => {
    try {
        const { fromRole, messageName, payload: rawPayload } = JSON.parse(data.toString())
        const payload = JSON.parse(rawPayload)
        console.log(`Got: ${fromRole} ${messageName} ${rawPayload}`)

        switch (messageName) {
            case 'roomJoined':
                console.log(`Room joined: ${payload.roomId}`)
                break
            case 'messageReceived':
                ws.send(JSON.stringify({
                    fromRole: 'client',
                    messageName: 'sendMessage',
                    payload: JSON.stringify({ text: 'Hello from client-b!', roomId: payload.roomId, userId: 'test-b' })
                }))
                break
        }
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
        fromRole: 'client',
        messageName: 'joinRoom',
        payload: JSON.stringify({ userId: 'test-b', roomId: 'fake-rand-id' })
    }))
}, 2000)