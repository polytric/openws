import type {
    CreateRoomPayload,
    CreateRoomPayloadInit,
    JoinRoomPayload,
    JoinRoomPayloadInit,
    SendMessagePayload,
    SendMessagePayloadInit,
    RequestRoomStatsPayload,
    RequestRoomStatsPayloadInit,
} from '../models/server'
import { Client, Portal } from './index'

export interface ServerPeer {
    createRoom(payload: CreateRoomPayload | CreateRoomPayloadInit): Promise<void>
    joinRoom(payload: JoinRoomPayload | JoinRoomPayloadInit): Promise<void>
    sendMessage(payload: SendMessagePayload | SendMessagePayloadInit): Promise<void>
    requestRoomStats(payload: RequestRoomStatsPayload | RequestRoomStatsPayloadInit): Promise<void>
}

export class Server {
    static readonly CONFIG = {
        name: 'server',
        description: '',
        messages: {
            createRoom: {
                payload: {
                    type: 'object',
                    properties: { userId: { type: 'string' }, roomId: { type: 'string' } },
                    required: ['userId', 'roomId'],
                    additionalProperties: false,
                    $schema: 'http://json-schema.org/draft-07/schema#',
                },
            },
            joinRoom: {
                payload: {
                    type: 'object',
                    properties: { userId: { type: 'string' }, roomId: { type: 'string' } },
                    required: ['userId', 'roomId'],
                    additionalProperties: false,
                    $schema: 'http://json-schema.org/draft-07/schema#',
                },
            },
            sendMessage: {
                payload: {
                    type: 'object',
                    properties: {
                        userId: { type: 'string' },
                        roomId: { type: 'string' },
                        text: { type: 'string' },
                        tags: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['userId', 'roomId', 'text'],
                    additionalProperties: false,
                    $schema: 'http://json-schema.org/draft-07/schema#',
                },
            },
            requestRoomStats: {
                payload: {
                    type: 'object',
                    properties: { roomId: { type: 'string' } },
                    required: ['roomId'],
                    additionalProperties: false,
                    $schema: 'http://json-schema.org/draft-07/schema#',
                },
            },
        },
    }
    static readonly endpoints = [{ scheme: 'ws', host: 'localhost', port: 8082, path: '/chat' }]
}

export class ServerHost {
    static get CONFIG() {
        return {
            name: 'server',
            description: '',
            handlers: {
                createRoom: {
                    payload: Server.CONFIG.messages.createRoom.payload,
                    from: [Client],
                },
                joinRoom: {
                    payload: Server.CONFIG.messages.joinRoom.payload,
                    from: [Client],
                },
                sendMessage: {
                    payload: Server.CONFIG.messages.sendMessage.payload,
                    from: [Client, Portal],
                },
                requestRoomStats: {
                    payload: Server.CONFIG.messages.requestRoomStats.payload,
                    from: [Portal],
                },
            },
            endpoints: Server.endpoints,
        }
    }
}
