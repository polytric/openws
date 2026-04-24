import assert from 'node:assert/strict'

import { WsTransport, type OpenWsEndpoint } from './openws-sdkgen-typescript-node/chat/core/src/network.ts'

type Handler = (...args: unknown[]) => void

class FakeSocket {
    readyState = 1
    readonly sent: string[] = []
    readonly handlers = new Map<string, Set<Handler>>()

    constructor(readonly url?: string) {}

    on(event: string, handler: Handler): void {
        this.handlers.get(event)?.add(handler) ?? this.handlers.set(event, new Set([handler]))
    }

    off(event: string, handler: Handler): void {
        this.handlers.get(event)?.delete(handler)
    }

    send(data: string): void {
        if (this.readyState !== 1) {
            throw new Error('Fake socket is not open')
        }
        this.sent.push(data)
    }

    close(): void {
        this.readyState = 3
        this.emit('close', { code: 1000 })
    }

    emit(event: string, ...args: unknown[]): void {
        for (const handler of this.handlers.get(event) ?? []) {
            handler(...args)
        }
    }

    listenerCount(event: string): number {
        return this.handlers.get(event)?.size ?? 0
    }
}

const previousWebSocket = globalThis.WebSocket
const createdSockets: FakeSocket[] = []

;(globalThis as typeof globalThis & { WebSocket: new (url: string) => FakeSocket }).WebSocket =
    class extends FakeSocket {
        constructor(url: string) {
            super(url)
            createdSockets.push(this)
        }
    }

try {
    const socket = new FakeSocket()
    const transport = new WsTransport(socket)
    let closeCount = 0

    transport.on('close', () => {
        closeCount += 1
    })

    socket.close()

    assert.equal(closeCount, 1)
    assert.equal(socket.listenerCount('message'), 0)
    assert.equal(socket.listenerCount('error'), 0)
    assert.equal(socket.listenerCount('close'), 0)
    await assert.rejects(() => transport.send('lost frame'), /WebSocket is not connected/)

    const endpoint: OpenWsEndpoint = {
        scheme: 'ws',
        host: 'localhost',
        port: 8201,
        path: '/tunnel',
    }
    await transport.connect('server', endpoint)
    await transport.send('next frame')

    assert.equal(createdSockets.length, 1)
    assert.equal(createdSockets[0].url, 'ws://localhost:8201/tunnel')
    assert.deepEqual(createdSockets[0].sent, ['next frame'])
} finally {
    globalThis.WebSocket = previousWebSocket
}
