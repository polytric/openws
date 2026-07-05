import assert from 'node:assert/strict'
import test from 'node:test'

import S from '@pocketgems/schema'
import fastify from 'fastify'

import openws from '../../fastify-openws/src/index'
import openwsUi from '../src/index'
import * as WS from '@polytric/openws/class'

class Client {
    static CONFIG = {
        name: 'client',
        messages: {
            connected: {
                payload: S.obj({ clientId: S.str }),
            },
        },
    }
}

class Server {
    static CONFIG = {
        name: 'server',
        handlers: {
            connect: {
                payload: S.obj({ clientId: S.str }),
                from: [Client],
            },
        },
    }

    async connect(_payload: { clientId: string }, _peer: WS.Peer<typeof Client>) {
        // Test fixture only.
    }
}

test('OpenWS Fastify export uses plugin service version and class network version', async () => {
    const app = fastify()
    const bindings = WS.bindings({
        name: 'chat',
        description: 'Chat network',
        version: '2.0.0',
        roles: [Server, Client],
    })

    await app.register(openws, {
        name: 'Chat Service',
        version: '1.0.0',
    })
    await app.register(openwsUi)
    app.openws({ path: '/chat', bindings })
    await app.ready()

    const spec = app.openwsUi.getSpec?.()
    assert.equal(spec?.name, 'Chat Service')
    assert.equal(spec?.version, '1.0.0')
    assert.equal(spec?.networks.chat.version, '2.0.0')

    await app.close()
})

test('OpenWS Fastify route version overrides the registered network version', async () => {
    const app = fastify()
    const bindings = WS.bindings({
        name: 'chat',
        description: 'Chat network',
        roles: [Server, Client],
    })

    await app.register(openws, {
        name: 'Chat Service',
        version: '1.0.0',
    })
    await app.register(openwsUi)
    app.openws({ path: '/chat', bindings, version: '3.0.0' })
    await app.ready()

    const spec = app.openwsUi.getSpec?.()
    assert.equal(spec?.name, 'Chat Service')
    assert.equal(spec?.version, '1.0.0')
    assert.equal(spec?.networks.chat.version, '3.0.0')

    await app.close()
})
