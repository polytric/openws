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
                setInterval(() => {
                    console.log(`Sending message to ${payload.roomId}`)
                    ws.send(JSON.stringify({
                        fromRole: 'client',
                        messageName: 'sendMessage',
                        payload: JSON.stringify({ userId: 'test-a', roomId: payload.roomId, text: 'Hello from client-a!' })
                    }))
                }, 5000)
                break
            case 'messageReceived':
                console.log(`Message received: ${payload.text} from ${payload.senderId}`)
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
        messageName: 'createRoom',
        payload: JSON.stringify({ userId: 'test-a', name: 'chat room' })
    }))
}, 1000)

// Keep the process running
process.on('SIGINT', () => {
    console.log('\nClosing connection...')
    ws.close()
    process.exit(0)
})