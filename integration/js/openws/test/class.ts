import S from '@pocketgems/schema'

import * as WS from '@polytric/openws/class'

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

    rooms: { [roomId: string]: { members: string[] } } = {}
    users: { [userId: string]: { userId: string; peer: WS.Peer<typeof Client> } } = {}

    async createRoom(
        { userId, roomId }: { userId: string; roomId: string },
        peer: WS.Peer<typeof Client>
    ) {
        this.rooms[roomId] = { members: [userId] }
        this.users[userId] = { userId, peer }
        await peer.joinedRoom({ roomId, joinerId: userId })
    }

    async joinRoom(
        { userId, roomId }: { userId: string; roomId: string },
        peer: WS.Peer<typeof Client>
    ) {
        this.rooms[roomId].members.push(userId)
        this.users[userId] = { userId, peer }
        for (const member of this.rooms[roomId].members) {
            await this.users[member].peer.joinedRoom({ roomId, joinerId: userId })
        }
    }

    async sendMessage(
        { userId, roomId, text }: { userId: string; roomId: string; text: string },
        _peer: WS.Peer<typeof Client> | WS.Peer<typeof Portal>
    ) {
        for (const member of this.rooms[roomId].members) {
            if (member !== userId) {
                await this.users[member].peer.receivedMessage({ roomId, senderId: userId, text })
            }
        }
    }

    async requestRoomStats({ roomId }: { roomId: string }, peer: WS.Peer<typeof Portal>) {
        await peer.receivedRoomStats({ roomId, members: this.rooms[roomId].members })
    }
}

const binder = WS.bindings({
    name: 'chat',
    description: 'A chat network',
    roles: [Server, Client, Portal],
})

// runtime example start
const runtime = WS.runtime(binder)

const session1 = runtime.newSession(async (fromRole: string, messageName: string, payload: any) => {
    console.log(fromRole, messageName, payload)
})
// runtime example end

const session2 = runtime.newSession(async (fromRole: string, messageName: string, payload: any) => {
    console.log(fromRole, messageName, payload)
})

// session example start
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
// session example end
