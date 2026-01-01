import type { Endpoint } from '@polytric/openws-spec/types'

type MsgListener = (roleName: string, messageName: string, payload: any) => void
type ConnListener = (reconnecting: boolean) => void

export class WsClient {
    private ws: WebSocket | null = null
    private shouldReconnect = false
    private lastEndpoint?: Endpoint

    private sendListeners: MsgListener[] = []
    private msgListeners: MsgListener[] = []
    private connectListeners: ConnListener[] = []
    private disconnectListeners: ConnListener[] = []

    private reconnectTimer: number | null = null
    private reconnectAttempt = 0

    #connected = false
    get connected() {
        return this.#connected
    }

    constructor(endpoint?: Endpoint) {
        if (endpoint) void this.connect(endpoint)
    }

    connect(endpoint: Endpoint) {
        this.lastEndpoint = endpoint
        this.shouldReconnect = true
        this.reconnectAttempt = 0

        // close any existing connection first
        this.cleanupSocket()

        this.open(endpoint, /*reconnecting*/ false)
    }

    disconnect() {
        // user intent: stop reconnecting
        this.shouldReconnect = false
        this.clearReconnectTimer()
        this.cleanupSocket()
        this.setConnected(false)
        this.disconnectListeners.forEach(fn => fn(false))
    }

    send(roleName: string, messageName: string, payload: any) {
        if (!this.ws || !this.connected) throw new Error('WebSocket not connected')
        this.sendListeners.forEach(fn => fn(roleName, messageName, payload))
        this.ws.send(
            JSON.stringify({
                fromRole: roleName,
                messageName,
                payload: JSON.stringify(payload),
            })
        )
    }

    onSend(listener: MsgListener) {
        this.sendListeners.push(listener)
        return () => {
            this.sendListeners = this.sendListeners.filter(x => x !== listener)
        }
    }

    offSend(listener: MsgListener) {
        this.sendListeners = this.sendListeners.filter(x => x !== listener)
    }

    onMessage(listener: MsgListener) {
        this.msgListeners.push(listener)
        return () => {
            this.msgListeners = this.msgListeners.filter(x => x !== listener)
        }
    }

    offMessage(listener: MsgListener) {
        this.msgListeners = this.msgListeners.filter(x => x !== listener)
    }

    on(event: 'connect' | 'disconnect', listener: ConnListener) {
        if (event === 'connect') this.connectListeners.push(listener)
        else this.disconnectListeners.push(listener)
        return () => {
            this.connectListeners = this.connectListeners.filter(x => x !== listener)
            this.disconnectListeners = this.disconnectListeners.filter(x => x !== listener)
        }
    }

    // ---- internals ----

    private open(endpoint: Endpoint, reconnecting: boolean) {
        const url = `${endpoint.scheme}://${endpoint.host}:${endpoint.port}${endpoint.path}`
        const ws = new WebSocket(url)
        this.ws = ws

        ws.onopen = () => {
            this.setConnected(true)
            this.reconnectAttempt = 0
            this.connectListeners.forEach(fn => fn(reconnecting))
        }

        ws.onmessage = event => {
            try {
                const msg = JSON.parse(String(event.data))
                const { fromRole, messageName, payload: rawPayload } = msg

                // be tolerant: payload might already be object
                const payload = JSON.parse(rawPayload)

                this.msgListeners.forEach(fn => fn(fromRole, messageName, payload))
            } catch (_error) {
                // swallow for now; you can add onError later
                // console.error('WsClient message parse error', e)
            }
        }

        ws.onerror = () => {
            // Don't recurse here; close will follow and handle reconnect.
            this.setConnected(false)
        }

        ws.onclose = () => {
            const wasConnected = this.connected
            this.setConnected(false)

            // Only notify disconnect if this wasn't a user-requested disconnect
            if (wasConnected) this.disconnectListeners.forEach(fn => fn(this.shouldReconnect))

            if (this.shouldReconnect) this.scheduleReconnect()
        }
    }

    private scheduleReconnect() {
        if (!this.lastEndpoint) return
        this.clearReconnectTimer()

        const base = 250
        const max = 10_000
        const delay =
            Math.min(max, base * Math.pow(2, this.reconnectAttempt++)) +
            Math.floor(Math.random() * 200)

        this.reconnectTimer = window.setTimeout(() => {
            if (this.shouldReconnect && this.lastEndpoint) {
                this.open(this.lastEndpoint, /*reconnecting*/ true)
            }
        }, delay)
    }

    private clearReconnectTimer() {
        if (this.reconnectTimer != null) {
            window.clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
    }

    private cleanupSocket() {
        if (!this.ws) return
        try {
            this.ws.onopen = null
            this.ws.onclose = null
            this.ws.onerror = null
            this.ws.onmessage = null
            this.ws.close(1000, 'reconnect')
        } catch (error) {
            console.error('WsClient cleanupSocket error', error)
        }
        this.ws = null
    }

    private setConnected(v: boolean) {
        this.#connected = v
    }
}
