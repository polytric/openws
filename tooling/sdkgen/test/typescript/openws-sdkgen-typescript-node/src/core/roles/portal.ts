import type { ReceivedRoomStatsPayload, ReceivedRoomStatsPayloadInit } from '../models/portal'
import { Server } from './index'

export interface PortalApi {
    receivedRoomStats(
        payload: ReceivedRoomStatsPayload | ReceivedRoomStatsPayloadInit
    ): Promise<void>
}

export class Portal {
    static readonly CONFIG = {
        name: 'portal',
        description: '',
        messages: {
            receivedRoomStats: {
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
    static readonly endpoints = []
}

export class PortalHost {
    static get CONFIG() {
        return {
            name: 'portal',
            description: '',
            handlers: {
                receivedRoomStats: {
                    payload: Portal.CONFIG.messages.receivedRoomStats.payload,
                    from: [Server],
                },
            },
            endpoints: Portal.endpoints,
        }
    }
}
