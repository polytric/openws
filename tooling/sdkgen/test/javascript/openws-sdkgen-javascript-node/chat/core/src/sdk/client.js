import * as WS from '@polytric/openws/class'
import * as Fluent from '@polytric/openws/fluent'
import {
    WsTransport,
    bindTransport,
    canBindTransport,
    decodeEnvelope,
    encodeEnvelope,
} from '../network.js'
export * from '../models/client/index.js'
import { ClientHost, Server } from '../roles/index.js'

export class Client {
    static CONFIG = ClientHost.CONFIG

    name = Client.CONFIG.name
    description = Client.CONFIG.description
    runtime
    sendEnvelope
    #transportUnsubscribe
    #apisByRole = {}
    #apisByMessageName = {}
    #handlersByMessageName = {}
    #messageErrorHandlers = new Set()
    #socketErrorHandlers = new Set()
    #fromRole = 'client'
    #joinedRoomHandlers = new Set()
    #receivedMessageHandlers = new Set()

    constructor(transport = new WsTransport()) {
        this.transport = transport
        const HostRole = this.constructor
        this.binder = Fluent.bindings(
            WS.network({
                name: 'core',
                description: 'A chat network',
                version: '1.0.0',
                roles: [HostRole, Server],
            })
        )
        this.runtime = WS.runtime(this.binder)
        this.sendEnvelope = async (_toRole, messageName, payload) => {
            await this.transport.send(
                encodeEnvelope({ fromRole: this.#fromRole, messageName, payload })
            )
        }
        this.#handlersByMessageName['joinedRoom'] = async (payload, api) => {
            await this.joinedRoom(payload, api)
        }
        this.binder.fromRoles['server'].on('joinedRoom', async (payload, api) => {
            await this.joinedRoom(payload, api)
        })
        this.#handlersByMessageName['receivedMessage'] = async (payload, api) => {
            await this.receivedMessage(payload, api)
        }
        this.binder.fromRoles['server'].on('receivedMessage', async (payload, api) => {
            await this.receivedMessage(payload, api)
        })
        if (canBindTransport(transport)) {
            this.bindTransport(transport)
        }
    }

    async connect(roleName, endpoint) {
        switch (roleName) {
            case 'server': {
                const remoteEndpoint = endpoint ?? {
                    scheme: 'ws',
                    host: 'localhost',
                    port: 8082,
                    path: '/chat',
                }
                await this.transport.connect?.(roleName, remoteEndpoint)
                if (!this.#apisByRole['server']) {
                    this.serverApi = this.runtime.createApi('server', this.sendEnvelope)
                    this.#apisByRole['server'] = this.serverApi
                    this.#apisByMessageName['joinedRoom'] = this.serverApi
                    this.#apisByMessageName['receivedMessage'] = this.serverApi
                }
                return this.serverApi
            }
            default:
                throw new Error(`Remote role ${roleName} not found`)
        }
    }

    async disconnect(roleName) {
        await this.transport.disconnect?.(roleName)
        delete this.#apisByRole[roleName]
    }

    bindTransport(transport = this.transport, options = {}) {
        this.#transportUnsubscribe?.()
        this.#transportUnsubscribe = bindTransport(transport, this, options)
        return this.#transportUnsubscribe
    }

    unbindTransport() {
        this.#transportUnsubscribe?.()
        this.#transportUnsubscribe = undefined
    }

    async messageError(error) {
        for (const handler of this.#messageErrorHandlers) {
            await handler(error)
        }
    }

    onMessageError(handler) {
        this.#messageErrorHandlers.add(handler)
        return () => {
            this.#messageErrorHandlers.delete(handler)
        }
    }

    async socketError(error) {
        for (const handler of this.#socketErrorHandlers) {
            await handler(error)
        }
    }

    onSocketError(handler) {
        this.#socketErrorHandlers.add(handler)
        return () => {
            this.#socketErrorHandlers.delete(handler)
        }
    }

    async joinedRoom(payload, api) {
        for (const handler of this.#joinedRoomHandlers) {
            await handler(payload, api)
        }
    }

    onJoinedRoom(handler) {
        this.#joinedRoomHandlers.add(handler)
        return () => {
            this.#joinedRoomHandlers.delete(handler)
        }
    }

    async receivedMessage(payload, api) {
        for (const handler of this.#receivedMessageHandlers) {
            await handler(payload, api)
        }
    }

    onReceivedMessage(handler) {
        this.#receivedMessageHandlers.add(handler)
        return () => {
            this.#receivedMessageHandlers.delete(handler)
        }
    }

    async handleRawMessage(data) {
        await this.handleMessage(decodeEnvelope(data))
    }

    async handleMessage(envelope) {
        const remote = this.binder.fromRoles[envelope.fromRole]
        const api = this.#apisByRole[envelope.fromRole]
        if (remote && api) {
            await remote.handleMessage(envelope.messageName, envelope.payload, api)
            return
        }

        const localHandler = this.#handlersByMessageName[envelope.messageName]
        const localApi = this.#apisByMessageName[envelope.messageName]
        if (envelope.fromRole === this.#fromRole && localHandler && localApi) {
            await localHandler(envelope.payload, localApi)
            return
        }

        throw new Error(`Remote role ${envelope.fromRole} not found`)
    }
}
