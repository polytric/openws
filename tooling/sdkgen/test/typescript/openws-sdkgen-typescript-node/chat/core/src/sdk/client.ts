import * as WS from '@polytric/openws/class'
import * as Fluent from '@polytric/openws/fluent'
import type { PeerProto } from '@polytric/openws/fluent'
import type {
    BindTransportOptions,
    OpenWsEndpoint,
    OpenWsEnvelope,
    Transport,
    Unsubscribe,
} from '../network'
import {
    WsTransport,
    bindTransport,
    canBindTransport,
    decodeEnvelope,
    encodeEnvelope,
} from '../network'
import type { JoinedRoomPayload, ReceivedMessagePayload } from '../models/client'
export * from '../models/client'
import { ClientHost, Server, type ServerPeer } from '../roles'

/**
 * Connected "server" peer handle as seen by Client.
 */
export type ClientServerPeer = Pick<ServerPeer, 'createRoom' | 'joinRoom' | 'sendMessage'>

/**
 * Union of peer handles this generated client can connect to.
 */
export type ClientPeer = ClientServerPeer

/**
 * Application callback for a received OpenWS message.
 */
export type ClientMessageHandler<TPayload, TPeer = ClientPeer> = (
    payload: TPayload,
    peer: TPeer
) => void | Promise<void>

/**
 * Application callback for message or socket errors.
 */
export type ClientErrorHandler = (error: unknown) => void | Promise<void>
/**
 * Application callback for connection lifecycle events.
 */
export type ClientLifecycleHandler = (roleName: string) => void | Promise<void>
/**
 * Application callback for connection lifecycle errors.
 */
export type ClientLifecycleErrorHandler = (roleName: string, error: Error) => void | Promise<void>

type ClientConnection = {
    roleName: string
    session: Fluent.Session
    peer: PeerProto
}

/**
 * Generated OpenWS client for the "client" role in the "core" network.
 *
 * Application code calls command methods such as `connect` and registers
 * callbacks with `on...` methods. Transport and framework glue call `handle...`
 * methods to deliver inbound data, errors, and lifecycle events.
 */
export class Client {
    static readonly CONFIG = ClientHost.CONFIG

    readonly name = Client.CONFIG.name
    readonly description = Client.CONFIG.description
    serverPeer!: ClientServerPeer

    private readonly binder: Fluent.NetworkBinder
    private readonly runtime: Fluent.Runtime
    private readonly fromRole = 'client'
    private readonly sendEnvelope: (
        toRole: string,
        messageName: string,
        payload: unknown
    ) => Promise<void>
    private transportUnsubscribe?: Unsubscribe
    private readonly connections = new Set<ClientConnection>()
    private readonly peersByMessageName: Record<string, PeerProto> = {}
    private readonly peerRoleByMessageName: Record<string, string> = {}
    private readonly handlersByMessageName: Record<
        string,
        (payload: unknown, peer: ClientPeer) => Promise<void>
    > = {}
    private readonly messageErrorHandlers = new Set<ClientErrorHandler>()
    private readonly socketErrorHandlers = new Set<ClientErrorHandler>()
    private readonly openHandlers = new Set<ClientLifecycleHandler>()
    private readonly closeHandlers = new Set<ClientLifecycleHandler>()
    private readonly lifecycleErrorHandlers = new Set<ClientLifecycleErrorHandler>()
    private readonly joinedRoomHandlers = new Set<
        ClientMessageHandler<JoinedRoomPayload, ClientServerPeer>
    >()
    private readonly receivedMessageHandlers = new Set<
        ClientMessageHandler<ReceivedMessagePayload, ClientServerPeer>
    >()

    constructor(protected readonly transport: Transport = new WsTransport()) {
        const HostRole = this.constructor as typeof Client
        this.binder = Fluent.bindings(
            WS.network({
                name: 'core',
                description: 'A chat network',
                version: '1.0.0',
                roles: [HostRole, Server],
            })
        )
        this.runtime = WS.runtime(this.binder)
        this.sendEnvelope = async (_toRole: string, messageName: string, payload: unknown) => {
            await this.transport.send(
                encodeEnvelope({ fromRole: this.fromRole, messageName, payload })
            )
        }
        this.handlersByMessageName['joinedRoom'] = async (payload, peer) => {
            await this.joinedRoom(payload as JoinedRoomPayload, peer as ClientServerPeer)
        }
        this.binder.fromRoles['server'].on('joinedRoom', async (payload, peer) => {
            await this.joinedRoom(payload as JoinedRoomPayload, peer as unknown as ClientServerPeer)
        })
        this.handlersByMessageName['receivedMessage'] = async (payload, peer) => {
            await this.receivedMessage(payload as ReceivedMessagePayload, peer as ClientServerPeer)
        }
        this.binder.fromRoles['server'].on('receivedMessage', async (payload, peer) => {
            await this.receivedMessage(
                payload as ReceivedMessagePayload,
                peer as unknown as ClientServerPeer
            )
        })
        this.binder.fromRoles['server'].onOpen(async fromRole => {
            await this.handleOpen(fromRole)
        })
        this.binder.fromRoles['server'].onClose(async fromRole => {
            await this.handleClose(fromRole)
        })
        this.binder.fromRoles['server'].onError(async (fromRole, error) => {
            await this.handleError(fromRole, error)
        })
        if (canBindTransport(transport)) {
            this.bindTransport(transport)
        }
    }

    /**
     * Connects this client to the "server" role and returns the connected peer handle.
     */
    async connect(roleName: 'server', endpoint?: OpenWsEndpoint): Promise<ClientServerPeer>
    async connect(roleName: string, endpoint?: OpenWsEndpoint): Promise<ClientPeer> {
        switch (roleName) {
            case 'server': {
                const remoteEndpoint =
                    endpoint ??
                    ({ scheme: 'ws', host: 'localhost', port: 8082, path: '/chat' } as
                        | OpenWsEndpoint
                        | undefined)
                await this.transport.connect?.(roleName, remoteEndpoint)
                const session = this.runtime.newSession(this.sendEnvelope)
                const serverPeer = await session.open('server')
                this.connections.add({
                    roleName: 'server',
                    session,
                    peer: serverPeer,
                })
                this.serverPeer = serverPeer as unknown as ClientServerPeer
                this.peersByMessageName['joinedRoom'] = serverPeer
                this.peerRoleByMessageName['joinedRoom'] = 'server'
                this.peersByMessageName['receivedMessage'] = serverPeer
                this.peerRoleByMessageName['receivedMessage'] = 'server'
                return this.serverPeer
            }
            default:
                throw new Error(`Remote role ${roleName} not found`)
        }
    }

    async disconnect(peer: ClientServerPeer): Promise<void>
    async disconnect(peer: string): Promise<void>
    /**
     * Disconnects from a peer and closes its session.
     *
     * Pass the peer returned by `connect` to close that exact peer connection.
     * Passing a role name closes all active peer connections for that role.
     */
    async disconnect(peer: string | ClientPeer): Promise<void> {
        if (typeof peer === 'string') {
            await this.transport.disconnect?.(peer)
            await this.closeSessions(peer)
            return
        }
        const connection = this.findConnectionByPeer(peer as PeerProto)
        if (!connection) {
            throw new Error('Peer is not connected')
        }
        await this.closeConnection(connection)
    }

    /**
     * Binds a transport to this client.
     *
     * Transport events call this client's `handle...` methods. Application code
     * should use `on...` methods to observe those events.
     */
    bindTransport(
        transport: Transport = this.transport,
        options: BindTransportOptions = {}
    ): Unsubscribe {
        this.transportUnsubscribe?.()
        this.transportUnsubscribe = bindTransport(transport, this, options)
        return this.transportUnsubscribe
    }

    /**
     * Removes the current transport event bindings.
     */
    unbindTransport(): void {
        this.transportUnsubscribe?.()
        this.transportUnsubscribe = undefined
    }

    /**
     * Framework entrypoint for message decoding or dispatch failures.
     */
    async handleMessageError(error: unknown): Promise<void> {
        for (const handler of this.messageErrorHandlers) {
            await handler(error)
        }
    }

    /**
     * Registers an application callback for message decoding or dispatch failures.
     */
    onMessageError(handler: ClientErrorHandler): Unsubscribe {
        this.messageErrorHandlers.add(handler)
        return () => {
            this.messageErrorHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for transport-level socket errors.
     */
    async handleSocketError(error: unknown): Promise<void> {
        const sessionError = toOpenWsError(error)
        for (const connection of this.connections) {
            await connection.session.error(sessionError)
        }
        for (const handler of this.socketErrorHandlers) {
            await handler(error)
        }
    }

    /**
     * Registers an application callback for transport-level socket errors.
     */
    onSocketError(handler: ClientErrorHandler): Unsubscribe {
        this.socketErrorHandlers.add(handler)
        return () => {
            this.socketErrorHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for transport-level socket close events.
     */
    async handleSocketClose(_event: unknown): Promise<void> {
        for (const connection of Array.from(this.connections)) {
            await this.closeConnection(connection)
        }
    }

    /**
     * Framework entrypoint for a peer session opening.
     */
    async handleOpen(roleName: string): Promise<void> {
        for (const handler of this.openHandlers) {
            await handler(roleName)
        }
    }

    /**
     * Registers an application callback for peer session open events.
     */
    onOpen(handler: ClientLifecycleHandler): Unsubscribe {
        this.openHandlers.add(handler)
        return () => {
            this.openHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for a peer session closing.
     */
    async handleClose(roleName: string): Promise<void> {
        for (const handler of this.closeHandlers) {
            await handler(roleName)
        }
    }

    /**
     * Registers an application callback for peer session close events.
     */
    onClose(handler: ClientLifecycleHandler): Unsubscribe {
        this.closeHandlers.add(handler)
        return () => {
            this.closeHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for a peer session error.
     */
    async handleError(roleName: string, error: Error): Promise<void> {
        for (const handler of this.lifecycleErrorHandlers) {
            await handler(roleName, error)
        }
    }

    /**
     * Registers an application callback for peer session errors.
     */
    onError(handler: ClientLifecycleErrorHandler): Unsubscribe {
        this.lifecycleErrorHandlers.add(handler)
        return () => {
            this.lifecycleErrorHandlers.delete(handler)
        }
    }

    private async closeSessions(roleName: string): Promise<void> {
        for (const connection of this.findConnections(roleName)) {
            await this.closeConnection(connection)
        }
    }

    private async closeConnection(connection: ClientConnection): Promise<void> {
        if (!this.connections.delete(connection)) {
            return
        }
        if (this.findConnections(connection.roleName).length === 0) {
            for (const [messageName, peerRoleName] of Object.entries(this.peerRoleByMessageName)) {
                if (peerRoleName !== connection.roleName) {
                    continue
                }
                delete this.peersByMessageName[messageName]
                delete this.peerRoleByMessageName[messageName]
            }
        }
        await connection.session.close()
    }

    private findConnections(roleName: string): ClientConnection[] {
        return Array.from(this.connections).filter(connection => connection.roleName === roleName)
    }

    private findConnectionByPeer(peer: PeerProto): ClientConnection | undefined {
        return Array.from(this.connections).find(connection => connection.peer === peer)
    }

    /**
     * Dispatches the "joinedRoom" message to registered application callbacks.
     */
    async joinedRoom(payload: JoinedRoomPayload, peer: ClientServerPeer): Promise<void> {
        for (const handler of this.joinedRoomHandlers) {
            await handler(payload, peer)
        }
    }

    /**
     * Registers an application callback for the "joinedRoom" message.
     */
    onJoinedRoom(handler: ClientMessageHandler<JoinedRoomPayload, ClientServerPeer>): Unsubscribe {
        this.joinedRoomHandlers.add(handler)
        return () => {
            this.joinedRoomHandlers.delete(handler)
        }
    }

    /**
     * Dispatches the "receivedMessage" message to registered application callbacks.
     */
    async receivedMessage(payload: ReceivedMessagePayload, peer: ClientServerPeer): Promise<void> {
        for (const handler of this.receivedMessageHandlers) {
            await handler(payload, peer)
        }
    }

    /**
     * Registers an application callback for the "receivedMessage" message.
     */
    onReceivedMessage(
        handler: ClientMessageHandler<ReceivedMessagePayload, ClientServerPeer>
    ): Unsubscribe {
        this.receivedMessageHandlers.add(handler)
        return () => {
            this.receivedMessageHandlers.delete(handler)
        }
    }

    /**
     * Framework entrypoint for a raw transport message.
     */
    async handleRawMessage(data: string): Promise<void> {
        await this.handleMessage(decodeEnvelope(data))
    }

    /**
     * Framework entrypoint for a decoded OpenWS envelope.
     */
    async handleMessage(envelope: OpenWsEnvelope): Promise<void> {
        const connections = this.findConnections(envelope.fromRole)
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

        const localHandler = this.handlersByMessageName[envelope.messageName]
        const localPeer = this.peersByMessageName[envelope.messageName]
        if (envelope.fromRole === this.fromRole && localHandler && localPeer) {
            await localHandler(envelope.payload, localPeer as unknown as ClientPeer)
            return
        }

        throw new Error(`Remote role ${envelope.fromRole} not found`)
    }
}

function toOpenWsError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error))
}
