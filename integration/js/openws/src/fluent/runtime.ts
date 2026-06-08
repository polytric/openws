import type { NetworkBinder, PeerProto, SendFn } from './bindings'

/**
 * Runtime state for one peer connection.
 *
 * A session is intentionally transport-agnostic. WebSocket, HTTP upgrade, test,
 * or adapter code should call `open`, `handleMessage`, `close`, and `error` as
 * the concrete connection changes state.
 */
export class Session {
    private peer?: PeerProto
    private fromRole?: string
    public remotePeers: { [role: string]: PeerProto } = {}

    constructor(
        private readonly binder: NetworkBinder,
        private readonly rawSend: SendFn
    ) {}

    /**
     * Opens this session as a connection from the given remote role.
     *
     * This creates the peer handle for the remote role, invokes the role's
     * `onOpen` callback, and returns the peer handle. Repeated calls return the
     * existing peer handle.
     */
    async open(fromRole: string) {
        if (this.peer) {
            return this.peer
        }
        this.fromRole = fromRole
        this.peer = this.binder.fromRoles[fromRole].createPeer(this.rawSend)
        await this.binder.fromRoles[fromRole].handleOpen?.(fromRole, this.peer)
        return this.peer
    }

    /**
     * Closes this session and invokes the remote role's `onClose` callback.
     *
     * Calling `close` before `open` is a no-op because there is no remote role
     * associated with the session yet.
     */
    async close() {
        if (!this.fromRole || !this.peer) {
            return // not opened
        }
        await this.binder.fromRoles[this.fromRole].handleClose?.(this.fromRole, this.peer)
    }

    /**
     * Reports a connection-level error for this session.
     *
     * This invokes the remote role's `onError` callback. Calling `error` before
     * `open` is a no-op because there is no remote role associated with the
     * session yet.
     */
    async error(error: Error) {
        if (!this.fromRole || !this.peer) {
            return // not opened
        }
        await this.binder.fromRoles[this.fromRole].handleError?.(this.fromRole, this.peer, error)
    }

    /**
     * Dispatches an inbound message through the bindings for this session.
     *
     * The session must be opened first so handlers receive the correct reply
     * peer handle for the connected peer.
     */
    handleMessage: SendFn = async (fromRole, messageName, payload) => {
        if (!this.peer) {
            throw new Error('Session not opened')
        }
        await this.binder.fromRoles[fromRole].handleMessage(messageName, payload, this.peer)
    }
}

/**
 * Materializes runtime helpers from a `NetworkBinder`.
 *
 * The binder stores behavior attached to the spec. The runtime turns that
 * behavior into concrete peer handles and per-connection sessions.
 */
export class Runtime {
    constructor(private readonly binder: NetworkBinder) {}

    /**
     * Creates an outbound peer handle for a remote role using a transport send function.
     *
     * This is useful for SDK clients and simple integrations that need a peer
     * handle without managing a full session lifecycle.
     */
    createPeer(remoteRole: string, rawSend: SendFn) {
        return this.binder.fromRoles[remoteRole].createPeer(rawSend)
    }

    /**
     * Creates a new connection-scoped session.
     *
     * Use this when transport glue should drive lifecycle callbacks and inbound
     * message dispatch for a single socket or peer connection.
     */
    newSession(rawSend: SendFn) {
        return new Session(this.binder, rawSend)
    }
}
