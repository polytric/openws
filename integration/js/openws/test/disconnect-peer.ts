import assert from 'node:assert/strict'

import * as ClassWS from '@polytric/openws/class'
import * as DecoratorWS from '@polytric/openws/decorator'
import * as FluentWS from '@polytric/openws/fluent'

const emptyPayload = {
    type: 'object',
    additionalProperties: false,
}

async function testFluentDisconnect() {
    const clientRole = FluentWS.role('client').message(
        FluentWS.message('accepted').payload(emptyPayload)
    )
    const serverRole = FluentWS.role('server')
        .asHost()
        .message(FluentWS.message('reject').payload(emptyPayload).from('client'))
    const network = FluentWS.network('fluent-disconnect').role(serverRole).role(clientRole)
    const binder = FluentWS.bindings(network)
    const runtime = FluentWS.runtime(binder)

    let transportCloses = 0
    let lifecycleCloses = 0
    let connectedPeer: FluentWS.PeerProto | undefined

    binder.fromRoles.client.onClose(async () => {
        lifecycleCloses++
    })
    binder.fromRoles.client.on('reject', async (_payload, peer) => {
        connectedPeer = peer
        await binder.disconnect(peer)
    })

    let session!: FluentWS.Session
    session = runtime.newSession(async () => {}, async () => {
        transportCloses++
        await session.close()
    })
    await session.open('client')
    await session.handleMessage('client', 'reject', {})
    await runtime.disconnect(connectedPeer!)
    await session.close()

    assert.equal(transportCloses, 1)
    assert.equal(lifecycleCloses, 1)
}

async function testClassDisconnect() {
    class Client {
        static CONFIG = {
            name: 'client',
            messages: {
                accepted: {
                    payload: emptyPayload,
                },
            },
        }
    }

    class Server extends ClassWS.HostRole {
        static CONFIG = {
            name: 'server',
            handlers: {
                reject: {
                    payload: emptyPayload,
                    from: [Client],
                },
            },
        }

        async reject(_payload: unknown, peer: ClassWS.Peer<typeof Client>) {
            await this.disconnect(peer)
        }
    }

    const binder = ClassWS.bindings({
        name: 'class-disconnect',
        roles: [Server, Client],
    })
    let transportCloses = 0
    let lifecycleCloses = 0

    binder.fromRoles.client.onClose(async () => {
        lifecycleCloses++
    })
    let session!: FluentWS.Session
    session = ClassWS.runtime(binder).newSession(async () => {}, async () => {
        transportCloses++
        await session.close()
    })
    await session.open('client')
    await session.handleMessage('client', 'reject', {})
    await session.close()

    assert.equal(transportCloses, 1)
    assert.equal(lifecycleCloses, 1)
}

async function testDecoratorDisconnect() {
    @DecoratorWS.role({ name: 'client' })
    class Client {
        @DecoratorWS.message({ payload: emptyPayload })
        async accepted() {}
    }

    @DecoratorWS.role({ name: 'server' })
    class Server extends DecoratorWS.HostRole {
        @DecoratorWS.handler({ payload: emptyPayload, from: [Client] })
        async reject(_payload: unknown, peer: DecoratorWS.Peer<typeof Client>) {
            await this.disconnect(peer)
        }
    }

    const binder = DecoratorWS.bindings({
        name: 'decorator-disconnect',
        roles: [Server, Client],
    })
    let transportCloses = 0
    let lifecycleCloses = 0

    binder.fromRoles.client.onClose(async () => {
        lifecycleCloses++
    })
    let session!: FluentWS.Session
    session = DecoratorWS.runtime(binder).newSession(async () => {}, async () => {
        transportCloses++
        await session.close()
    })
    await session.open('client')
    await session.handleMessage('client', 'reject', {})
    await session.close()

    assert.equal(transportCloses, 1)
    assert.equal(lifecycleCloses, 1)
}

await testFluentDisconnect()
await testClassDisconnect()
await testDecoratorDisconnect()
