const WebSocket = require('ws')

const ws = new WebSocket('ws://localhost:8082/abc')

ws.on('open', () => {
    console.log('Connected to server')
    
    // Send a message to the server
    ws.send(JSON.stringify({
        handlerName: 'message',
        payload: JSON.stringify('Hello from client!')
    }))
    
    // Send another message after 1 second
    setTimeout(() => {
        ws.send(JSON.stringify({
            handlerName: 'message',
            payload: JSON.stringify('Another message from client')
        }))
    }, 1000)
})

ws.on('message', (data) => {
    try {
        const { handlerName, payload } = JSON.parse(data.toString())
        console.log(`Got: ${handlerName} ${payload}`)
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

// Keep the process running
process.on('SIGINT', () => {
    console.log('\nClosing connection...')
    ws.close()
    process.exit(0)
})