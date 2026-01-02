const WebSocket = require('ws')

const ws = new WebSocket('ws://localhost:8082/chat')

ws.on('open', () => {
    console.info('Connected to server')
})

ws.on('message', data => {
    try {
        const { fromRole, messageName, payload } = JSON.parse(data.toString())
        console.info(`Got: client-b -> ${fromRole} ${messageName} ${JSON.stringify(payload)}`)

        switch (messageName) {
            case 'joinedRoom':
                console.info(`Room joined: ${payload.roomId}`)
                break
            case 'receivedMessage':
                ws.send(
                    JSON.stringify({
                        fromRole: 'client',
                        messageName: 'sendMessage',
                        payload: {
                            text: 'Hello from client-b!',
                            roomId: payload.roomId,
                            userId: 'test-b',
                        },
                    })
                )
                break
        }
    } catch (e) {
        console.error('Raw message (not JSON):', data.toString())
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
            messageName: 'joinRoom',
            payload: { userId: 'test-b', roomId: 'chat-room' },
        })
    )
}, 2000)
