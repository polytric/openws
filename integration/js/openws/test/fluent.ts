import S from '@pocketgems/schema'

// fluent start
import * as WS from '@polytric/openws/fluent'
import type { ApiProto } from '@polytric/openws/fluent'
import { validate } from '@polytric/openws-spec'

const globalCtx: AppContext = {
    rooms: {},
    users: {},
}

const clientRole = WS.role('client')
    .desc('A client role')
    .message(
        WS.message('joinedRoom')
            .payload(S.obj({ userId: S.str, roomId: S.str }))
            .desc('A room joined request')
    )
    .message(
        WS.message('receivedMessage')
            .payload(S.obj({ roomId: S.str, senderId: S.str, text: S.str, sentAt: S.int }))
            .desc('A message received request')
    )

const portalRole = WS.role('portal')
    .desc('A portal role')
    .message(
        WS.message('receivedRoomStats')
            .payload(S.obj({ roomId: S.str }))
            .desc('A room stats request')
    )

const serverRole = WS.role('server')
    .asHost()
    .desc('A server role')
    .endpoint(WS.endpoint('ws', 'localhost', 8082, '/chat'))
    .message(
        WS.message('createRoom')
            .payload(S.obj({ userId: S.str, roomId: S.str }))
            .desc('A room creation request')
    )
    .message(
        WS.message('joinRoom')
            .payload(S.obj({ userId: S.str, roomId: S.str }))
            .desc('A room join request')
    )
    .message(
        WS.message('sendMessage')
            .payload(S.obj({ userId: S.str, roomId: S.str, text: S.str }))
            .desc('A message send request')
    )
    .message(
        WS.message('requestRoomStats')
            .payload(S.obj({ roomId: S.str }))
            .desc('A room stats request')
    )

const network = WS.network('chat')
    .role(serverRole)
    .role(clientRole)
    .role(portalRole)
    .desc('A chat network')

const spec = WS.spec('0.0.1', 'Chat Example').network(network)
const specJson = spec.valueOf()
validate(specJson)

type AppContext = {
    rooms: { [roomId: string]: { users: Set<string> } }
    users: { [userId: string]: { userId: string; api: ApiProto } }
}

const binder = WS.bindings(network)
binder.fromRoles.client
    .on('createRoom', async (payload: { userId: string; roomId: string }, api: ApiProto) => {
        globalCtx.rooms[payload.roomId] = { users: new Set([payload.userId]) }
        globalCtx.users[payload.userId] = { userId: payload.userId, api }
        api.joinedRoom({ roomId: payload.roomId, userId: payload.userId })
    })
    .on('joinRoom', async (payload: { userId: string; roomId: string }, api: ApiProto) => {
        globalCtx.rooms[payload.roomId].users.add(payload.userId)
        globalCtx.users[payload.userId] = { userId: payload.userId, api }
        api.joinedRoom({ roomId: payload.roomId, userId: payload.userId })
    })
    .on(
        'sendMessage',
        async (payload: { userId: string; roomId: string; text: string }, api: ApiProto) => {
            const room = globalCtx.rooms[payload.roomId]
            if (!room) {
                throw new Error(`Room ${payload.roomId} not found`)
            }
            for (const userId of room.users) {
                const user = globalCtx.users[userId]
                if (!user || userId === payload.userId) {
                    continue
                }
                user.api.receivedMessage({
                    roomId: payload.roomId,
                    senderId: payload.userId,
                    text: payload.text,
                    sentAt: Date.now(),
                })
            }
        }
    )
    .on('requestRoomStats', async (payload: { roomId: string }, api: ApiProto) => {
        console.log('requestRoomStats', payload.roomId)
    })

binder.fromRoles.portal.on(
    'requestRoomStats',
    async (payload: { roomId: string }, api: ApiProto) => {
        console.log('requestRoomStats', payload.roomId)
    }
)
// fluent end

const runtime = WS.runtime(binder)

const session1 = runtime.newSession(
    async (fromRole: string, messageName: string, rawPayload: string) => {
        console.log(fromRole, messageName, rawPayload)
    }
)
const session2 = runtime.newSession(
    async (fromRole: string, messageName: string, rawPayload: string) => {
        console.log(fromRole, messageName, rawPayload)
    }
)
console.log('opening client session')
await session1.open('client')
await session2.open('client')
console.log('userA create room1')
await session1.handleMessage('client', 'createRoom', '{"userId": "userA", "roomId": "room1"}')
console.log('userB join room1')
await session2.handleMessage('client', 'joinRoom', '{"userId": "userB", "roomId": "room1"}')
console.log('userA send message to room1')
await session1.handleMessage(
    'client',
    'sendMessage',
    '{"userId": "userA", "roomId": "room1", "text": "Hello, world!"}'
)
