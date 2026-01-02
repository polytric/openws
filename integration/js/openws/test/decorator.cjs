const S = require('@pocketgems/schema')

const WS = require('@polytric/openws/decorator')

@WS.role({ description: 'A chat client role' })
class Client {
    @WS.message({ payload: S.obj({ joinerId: S.str, roomId: S.str }) })
    async joinedRoom() {
        // reserved for later
    }

    @WS.message({ payload: S.obj({ senderId: S.str, roomId: S.str, text: S.str }) })
    async receivedMessage() {
        // reserved for later
    }
}

@WS.role({ description: 'A chat portal role' })
class Portal {
    @WS.message({ payload: S.obj({ roomId: S.str }) })
    async receivedRoomStats() {
        // reserved for later
    }
}

@WS.role({ description: 'A chat server role' })
class Server {
    rooms = {}
    users = {}

    @WS.handler({ payload: S.obj({ userId: S.str, roomId: S.str }), from: [Client] })
    async createRoom({ userId, roomId }, api) {
        this.rooms[roomId] = { members: [userId] }
        this.users[userId] = { userId, api }
        await api.joinedRoom({ roomId, joinerId: userId })
    }

    @WS.handler({ payload: S.obj({ userId: S.str, roomId: S.str }), from: Client })
    async joinRoom({ userId, roomId }, api) {
        this.rooms[roomId].members.push(userId)
        this.users[userId] = { userId, api }
        await api.joinedRoom({ roomId, joinerId: userId })
    }

    @WS.handler({
        name: 'sendMessage',
        payload: S.obj({ userId: S.str, roomId: S.str, text: S.str }),
        from: [Client],
    })
    async sendMessage({ userId, roomId, text }, _api) {
        for (const member of this.rooms[roomId].members) {
            if (userId && member === userId) {
                continue
            }
            await this.users[member].api.receivedMessage({
                roomId,
                senderId: userId,
                text,
            })
        }
    }

    @WS.handler({
        name: 'sendMessage',
        from: [Portal],
        // Payload shape must stay identical. It's a limitation that needs to be addressed in the future.
        payload: S.obj({ userId: S.str, roomId: S.str, text: S.str }),
    })
    async sendMessagePortal({ userId, roomId, text }) {
        for (const member of this.rooms[roomId].members) {
            await this.users[member].api.receivedMessage({ roomId, senderId: userId, text })
        }
    }

    @WS.handler({ payload: S.obj({ roomId: S.str }), from: [Portal] })
    async requestRoomStats({ roomId }, api) {
        await api.receivedRoomStats({ roomId })
    }
}

const binder = WS.bindings({
    name: 'chat',
    description: 'A chat network',
    roles: [Server, Client, Portal],
})
const runtime = WS.runtime(binder)

const session1 = runtime.newSession(async (fromRole, messageName, payload) => {
    console.log('session1', fromRole, messageName, payload)
})
const session2 = runtime.newSession(async (fromRole, messageName, payload) => {
    console.log('session2', fromRole, messageName, payload)
})

async function main() {
    await session1.open('client')
    await session2.open('client')
    await session1.handleMessage('client', 'createRoom', { userId: '1', roomId: '1' })
    await session2.handleMessage('client', 'joinRoom', { userId: '2', roomId: '1' })
    await session1.handleMessage('client', 'sendMessage', {
        userId: '1',
        roomId: '1',
        text: 'Hello',
    })
    await session2.handleMessage('client', 'sendMessage', {
        userId: '2',
        roomId: '1',
        text: 'Hello',
    })

    const session3 = runtime.newSession(async (fromRole, messageName, payload) => {
        console.log('session3', fromRole, messageName, payload)
    })
    await session3.open('portal')
    await session3.handleMessage('portal', 'requestRoomStats', { roomId: '1' })
    await session3.handleMessage('portal', 'sendMessage', {
        userId: 'Admin',
        roomId: '1',
        text: 'Hello',
    })
}

main().catch(console.error)
