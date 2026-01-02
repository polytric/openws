const WebSocket = require('ws')

const ws = new WebSocket('ws://localhost:8082/chat')

ws.on('open', () => {
    console.info('Connected to server')
})

ws.on('message', data => {
    try {
        const { fromRole, messageName, payload } = JSON.parse(data.toString())
        console.info(`Got: client-a -> ${fromRole} ${messageName} ${JSON.stringify(payload)}`)

        switch (messageName) {
            case 'joinedRoom':
                setInterval(() => {
                    console.info(`Sending message to ${payload.roomId}`)
                    ws.send(
                        JSON.stringify({
                            fromRole: 'client',
                            messageName: 'sendMessage',
                            payload: {
                                userId: 'test-a',
                                roomId: payload.roomId,
                                text: 'Hello from client-a!',
                            },
                        })
                    )
                }, 5000)
                break
            case 'receivedMessage':
                console.info(`Message received: ${payload.text} from ${payload.senderId}`)
                break
        }
    } catch (e) {
        console.error('Error in onMessage handler:', e)
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
            fromRole: 'client',
            messageName: 'createRoom',
            payload: { userId: 'test-a', roomId: 'chat-room' },
        })
    )
}, 1000)

// Keep the process running
process.on('SIGINT', () => {
    console.info('\nClosing connection...')
    ws.close()
    process.exit(0)
})
