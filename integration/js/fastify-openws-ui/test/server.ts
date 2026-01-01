import S from '@pocketgems/schema'
import fastify from 'fastify'

import openws from '@polytric/fastify-openws'
import openwsUi from '@polytric/fastify-openws-ui'
import * as WS from '@polytric/openws/class'

const app = fastify()

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
        endpoints: [
            {
                scheme: 'ws',
                host: 'localhost',
                port: 8082,
                path: '/chat',
            },
        ],
    }

    rooms: { [roomId: string]: { members: string[] } } = {}
    users: { [userId: string]: { userId: string; api: WS.Api<typeof Client> } } = {}

    async createRoom(
        { userId, roomId }: { userId: string; roomId: string },
        api: WS.Api<typeof Client>
    ) {
        this.rooms[roomId] = { members: [userId] }
        this.users[userId] = { userId, api }
        await api.joinedRoom({ roomId, joinerId: userId })
    }

    async joinRoom(
        { userId, roomId }: { userId: string; roomId: string },
        api: WS.Api<typeof Client>
    ) {
        this.rooms[roomId].members.push(userId)
        this.users[userId] = { userId, api }
        for (const member of this.rooms[roomId].members) {
            await this.users[member].api.joinedRoom({ roomId, joinerId: userId })
        }
    }

    async sendMessage(
        { userId, roomId, text }: { userId: string; roomId: string; text: string },
        _api: WS.Api<typeof Client> | WS.Api<typeof Portal>
    ) {
        for (const member of this.rooms[roomId].members) {
            if (member !== userId) {
                await this.users[member].api.receivedMessage({ roomId, senderId: userId, text })
            }
        }
    }

    async requestRoomStats({ roomId }: { roomId: string }, api: WS.Api<typeof Portal>) {
        await api.receivedRoomStats({ roomId, members: this.rooms[roomId].members })
    }
}

const bindings = WS.bindings({
    name: 'chat',
    description: 'A chat network',
    roles: [Server, Client, Portal],
})

async function main() {
    await app.register(openws)
    await app.register(openwsUi)

    await app.openws({
        path: '/chat',
        bindings,
    })

    await app.listen({ port: 8082 }).then(() => {
        console.log('Server is running on port 8082')
    })
}

main()
