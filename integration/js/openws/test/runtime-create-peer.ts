import assert from 'node:assert/strict'

import S from '@pocketgems/schema'

import * as WS from '@polytric/openws/fluent'

const clientRole = WS.role('client')
    .message(WS.message('joinedRoom').payload(S.obj({ roomId: S.str })))

const serverRole = WS.role('server')
    .asHost()
    .message(WS.message('joinRoom').payload(S.obj({ roomId: S.str })))

const network = WS.network('chat').role(serverRole).role(clientRole)
const binder = WS.bindings(network)
const runtime = WS.runtime(binder)

assert.equal(typeof runtime.createPeer, 'function')

const sentEnvelopes: Array<{
    toRole: string
    messageName: string
    payload: unknown
}> = []

const clientPeer = runtime.createPeer('client', async (toRole, messageName, payload) => {
    sentEnvelopes.push({ toRole, messageName, payload })
})

await clientPeer.joinedRoom({ roomId: 'room-1' })

assert.deepEqual(sentEnvelopes, [
    {
        toRole: 'client',
        messageName: 'joinedRoom',
        payload: { roomId: 'room-1' },
    },
])
