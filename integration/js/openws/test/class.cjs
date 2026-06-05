const S = require('@pocketgems/schema')

const WS = require('@polytric/openws/class')

class Client {
    static CONFIG = {
        name: 'client',
        description: 'A chat client role',
        messages: {
            joinedRoom: {
                payload: S.obj({ joinerId: S.str, roomId: S.str }),
            },
            receivedMessage: {
                payload: S.obj({ senderId: S.str, roomId: S.str, text: S.str }),
            },
        },
    }
}

class Portal {
    static CONFIG = {
        name: 'portal',
        description: 'A chat portal role',
        messages: {
            receivedRoomStats: {
                payload: S.obj({ roomId: S.str }),
            },
        },
    }
}

class Server {
    static CONFIG = {
        name: 'server',
        description: 'A chat server role',
        handlers: {
            createRoom: {
                payload: S.obj({ userId: S.str, roomId: S.str }),
                from: [Client],
            },
            joinRoom: {
                payload: S.obj({ userId: S.str, roomId: S.str }),
                from: [Client],
            },
            sendMessage: {
                payload: S.obj({ userId: S.str, roomId: S.str, text: S.str }),
                from: [Client, Portal],
            },
            requestRoomStats: {
                payload: S.obj({ roomId: S.str }),
                from: [Portal],
            },
        },
    }

    rooms = {}
    users = {}

    async createRoom({ userId, roomId }, peer) {
        this.rooms[roomId] = { members: [userId] }
        this.users[userId] = { userId, peer }
        await peer.joinedRoom({ roomId, joinerId: userId })
    }

    async joinRoom({ userId, roomId }, peer) {
        this.rooms[roomId].members.push(userId)
        this.users[userId] = { userId, peer }
        for (const member of this.rooms[roomId].members) {
            await this.users[member].peer.joinedRoom({ roomId, joinerId: userId })
        }
    }

    async sendMessage({ userId, roomId, text }, _peer) {
        for (const member of this.rooms[roomId].members) {
            if (member !== userId) {
                await this.users[member].peer.receivedMessage({ roomId, senderId: userId, text })
            }
        }
    }

    async requestRoomStats({ roomId }, peer) {
        await peer.receivedRoomStats({ roomId, members: this.rooms[roomId].members })
    }
}

const binder = WS.bindings({
    name: 'chat',
    description: 'A chat network',
    roles: [Server, Client, Portal],
})

const runtime = WS.runtime(binder)

const session1 = runtime.newSession(async (fromRole, messageName, payload) => {
    console.log(fromRole, messageName, payload)
})
const session2 = runtime.newSession(async (fromRole, messageName, payload) => {
    console.log(fromRole, messageName, payload)
})

async function main() {
    await session1.open('client')
    await session2.open('client')

    await session1.handleMessage('client', 'createRoom', { userId: 'userA', roomId: 'room1' })
    await session2.handleMessage('client', 'joinRoom', { userId: 'userB', roomId: 'room1' })
    await session1.handleMessage('client', 'sendMessage', {
        userId: 'userA',
        roomId: 'room1',
        text: 'Hello, world!',
    })
    await session2.handleMessage('client', 'sendMessage', {
        userId: 'userB',
        roomId: 'room1',
        text: 'Hello, world!',
    })
}

main().catch(console.error)
