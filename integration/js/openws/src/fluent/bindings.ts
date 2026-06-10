import Ajv, { type ValidateFunction } from 'ajv'

import * as Builder from '@polytric/openws-spec/builder'

const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    strictSchema: false,
})

type HandlerBinder = {
    fromRole: string
    messageName: string
    validatePayload: ValidateFunction
    handler: (payload: any, peer: PeerProto) => Promise<void>
}

/**
 * Sends or dispatches a message associated with a remote role.
 *
 * Outbound API helpers use the first argument as the peer role being addressed.
 * Inbound session dispatch uses it as the peer role that sent the message.
 * Transport glue usually implements outbound sends by encoding an envelope and
 * writing it to a socket.
 */
export type SendFn = (fromRole: string, messageName: string, payload: any) => Promise<void>

/**
 * Closes the transport/session associated with a connected peer handle.
 */
export type DisconnectFn = () => Promise<void> | void

const peerDisconnects = new WeakMap<PeerProto, DisconnectFn>()

/**
 * Runtime peer handle exposed to message handlers for replying to the connected peer.
 *
 * `rawSend` is the transport-provided send function. Message names from the
 * remote role are added as methods at runtime and validate payloads before
 * calling `rawSend`.
 */
export type PeerProto = {
    rawSend: SendFn
    [messageName: string]: (...args: any[]) => Promise<void>
}

export async function disconnect(peer: PeerProto): Promise<void> {
    const disconnectPeer = peerDisconnects.get(peer)
    if (!disconnectPeer) {
        throw new Error('Peer is not connected')
    }
    await disconnectPeer()
}

/**
 * Runtime bindings for one remote role in a network.
 *
 * A `RemoteRoleBinder` is created by `NetworkBinder` for each non-host role in
 * the network spec. It stores the behavior attached to that role: lifecycle
 * callbacks, inbound message handlers, and the peer handle shape that handlers
 * use to reply to the connected peer.
 */
export class RemoteRoleBinder {
    private readonly hostMessages: { [messageName: string]: Builder.Message } = {}
    private readonly handlers: {
        [messageName: string]: HandlerBinder
    } = {}
    private readonly peerProto: { [key: string]: any } = {}

    constructor(
        public readonly role: Builder.Role,
        hostMessages: Builder.Message[]
    ) {
        for (const message of hostMessages) {
            this.hostMessages[message.name] = message
        }
        for (const message of Object.values(this.role.messages)) {
            const payloadSchema = message.getPayload()?.valueOf()
            const validate = payloadSchema
                ? ajv.compile(payloadSchema)
                : ((() => true) as unknown as ValidateFunction)
            this.peerProto[message.name] = async function (this: PeerProto, payload: any) {
                if (!validate(payload)) {
                    throw new Error(`Invalid payload for message ${message.name}`, {
                        cause: validate.errors,
                    })
                }
                return this.rawSend(role.name, message.name, payload)
            }
        }
    }

    /**
     * Registers a callback for when a session is opened by this remote role.
     *
     * This is called by `Session.open(fromRole)`. WebSocket or framework glue is
     * responsible for translating the concrete socket open event into that
     * session call.
     */
    onOpen(handler: (fromRole: string, peer: PeerProto) => Promise<void>): this {
        this.handleOpen = handler
        return this
    }
    /**
     * Registers a callback for when a session for this remote role closes.
     *
     * This is called by `Session.close()`. The session must have been opened
     * first so the runtime knows which remote role owns the connection.
     */
    onClose(handler: (fromRole: string, peer: PeerProto) => Promise<void>): this {
        this.handleClose = handler
        return this
    }
    /**
     * Registers a callback for transport or connection errors on this role.
     *
     * This is called by `Session.error(error)`. Message dispatch errors are
     * thrown by `handleMessage`; generated SDK clients may expose those through
     * separate message-error callbacks.
     */
    onError(handler: (fromRole: string, peer: PeerProto, error: Error) => Promise<void>): this {
        this.handleError = handler
        return this
    }

    /**
     * Registers an inbound message handler for this remote role.
     *
     * The message name must refer to a host message in the network. Payloads are
     * validated against the message schema before the handler runs. The `peer`
     * argument contains outbound methods for messages the host can send back to
     * the connected peer.
     */
    on(messageName: string, handler: (payload: any, peer: PeerProto) => Promise<void>): this {
        const message = this.hostMessages[messageName]
        if (!message) {
            throw new Error(`Message ${messageName} not found in host messages`)
        }
        const payloadSchema = message.getPayload()?.valueOf()
        const validate = payloadSchema ? ajv.compile(payloadSchema) : () => true
        this.handlers[messageName] = {
            fromRole: this.role.name,
            messageName: message.name,
            validatePayload: validate as ValidateFunction,
            handler,
        }
        return this
    }

    handleOpen: (fromRole: string, peer: PeerProto) => Promise<void> = async () => {}
    handleClose: (fromRole: string, peer: PeerProto) => Promise<void> = async () => {}
    handleError: (fromRole: string, peer: PeerProto, error: Error) => Promise<void> = async () => {}

    /**
     * Dispatches an inbound message from this remote role to its registered
     * handler after validating the payload.
     */
    async handleMessage(messageName: string, payload: any, peer: PeerProto) {
        const handler = this.handlers[messageName]
        if (!handler) {
            throw new Error(`Handler for message ${messageName} not found`)
        }
        if (!handler.validatePayload(payload)) {
            throw new Error(`Invalid payload for message ${messageName}`, {
                cause: handler.validatePayload.errors,
            })
        }
        await handler.handler(payload, peer)
    }

    /**
     * Creates a role-aware outbound peer handle backed by a transport send function.
     *
     * Runtime and SDK code use this to materialize the message methods that are
     * passed to handlers or returned from `Runtime.createPeer`.
     */
    createPeer(send: SendFn, disconnectPeer?: DisconnectFn) {
        const peer = Object.create(this.peerProto) as PeerProto
        peer.rawSend = send
        if (disconnectPeer) {
            peerDisconnects.set(peer, disconnectPeer)
        }
        return peer
    }
}

/**
 * Runtime behavior attached to a declarative OpenWS network.
 *
 * The network is the memory graph of the spec. A `NetworkBinder` keeps that
 * graph available through `network` and creates one `RemoteRoleBinder` for each
 * remote role so application code can attach behavior to the spec.
 */
export class NetworkBinder {
    /**
     * Runtime bindings keyed by remote role name.
     *
     * Host roles are excluded. Each entry represents behavior for a peer role
     * that can open sessions, send messages, and receive replies.
     */
    fromRoles: { [fromRoleName: string]: RemoteRoleBinder } = {}

    #network: Builder.Network
    /**
     * The normalized network graph used for runtime binding and spec export.
     */
    get network() {
        return this.#network
    }

    constructor(network: Builder.Network) {
        this.#network = network
        const hostMessages: Builder.Message[] = []
        const remoteRoles: Builder.Role[] = []
        for (const role of Object.values(network.roles)) {
            if (role.isHost) {
                for (const message of Object.values(role.messages)) {
                    hostMessages.push(message)
                }
            } else {
                remoteRoles.push(role)
            }
        }

        for (const remoteRole of remoteRoles) {
            this.fromRoles[remoteRole.name] = new RemoteRoleBinder(remoteRole, hostMessages)
        }
    }

    /**
     * Disconnects a connected peer handle created by a runtime session.
     */
    disconnect(peer: PeerProto) {
        return disconnect(peer)
    }
}
