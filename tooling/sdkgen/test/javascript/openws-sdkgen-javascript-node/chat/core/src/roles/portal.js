import { Server } from './index.js'

export class Portal {
    static CONFIG = {
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
    static endpoints = []
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
