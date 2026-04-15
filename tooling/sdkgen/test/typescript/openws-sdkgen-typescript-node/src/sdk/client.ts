import * as WS from '@polytric/openws/class'
import * as Fluent from '@polytric/openws/fluent'
import type { ApiProto } from '@polytric/openws/fluent'
import type {
    BindTransportOptions,
    OpenWsEndpoint,
    OpenWsEnvelope,
    Transport,
    Unsubscribe,
} from '../core/network'
import {
    WsTransport,
    bindTransport,
    canBindTransport,
    decodeEnvelope,
    encodeEnvelope,
} from '../core/network'
import type { JoinedRoomPayload, ReceivedMessagePayload } from '../core/models/client'
export * from '../core/models/client'
import { ClientHost, Server, type ServerApi } from '../core/roles'

export type ClientServerApi = Pick<ServerApi, 'createRoom' | 'joinRoom' | 'sendMessage'>

export type ClientPeerApi = ClientServerApi

export type ClientMessageHandler<TPayload, TApi = ClientPeerApi> = (
    payload: TPayload,
    api: TApi
) => void | Promise<void>

export type ClientErrorHandler = (error: unknown) => void | Promise<void>

export class Client {
    static readonly CONFIG = ClientHost.CONFIG

    readonly name = Client.CONFIG.name
    readonly description = Client.CONFIG.description
    serverApi!: ClientServerApi

    private readonly binder: Fluent.NetworkBinder
    private readonly runtime: Fluent.Runtime
    private readonly fromRole = 'client'
    private readonly sendEnvelope: (
        toRole: string,
        messageName: string,
        payload: unknown
    ) => Promise<void>
    private transportUnsubscribe?: Unsubscribe
    private readonly apisByRole: Record<string, ApiProto> = {}
    private readonly apisByMessageName: Record<string, ApiProto> = {}
    private readonly handlersByMessageName: Record<
        string,
        (payload: unknown, api: ClientPeerApi) => Promise<void>
    > = {}
    private readonly messageErrorHandlers = new Set<ClientErrorHandler>()
    private readonly socketErrorHandlers = new Set<ClientErrorHandler>()
    private readonly joinedRoomHandlers = new Set<
        ClientMessageHandler<JoinedRoomPayload, ClientServerApi>
    >()
    private readonly receivedMessageHandlers = new Set<
        ClientMessageHandler<ReceivedMessagePayload, ClientServerApi>
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
        this.handlersByMessageName['joinedRoom'] = async (payload, api) => {
            await this.joinedRoom(payload as JoinedRoomPayload, api as ClientServerApi)
        }
        this.binder.fromRoles['server'].on('joinedRoom', async (payload, api) => {
            await this.joinedRoom(payload as JoinedRoomPayload, api as unknown as ClientServerApi)
        })
        this.handlersByMessageName['receivedMessage'] = async (payload, api) => {
            await this.receivedMessage(payload as ReceivedMessagePayload, api as ClientServerApi)
        }
        this.binder.fromRoles['server'].on('receivedMessage', async (payload, api) => {
            await this.receivedMessage(
                payload as ReceivedMessagePayload,
                api as unknown as ClientServerApi
            )
        })
        if (canBindTransport(transport)) {
            this.bindTransport(transport)
        }
    }

    async connect(roleName: 'server', endpoint?: OpenWsEndpoint): Promise<ClientServerApi>
    async connect(roleName: string, endpoint?: OpenWsEndpoint): Promise<ClientPeerApi> {
        switch (roleName) {
            case 'server': {
                const remoteEndpoint =
                    endpoint ??
                    ({ scheme: 'ws', host: 'localhost', port: 8082, path: '/chat' } as
                        | OpenWsEndpoint
                        | undefined)
                await this.transport.connect?.(roleName, remoteEndpoint)
                if (!this.apisByRole['server']) {
                    const serverApi = this.runtime.createApi('server', this.sendEnvelope)
                    this.serverApi = serverApi as unknown as ClientServerApi
                    this.apisByRole['server'] = serverApi
                    this.apisByMessageName['joinedRoom'] = serverApi
                    this.apisByMessageName['receivedMessage'] = serverApi
                }
                return this.serverApi
            }
            default:
                throw new Error(`Remote role ${roleName} not found`)
        }
    }

    async disconnect(roleName: string): Promise<void> {
        await this.transport.disconnect?.(roleName)
        delete this.apisByRole[roleName]
    }

    bindTransport(
        transport: Transport = this.transport,
        options: BindTransportOptions = {}
    ): Unsubscribe {
        this.transportUnsubscribe?.()
        this.transportUnsubscribe = bindTransport(transport, this, options)
        return this.transportUnsubscribe
    }

    unbindTransport(): void {
        this.transportUnsubscribe?.()
        this.transportUnsubscribe = undefined
    }

    async messageError(error: unknown): Promise<void> {
        for (const handler of this.messageErrorHandlers) {
            await handler(error)
        }
    }

    onMessageError(handler: ClientErrorHandler): Unsubscribe {
        this.messageErrorHandlers.add(handler)
        return () => {
            this.messageErrorHandlers.delete(handler)
        }
    }

    async socketError(error: unknown): Promise<void> {
        for (const handler of this.socketErrorHandlers) {
            await handler(error)
        }
    }

    onSocketError(handler: ClientErrorHandler): Unsubscribe {
        this.socketErrorHandlers.add(handler)
        return () => {
            this.socketErrorHandlers.delete(handler)
        }
    }

    async joinedRoom(payload: JoinedRoomPayload, api: ClientServerApi): Promise<void> {
        for (const handler of this.joinedRoomHandlers) {
            await handler(payload, api)
        }
    }

    onJoinedRoom(handler: ClientMessageHandler<JoinedRoomPayload, ClientServerApi>): Unsubscribe {
        this.joinedRoomHandlers.add(handler)
        return () => {
            this.joinedRoomHandlers.delete(handler)
        }
    }

    async receivedMessage(payload: ReceivedMessagePayload, api: ClientServerApi): Promise<void> {
        for (const handler of this.receivedMessageHandlers) {
            await handler(payload, api)
        }
    }

    onReceivedMessage(
        handler: ClientMessageHandler<ReceivedMessagePayload, ClientServerApi>
    ): Unsubscribe {
        this.receivedMessageHandlers.add(handler)
        return () => {
            this.receivedMessageHandlers.delete(handler)
        }
    }

    async handleRawMessage(data: string): Promise<void> {
        await this.handleMessage(decodeEnvelope(data))
    }

    async handleMessage(envelope: OpenWsEnvelope): Promise<void> {
        const remote = this.binder.fromRoles[envelope.fromRole]
        const api = this.apisByRole[envelope.fromRole]
        if (remote && api) {
            await remote.handleMessage(envelope.messageName, envelope.payload, api)
            return
        }

        const localHandler = this.handlersByMessageName[envelope.messageName]
        const localApi = this.apisByMessageName[envelope.messageName]
        if (envelope.fromRole === this.fromRole && localHandler && localApi) {
            await localHandler(envelope.payload, localApi as unknown as ClientPeerApi)
            return
        }

        throw new Error(`Remote role ${envelope.fromRole} not found`)
    }
}
