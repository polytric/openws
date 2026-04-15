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
import type {
    CreateRoomPayload,
    JoinRoomPayload,
    SendMessagePayload,
    RequestRoomStatsPayload,
} from '../core/models/server'
export * from '../core/models/server'
import { ServerHost, Client, type ClientApi, Portal, type PortalApi } from '../core/roles'

export type ServerClientApi = Pick<ClientApi, 'joinedRoom' | 'receivedMessage'>
export type ServerPortalApi = Pick<PortalApi, 'receivedRoomStats'>

export type ServerPeerApi = ServerClientApi | ServerPortalApi

export type ServerMessageHandler<TPayload, TApi = ServerPeerApi> = (
    payload: TPayload,
    api: TApi
) => void | Promise<void>

export type ServerErrorHandler = (error: unknown) => void | Promise<void>

export class Server {
    static readonly CONFIG = ServerHost.CONFIG

    readonly name = Server.CONFIG.name
    readonly description = Server.CONFIG.description
    clientApi!: ServerClientApi
    portalApi!: ServerPortalApi

    private readonly binder: Fluent.NetworkBinder
    private readonly runtime: Fluent.Runtime
    private readonly fromRole = 'server'
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
        (payload: unknown, api: ServerPeerApi) => Promise<void>
    > = {}
    private readonly messageErrorHandlers = new Set<ServerErrorHandler>()
    private readonly socketErrorHandlers = new Set<ServerErrorHandler>()
    private readonly createRoomHandlers = new Set<
        ServerMessageHandler<CreateRoomPayload, ServerClientApi>
    >()
    private readonly joinRoomHandlers = new Set<
        ServerMessageHandler<JoinRoomPayload, ServerClientApi>
    >()
    private readonly sendMessageHandlers = new Set<
        ServerMessageHandler<SendMessagePayload, ServerClientApi | ServerPortalApi>
    >()
    private readonly requestRoomStatsHandlers = new Set<
        ServerMessageHandler<RequestRoomStatsPayload, ServerPortalApi>
    >()

    constructor(protected readonly transport: Transport = new WsTransport()) {
        const HostRole = this.constructor as typeof Server
        this.binder = Fluent.bindings(
            WS.network({
                name: 'core',
                description: 'A chat network',
                version: '1.0.0',
                roles: [HostRole, Client, Portal],
            })
        )
        this.runtime = WS.runtime(this.binder)
        this.sendEnvelope = async (_toRole: string, messageName: string, payload: unknown) => {
            await this.transport.send(
                encodeEnvelope({ fromRole: this.fromRole, messageName, payload })
            )
        }
        this.handlersByMessageName['createRoom'] = async (payload, api) => {
            await this.createRoom(payload as CreateRoomPayload, api as ServerClientApi)
        }
        this.binder.fromRoles['client'].on('createRoom', async (payload, api) => {
            await this.createRoom(payload as CreateRoomPayload, api as unknown as ServerClientApi)
        })
        this.handlersByMessageName['joinRoom'] = async (payload, api) => {
            await this.joinRoom(payload as JoinRoomPayload, api as ServerClientApi)
        }
        this.binder.fromRoles['client'].on('joinRoom', async (payload, api) => {
            await this.joinRoom(payload as JoinRoomPayload, api as unknown as ServerClientApi)
        })
        this.handlersByMessageName['sendMessage'] = async (payload, api) => {
            await this.sendMessage(
                payload as SendMessagePayload,
                api as ServerClientApi | ServerPortalApi
            )
        }
        this.binder.fromRoles['client'].on('sendMessage', async (payload, api) => {
            await this.sendMessage(
                payload as SendMessagePayload,
                api as unknown as ServerClientApi | ServerPortalApi
            )
        })
        this.binder.fromRoles['portal'].on('sendMessage', async (payload, api) => {
            await this.sendMessage(
                payload as SendMessagePayload,
                api as unknown as ServerClientApi | ServerPortalApi
            )
        })
        this.handlersByMessageName['requestRoomStats'] = async (payload, api) => {
            await this.requestRoomStats(payload as RequestRoomStatsPayload, api as ServerPortalApi)
        }
        this.binder.fromRoles['portal'].on('requestRoomStats', async (payload, api) => {
            await this.requestRoomStats(
                payload as RequestRoomStatsPayload,
                api as unknown as ServerPortalApi
            )
        })
        if (canBindTransport(transport)) {
            this.bindTransport(transport)
        }
    }

    async connect(roleName: 'client', endpoint?: OpenWsEndpoint): Promise<ServerClientApi>
    async connect(roleName: 'portal', endpoint?: OpenWsEndpoint): Promise<ServerPortalApi>
    async connect(roleName: string, endpoint?: OpenWsEndpoint): Promise<ServerPeerApi> {
        switch (roleName) {
            case 'client': {
                const remoteEndpoint = endpoint ?? (undefined as OpenWsEndpoint | undefined)
                await this.transport.connect?.(roleName, remoteEndpoint)
                if (!this.apisByRole['client']) {
                    const clientApi = this.runtime.createApi('client', this.sendEnvelope)
                    this.clientApi = clientApi as unknown as ServerClientApi
                    this.apisByRole['client'] = clientApi
                    this.apisByMessageName['createRoom'] = clientApi
                    this.apisByMessageName['joinRoom'] = clientApi
                    this.apisByMessageName['sendMessage'] = clientApi
                }
                return this.clientApi
            }
            case 'portal': {
                const remoteEndpoint = endpoint ?? (undefined as OpenWsEndpoint | undefined)
                await this.transport.connect?.(roleName, remoteEndpoint)
                if (!this.apisByRole['portal']) {
                    const portalApi = this.runtime.createApi('portal', this.sendEnvelope)
                    this.portalApi = portalApi as unknown as ServerPortalApi
                    this.apisByRole['portal'] = portalApi
                    this.apisByMessageName['requestRoomStats'] = portalApi
                }
                return this.portalApi
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

    onMessageError(handler: ServerErrorHandler): Unsubscribe {
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

    onSocketError(handler: ServerErrorHandler): Unsubscribe {
        this.socketErrorHandlers.add(handler)
        return () => {
            this.socketErrorHandlers.delete(handler)
        }
    }

    async createRoom(payload: CreateRoomPayload, api: ServerClientApi): Promise<void> {
        for (const handler of this.createRoomHandlers) {
            await handler(payload, api)
        }
    }

    onCreateRoom(handler: ServerMessageHandler<CreateRoomPayload, ServerClientApi>): Unsubscribe {
        this.createRoomHandlers.add(handler)
        return () => {
            this.createRoomHandlers.delete(handler)
        }
    }

    async joinRoom(payload: JoinRoomPayload, api: ServerClientApi): Promise<void> {
        for (const handler of this.joinRoomHandlers) {
            await handler(payload, api)
        }
    }

    onJoinRoom(handler: ServerMessageHandler<JoinRoomPayload, ServerClientApi>): Unsubscribe {
        this.joinRoomHandlers.add(handler)
        return () => {
            this.joinRoomHandlers.delete(handler)
        }
    }

    async sendMessage(
        payload: SendMessagePayload,
        api: ServerClientApi | ServerPortalApi
    ): Promise<void> {
        for (const handler of this.sendMessageHandlers) {
            await handler(payload, api)
        }
    }

    onSendMessage(
        handler: ServerMessageHandler<SendMessagePayload, ServerClientApi | ServerPortalApi>
    ): Unsubscribe {
        this.sendMessageHandlers.add(handler)
        return () => {
            this.sendMessageHandlers.delete(handler)
        }
    }

    async requestRoomStats(payload: RequestRoomStatsPayload, api: ServerPortalApi): Promise<void> {
        for (const handler of this.requestRoomStatsHandlers) {
            await handler(payload, api)
        }
    }

    onRequestRoomStats(
        handler: ServerMessageHandler<RequestRoomStatsPayload, ServerPortalApi>
    ): Unsubscribe {
        this.requestRoomStatsHandlers.add(handler)
        return () => {
            this.requestRoomStatsHandlers.delete(handler)
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
            await localHandler(envelope.payload, localApi as unknown as ServerPeerApi)
            return
        }

        throw new Error(`Remote role ${envelope.fromRole} not found`)
    }
}
