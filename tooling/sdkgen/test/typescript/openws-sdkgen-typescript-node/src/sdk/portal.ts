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
import type { ReceivedRoomStatsPayload } from '../core/models/portal'
export * from '../core/models/portal'
import { PortalHost, Server, type ServerApi } from '../core/roles'

export type PortalServerApi = Pick<ServerApi, 'sendMessage' | 'requestRoomStats'>

export type PortalPeerApi = PortalServerApi

export type PortalMessageHandler<TPayload, TApi = PortalPeerApi> = (
    payload: TPayload,
    api: TApi
) => void | Promise<void>

export type PortalErrorHandler = (error: unknown) => void | Promise<void>

export class Portal {
    static readonly CONFIG = PortalHost.CONFIG

    readonly name = Portal.CONFIG.name
    readonly description = Portal.CONFIG.description
    serverApi!: PortalServerApi

    private readonly binder: Fluent.NetworkBinder
    private readonly runtime: Fluent.Runtime
    private readonly fromRole = 'portal'
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
        (payload: unknown, api: PortalPeerApi) => Promise<void>
    > = {}
    private readonly messageErrorHandlers = new Set<PortalErrorHandler>()
    private readonly socketErrorHandlers = new Set<PortalErrorHandler>()
    private readonly receivedRoomStatsHandlers = new Set<
        PortalMessageHandler<ReceivedRoomStatsPayload, PortalServerApi>
    >()

    constructor(protected readonly transport: Transport = new WsTransport()) {
        const HostRole = this.constructor as typeof Portal
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
        this.handlersByMessageName['receivedRoomStats'] = async (payload, api) => {
            await this.receivedRoomStats(
                payload as ReceivedRoomStatsPayload,
                api as PortalServerApi
            )
        }
        this.binder.fromRoles['server'].on('receivedRoomStats', async (payload, api) => {
            await this.receivedRoomStats(
                payload as ReceivedRoomStatsPayload,
                api as unknown as PortalServerApi
            )
        })
        if (canBindTransport(transport)) {
            this.bindTransport(transport)
        }
    }

    async connect(roleName: 'server', endpoint?: OpenWsEndpoint): Promise<PortalServerApi>
    async connect(roleName: string, endpoint?: OpenWsEndpoint): Promise<PortalPeerApi> {
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
                    this.serverApi = serverApi as unknown as PortalServerApi
                    this.apisByRole['server'] = serverApi
                    this.apisByMessageName['receivedRoomStats'] = serverApi
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

    onMessageError(handler: PortalErrorHandler): Unsubscribe {
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

    onSocketError(handler: PortalErrorHandler): Unsubscribe {
        this.socketErrorHandlers.add(handler)
        return () => {
            this.socketErrorHandlers.delete(handler)
        }
    }

    async receivedRoomStats(
        payload: ReceivedRoomStatsPayload,
        api: PortalServerApi
    ): Promise<void> {
        for (const handler of this.receivedRoomStatsHandlers) {
            await handler(payload, api)
        }
    }

    onReceivedRoomStats(
        handler: PortalMessageHandler<ReceivedRoomStatsPayload, PortalServerApi>
    ): Unsubscribe {
        this.receivedRoomStatsHandlers.add(handler)
        return () => {
            this.receivedRoomStatsHandlers.delete(handler)
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
            await localHandler(envelope.payload, localApi as unknown as PortalPeerApi)
            return
        }

        throw new Error(`Remote role ${envelope.fromRole} not found`)
    }
}
