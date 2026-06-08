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

/**
 * Generated OpenWS client for the "client" role in the "core" network.
 *
 * Application code calls command methods such as `connect` and registers
 * callbacks with `on...` methods. Transport and framework glue call `handle...`
 * methods to deliver inbound data, errors, and lifecycle events.
 */
export class Client {
    static CONFIG = ClientHost.CONFIG

    name = Client.CONFIG.name
    description = Client.CONFIG.description
    runtime
    sendEnvelope
    #transportUnsubscribe
    #connections = new Set()
    #peersByMessageName = {}
    #peerRoleByMessageName = {}
    #handlersByMessageName = {}
    #messageErrorHandlers = new Set()
    #socketErrorHandlers = new Set()
    #openHandlers = new Set()
    #closeHandlers = new Set()
    #lifecycleErrorHandlers = new Set()
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
        this.#handlersByMessageName['joinedRoom'] = async (payload, peer) => {
            await this.joinedRoom(payload, peer)
        }
        this.binder.fromRoles['server'].on('joinedRoom', async (payload, peer) => {
            await this.joinedRoom(payload, peer)
        })
        this.#handlersByMessageName['receivedMessage'] = async (payload, peer) => {
            await this.receivedMessage(payload, peer)
        }
        this.binder.fromRoles['server'].on('receivedMessage', async (payload, peer) => {
            await this.receivedMessage(payload, peer)
        })
        this.binder.fromRoles['server'].onOpen(async (fromRole, peer) => {
            await this.handleOpen(fromRole, peer)
        })
        this.binder.fromRoles['server'].onClose(async (fromRole, peer) => {
            await this.handleClose(fromRole, peer)
        })
        this.binder.fromRoles['server'].onError(async (fromRole, peer, error) => {
            await this.handleError(fromRole, peer, error)
        })
        if (canBindTransport(transport)) {
            this.bindTransport(transport)
        }
    }

    /**
     * Connects this client to a role and returns the connected peer handle.
     */
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
                const session = this.runtime.newSession(this.sendEnvelope)
                this.serverPeer = await session.open('server')
                this.#connections.add({
                    roleName: 'server',
                    session,
                    peer: this.serverPeer,
                })
                this.#peersByMessageName['joinedRoom'] = this.serverPeer
                this.#peerRoleByMessageName['joinedRoom'] = 'server'
                this.#peersByMessageName['receivedMessage'] = this.serverPeer
                this.#peerRoleByMessageName['receivedMessage'] = 'server'
                return this.serverPeer
            }
            default:
                throw new Error(`Remote role ${roleName} not found`)
        }
    }

    /**
     * Disconnects from a peer and closes its session.
     *
     * Pass the peer returned by `connect` to close that exact peer connection.
     * Passing a role name closes all active peer connections for that role.
     */
    async disconnect(peer) {
        if (typeof peer === 'string') {
            await this.transport.disconnect?.(peer)
            await this.#closeSessions(peer)
            return
        }
        const connection = this.#findConnectionByPeer(peer)
        if (!connection) {
            throw new Error('Peer is not connected')
        }
        await this.#closeConnection(connection)
    }

    /**
     * Binds a transport to this client.
     *
     * Transport events call this client's `handle...` methods. Application code
     * should use `on...` methods to observe those events.
     */
    bindTransport(transport = this.transport, options = {}) {
        this.#transportUnsubscribe?.()
        this.#transportUnsubscribe = bindTransport(transport, this, options)
        return this.#transportUnsubscribe
    }

    /**
     * Removes the current transport event bindings.
     */
    unbindTransport() {
        this.#transportUnsubscribe?.()
        this.#transportUnsubscribe = undefined
    }

    /**
     * Framework entrypoint for message decoding or dispatch failures.
     */
    async handleMessageError(error) {
        for (const handler of this.#messageErrorHandlers) {
            await handler(error)
        }
    }

    /**
     * Registers an application callback for message decoding or dispatch failures.
     */
    onMessageError(handler) {
        this.#messageErrorHandlers.add(handler)
        return () => {
            this.#messageErrorHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for transport-level socket errors.
     */
    async handleSocketError(error) {
        const sessionError = toOpenWsError(error)
        for (const connection of this.#connections) {
            await connection.session.error(sessionError)
        }
        for (const handler of this.#socketErrorHandlers) {
            await handler(error)
        }
    }

    /**
     * Registers an application callback for transport-level socket errors.
     */
    onSocketError(handler) {
        this.#socketErrorHandlers.add(handler)
        return () => {
            this.#socketErrorHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for transport-level socket close events.
     */
    async handleSocketClose(_event) {
        for (const connection of Array.from(this.#connections)) {
            await this.#closeConnection(connection)
        }
    }

    /**
     * Framework entrypoint for a peer session opening.
     */
    async handleOpen(roleName, peer) {
        for (const handler of this.#openHandlers) {
            await handler(roleName, peer)
        }
    }

    /**
     * Registers an application callback for peer session open events.
     */
    onOpen(handler) {
        this.#openHandlers.add(handler)
        return () => {
            this.#openHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for a peer session closing.
     */
    async handleClose(roleName, peer) {
        for (const handler of this.#closeHandlers) {
            await handler(roleName, peer)
        }
    }

    /**
     * Registers an application callback for peer session close events.
     */
    onClose(handler) {
        this.#closeHandlers.add(handler)
        return () => {
            this.#closeHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for a peer session error.
     */
    async handleError(roleName, peer, error) {
        for (const handler of this.#lifecycleErrorHandlers) {
            await handler(roleName, peer, error)
        }
    }

    /**
     * Registers an application callback for peer session errors.
     */
    onError(handler) {
        this.#lifecycleErrorHandlers.add(handler)
        return () => {
            this.#lifecycleErrorHandlers.delete(handler)
        }
    }

    async #closeSessions(roleName) {
        for (const connection of this.#findConnections(roleName)) {
            await this.#closeConnection(connection)
        }
    }

    async #closeConnection(connection) {
        if (!this.#connections.delete(connection)) {
            return
        }
        if (this.#findConnections(connection.roleName).length === 0) {
            for (const [messageName, peerRoleName] of Object.entries(this.#peerRoleByMessageName)) {
                if (peerRoleName !== connection.roleName) {
                    continue
                }
                delete this.#peersByMessageName[messageName]
                delete this.#peerRoleByMessageName[messageName]
            }
        }
        await connection.session.close()
    }

    #findConnections(roleName) {
        return Array.from(this.#connections).filter(connection => connection.roleName === roleName)
    }

    #findConnectionByPeer(peer) {
        return Array.from(this.#connections).find(connection => connection.peer === peer)
    }

    /**
     * Dispatches the "joinedRoom" message to registered application callbacks.
     */
    async joinedRoom(payload, peer) {
        for (const handler of this.#joinedRoomHandlers) {
            await handler(payload, peer)
        }
    }

    /**
     * Registers an application callback for the "joinedRoom" message.
     */
    onJoinedRoom(handler) {
        this.#joinedRoomHandlers.add(handler)
        return () => {
            this.#joinedRoomHandlers.delete(handler)
        }
    }

    /**
     * Dispatches the "receivedMessage" message to registered application callbacks.
     */
    async receivedMessage(payload, peer) {
        for (const handler of this.#receivedMessageHandlers) {
            await handler(payload, peer)
        }
    }

    /**
     * Registers an application callback for the "receivedMessage" message.
     */
    onReceivedMessage(handler) {
        this.#receivedMessageHandlers.add(handler)
        return () => {
            this.#receivedMessageHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for a raw transport message.
     */
    async handleRawMessage(data) {
        await this.handleMessage(decodeEnvelope(data))
    }

    /**
     * Framework entrypoint for a decoded OpenWS envelope.
     */
    async handleMessage(envelope) {
        const connections = this.#findConnections(envelope.fromRole)
        if (connections.length === 1) {
            await connections[0].session.handleMessage(
                envelope.fromRole,
                envelope.messageName,
                envelope.payload
            )
            return
        }
        if (connections.length > 1) {
            throw new Error(
                `Multiple sessions for remote role ${envelope.fromRole}; dispatch requires connection context`
            )
        }

        const localHandler = this.#handlersByMessageName[envelope.messageName]
        const localPeer = this.#peersByMessageName[envelope.messageName]
        if (envelope.fromRole === this.#fromRole && localHandler && localPeer) {
            await localHandler(envelope.payload, localPeer)
            return
        }

        throw new Error(`Remote role ${envelope.fromRole} not found`)
    }
}

function toOpenWsError(error) {
    return error instanceof Error ? error : new Error(String(error))
}
