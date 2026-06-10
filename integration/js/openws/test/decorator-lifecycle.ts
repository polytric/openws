import assert from 'node:assert/strict'

import * as WS from '@polytric/openws/decorator'

const ackPayload = {
    type: 'object',
    properties: {
        event: { type: 'string' },
    },
    required: ['event'],
}

const emptyPayload = {
    type: 'object',
    additionalProperties: false,
}

const events: string[] = []

@WS.role({ name: 'client' })
class Client {
    @WS.message({ payload: ackPayload })
    async lifecycleAck() {}
}

@WS.role({ name: 'portal' })
class Portal {}

@WS.role({ name: 'server' })
class Server {
    @WS.handler({ payload: emptyPayload, from: [Client] })
    async ping() {}

    async handleOpen(fromRole: string, peer: WS.Peer<typeof Client> | WS.Peer<typeof Portal>) {
        events.push(`open:${fromRole}`)
        if (fromRole === 'client') {
            await (peer as WS.Peer<typeof Client>).lifecycleAck({ event: 'open' })
        }
    }

    async handleClose(fromRole: string, peer: WS.Peer<typeof Client> | WS.Peer<typeof Portal>) {
        events.push(`close:${fromRole}`)
        if (fromRole === 'client') {
            await (peer as WS.Peer<typeof Client>).lifecycleAck({ event: 'close' })
        }
    }

    async handleError(
        fromRole: string,
        peer: WS.Peer<typeof Client> | WS.Peer<typeof Portal>,
        error: Error
    ) {
        events.push(`error:${fromRole}:${error.message}`)
        if (fromRole === 'client') {
            await (peer as WS.Peer<typeof Client>).lifecycleAck({ event: 'error' })
        }
    }
}

const binder = WS.bindings({
    name: 'decorator-lifecycle',
    roles: [Server, Client, Portal],
})
const runtime = WS.runtime(binder)
const sent: Array<{ fromRole: string; messageName: string; payload: unknown }> = []
const clientSession = runtime.newSession(async (fromRole, messageName, payload) => {
    sent.push({ fromRole, messageName, payload })
})
const portalSession = runtime.newSession(async () => {})

await clientSession.open('client')
await clientSession.error(new Error('socket failed'))
await clientSession.close()

await portalSession.open('portal')
await portalSession.error(new Error('portal failed'))
await portalSession.close()

assert.deepEqual(events, [
    'open:client',
    'error:client:socket failed',
    'close:client',
    'open:portal',
    'error:portal:portal failed',
    'close:portal',
])
assert.deepEqual(sent, [
    { fromRole: 'client', messageName: 'lifecycleAck', payload: { event: 'open' } },
    { fromRole: 'client', messageName: 'lifecycleAck', payload: { event: 'error' } },
    { fromRole: 'client', messageName: 'lifecycleAck', payload: { event: 'close' } },
])
