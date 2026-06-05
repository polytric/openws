import assert from 'node:assert/strict'

import {
    type OpenWsEndpoint,
    type Transport,
    type TransportEvent,
    type TransportHandler,
} from './openws-sdkgen-typescript-node/chat/core/src/network.ts'
import { Client } from './openws-sdkgen-typescript-node/chat/core/src/sdk/client.ts'

class FakeTransport implements Transport {
    readonly handlers: Record<TransportEvent, Set<TransportHandler>> = {
        message: new Set(),
        error: new Set(),
        close: new Set(),
    }

    send(_data: string): void {}

    on(event: TransportEvent, handler: TransportHandler): () => void {
        this.handlers[event].add(handler)
        return () => {
            this.handlers[event].delete(handler)
        }
    }

    async connect(_roleName: string, _endpoint?: OpenWsEndpoint): Promise<void> {}

    async disconnect(_roleName: string): Promise<void> {
        await this.emit('close', { code: 1000 })
    }

    async emit(event: TransportEvent, data: unknown): Promise<void> {
        for (const handler of this.handlers[event]) {
            await handler(data)
        }
    }
}

async function waitFor(condition: () => boolean): Promise<void> {
    while (!condition()) {
        await new Promise(resolve => setTimeout(resolve, 0))
    }
}

const transport = new FakeTransport()
const client = new Client(transport)
const lifecycleEvents: string[] = []

client.onOpen(roleName => {
    lifecycleEvents.push(`open:${roleName}`)
})
client.onError((roleName, error) => {
    lifecycleEvents.push(`error:${roleName}:${error.message}`)
})
client.onClose(roleName => {
    lifecycleEvents.push(`close:${roleName}`)
})

const firstServer = await client.connect('server')
await client.connect('server')
await assert.rejects(
    () =>
        client.handleMessage({
            fromRole: 'server',
            messageName: 'joinedRoom',
            payload: {
                roomId: 'room-1',
                joinerId: 'user-a',
            },
        }),
    /Multiple sessions for remote role server/
)
await client.disconnect(firstServer)
await client.handleMessage({
    fromRole: 'server',
    messageName: 'joinedRoom',
    payload: {
        roomId: 'room-1',
        joinerId: 'user-a',
    },
})
await transport.emit('error', new Error('socket failed'))
await waitFor(() => lifecycleEvents.filter(event => event.startsWith('error:')).length === 1)
await transport.emit('close', { code: 1000 })
await waitFor(() => lifecycleEvents.filter(event => event.startsWith('close:')).length === 2)

assert.deepEqual(lifecycleEvents, [
    'open:server',
    'open:server',
    'close:server',
    'error:server:socket failed',
    'close:server',
])
