import { Server } from './index.js'

export class Client {
    static CONFIG = {
        name: 'client',
        description: '',
        messages: {
            joinedRoom: {
                payload: {
                    type: 'object',
                    properties: { joinerId: { type: 'string' }, roomId: { type: 'string' } },
                    required: ['joinerId', 'roomId'],
                    additionalProperties: false,
                    $schema: 'http://json-schema.org/draft-07/schema#',
                },
            },
            receivedMessage: {
                payload: {
                    type: 'object',
                    properties: {
                        senderId: { type: 'string' },
                        roomId: { type: 'string' },
                        text: { type: 'string' },
                    },
                    required: ['senderId', 'roomId', 'text'],
                    additionalProperties: false,
                    $schema: 'http://json-schema.org/draft-07/schema#',
                },
            },
        },
    }
    static endpoints = []
}

export class ClientHost {
    static get CONFIG() {
        return {
            name: 'client',
            description: '',
            handlers: {
                joinedRoom: {
                    payload: Client.CONFIG.messages.joinedRoom.payload,
                    from: [Server],
                },
                receivedMessage: {
                    payload: Client.CONFIG.messages.receivedMessage.payload,
                    from: [Server],
                },
            },
            endpoints: Client.endpoints,
        }
    }
}
