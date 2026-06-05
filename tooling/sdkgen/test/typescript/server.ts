import fastify from 'fastify'

import openws from '../../../../integration/js/fastify-openws/src/index.ts'
import * as WS from '@polytric/openws/class'

import {
    networkDescription,
    networkName,
    networkVersion,
} from './openws-sdkgen-typescript-node/chat/core/src/network.ts'
import {
    Client as ClientRole,
    Portal as PortalRole,
    ServerHost,
    type ClientPeer,
    type PortalPeer,
} from './openws-sdkgen-typescript-node/chat/core/src/roles/index.ts'
import {
    JoinedRoomPayload,
    ReceivedMessagePayload,
} from './openws-sdkgen-typescript-node/chat/core/src/models/client/index.ts'
import { ReceivedRoomStatsPayload } from './openws-sdkgen-typescript-node/chat/core/src/models/portal/index.ts'
import {
    RequestRoomStatsPayload,
    CreateRoomPayload,
    JoinRoomPayload,
    SendMessagePayload,
} from './openws-sdkgen-typescript-node/chat/core/src/models/server/index.ts'

const port = Number(process.env.OPENWS_PORT ?? 8082)
const path = process.env.OPENWS_PATH ?? '/chat'

class ChatServer {
    static readonly CONFIG = ServerHost.CONFIG

    private readonly rooms = new Map<string, Set<string>>()
    private readonly users = new Map<string, ClientPeer>()

    async createRoom(payload: CreateRoomPayload, peer: ClientPeer): Promise<void> {
        this.rooms.set(payload.roomId, new Set([payload.userId]))
        this.users.set(payload.userId, peer)

        await peer.joinedRoom(
            new JoinedRoomPayload({
                roomId: payload.roomId,
                joinerId: payload.userId,
            })
        )
    }

    async joinRoom(payload: JoinRoomPayload, peer: ClientPeer): Promise<void> {
        const room = this.rooms.get(payload.roomId)
        if (!room) {
            throw new Error(`Room ${payload.roomId} does not exist`)
        }

        room.add(payload.userId)
        this.users.set(payload.userId, peer)

        for (const memberId of room) {
            await this.users.get(memberId)?.joinedRoom(
                new JoinedRoomPayload({
                    roomId: payload.roomId,
                    joinerId: payload.userId,
                })
            )
        }
    }

    async sendMessage(payload: SendMessagePayload): Promise<void> {
        const room = this.rooms.get(payload.roomId)
        if (!room) {
            throw new Error(`Room ${payload.roomId} does not exist`)
        }

        for (const memberId of room) {
            await this.users.get(memberId)?.receivedMessage(
                new ReceivedMessagePayload({
                    roomId: payload.roomId,
                    senderId: payload.userId,
                    text: payload.text,
                })
            )
        }
    }

    async requestRoomStats(payload: RequestRoomStatsPayload, peer: PortalPeer): Promise<void> {
        await peer.receivedRoomStats(
            new ReceivedRoomStatsPayload({
                roomId: payload.roomId,
            })
        )
    }
}

const app = fastify()
const bindings = WS.bindings({
    name: networkName,
    description: networkDescription,
    version: networkVersion,
    roles: [ChatServer, ClientRole, PortalRole],
})

await app.register(openws)
app.openws({ path, bindings })

await app.listen({ port })
console.log(`Generated SDK server listening on ws://localhost:${port}${path}`)
