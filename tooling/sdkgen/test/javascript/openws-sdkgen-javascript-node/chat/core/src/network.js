export const networkName = 'core'
export const networkDescription = 'A chat network'
export const networkVersion = '1.0.0'

export const endpoints = {
    server: [
        {
            scheme: 'ws',
            host: 'localhost',
            port: 8082,
            path: '/chat',
        },
    ],
    client: [],
    portal: [],
}

/**
 * Encodes an OpenWS envelope for transport.
 */
export function encodeEnvelope(envelope) {
    return JSON.stringify(envelope)
}

/**
 * Decodes raw transport data into an OpenWS envelope.
 */
export function decodeEnvelope(data) {
    return JSON.parse(data)
}

/**
 * Returns true when a transport can be bound to generated client callbacks.
 */
export function canBindTransport(transport) {
    return typeof transport.on === 'function'
}

/**
 * Binds transport events to a generated client or compatible raw message handler.
 *
 * Transport `message` events call `handleRawMessage`, message handling failures
 * call `handleMessageError`, transport `error` events call `handleSocketError`,
 * and transport `close` events call `handleSocketClose`.
 */
export function bindTransport(transport, handler, options = {}) {
    const handleData = async data => {
        try {
            await handler.handleRawMessage(await normalizeMessageData(data))
        } catch (error) {
            await handler.handleMessageError?.(error)
            if (options.closeOnError) {
                transport.close?.()
            }
        }
    }
    const handleSocketError = async error => {
        await handler.handleSocketError?.(error)
    }
    const handleSocketClose = async event => {
        await handler.handleSocketClose?.(event)
    }

    const nodeHandler = data => {
        void handleData(data)
    }
    const nodeErrorHandler = error => {
        void handleSocketError(error)
    }
    const nodeCloseHandler = event => {
        void handleSocketClose(event)
    }

    if (typeof transport.on !== 'function') {
        throw new Error('Transport must support on("message")')
    }

    const messageUnsubscribe = transport.on('message', nodeHandler)
    const errorUnsubscribe = transport.on('error', nodeErrorHandler)
    const closeUnsubscribe = transport.on('close', nodeCloseHandler)
    return () => {
        if (typeof messageUnsubscribe === 'function') messageUnsubscribe()
        if (typeof errorUnsubscribe === 'function') errorUnsubscribe()
        if (typeof closeUnsubscribe === 'function') closeUnsubscribe()
    }
}

/**
 * WebSocket-backed transport implementation for generated SDK clients.
 */
export class WsTransport {
    socket
    socketUnsubscribe
    openPromise
    listeners = {
        message: new Set(),
        error: new Set(),
        close: new Set(),
    }

    constructor(socket) {
        if (socket) {
            this.bindSocket(socket)
        }
    }

    /**
     * Opens the underlying WebSocket when needed and waits until it is ready.
     */
    async connect(_roleName, endpoint) {
        if (!this.socket) {
            if (!endpoint) {
                throw new Error('Cannot connect without a WebSocket endpoint')
            }
            this.bindSocket(createWebSocket(endpoint))
        }
        await this.waitForOpen()
    }

    /**
     * Closes the underlying WebSocket connection.
     */
    async disconnect() {
        this.close()
    }

    /**
     * Sends already-encoded OpenWS envelope data.
     */
    async send(data) {
        await this.waitForOpen()
        const socket = this.requireSocket()
        if (typeof socket.send !== 'function') {
            throw new Error('WebSocket object must support send(data)')
        }
        await socket.send(data)
    }

    /**
     * Registers a transport event callback.
     */
    on(event, handler) {
        this.listeners[event].add(handler)
        return () => {
            this.listeners[event].delete(handler)
        }
    }

    /**
     * Closes and clears the current socket.
     */
    close() {
        this.socket?.close?.()
        this.clearSocket()
    }

    bindSocket(socket) {
        this.clearSocket()
        this.socket = socket
        this.openPromise = undefined

        const unsubscribeMessage = addSocketListener(socket, 'message', data => {
            void this.emit('message', getMessageEventData(data))
        })
        const unsubscribeError = addSocketListener(socket, 'error', error => {
            void this.emit('error', error)
        })
        const unsubscribeClose = addSocketListener(socket, 'close', event => {
            void this.handleSocketClose(socket, event)
        })
        this.socketUnsubscribe = () => {
            unsubscribeMessage()
            unsubscribeError()
            unsubscribeClose()
        }
    }

    async handleSocketClose(socket, event) {
        if (this.socket !== socket) {
            return
        }
        this.clearSocket()
        await this.emit('close', event)
    }

    clearSocket() {
        this.socketUnsubscribe?.()
        this.socket = undefined
        this.socketUnsubscribe = undefined
        this.openPromise = undefined
    }

    async emit(event, data) {
        for (const handler of this.listeners[event]) {
            await handler(data)
        }
    }

    requireSocket() {
        if (!this.socket) {
            throw new Error('WebSocket is not connected')
        }
        return this.socket
    }

    async waitForOpen() {
        const socket = this.requireSocket()
        const readyState = getReadyState(socket)
        if (readyState === undefined || readyState === 1) return
        if (readyState === 2 || readyState === 3) {
            throw new Error('WebSocket is closed')
        }

        this.openPromise ??= new Promise((resolve, reject) => {
            let cleanup = () => {}
            const unsubscribeOpen = addSocketListener(socket, 'open', () => {
                cleanup()
                resolve()
            })
            const unsubscribeError = addSocketListener(socket, 'error', error => {
                cleanup()
                reject(error)
            })
            const unsubscribeClose = addSocketListener(socket, 'close', event => {
                cleanup()
                reject(
                    event instanceof Error ? event : new Error('WebSocket closed before opening')
                )
            })
            cleanup = () => {
                unsubscribeOpen()
                unsubscribeError()
                unsubscribeClose()
            }
        })
        await this.openPromise
    }
}

async function normalizeMessageData(data) {
    if (typeof data === 'string') return data
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(data)
    if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data)
    if (typeof Blob !== 'undefined' && data instanceof Blob) return await data.text()
    return String(data)
}

function getMessageEventData(event) {
    if (event && typeof event === 'object' && 'data' in event) {
        return event.data
    }
    return event
}

function createWebSocket(endpoint) {
    const WebSocketCtor = globalThis.WebSocket
    if (!WebSocketCtor) {
        throw new Error(
            'No global WebSocket constructor found. Pass a socket or custom Transport to the client.'
        )
    }
    return new WebSocketCtor(endpointToUrl(endpoint))
}

function endpointToUrl(endpoint) {
    const scheme = endpoint.scheme || 'ws'
    const host = endpoint.host || 'localhost'
    const port = endpoint.port === undefined ? '' : `:${endpoint.port}`
    const path = endpoint.path
        ? endpoint.path.startsWith('/')
            ? endpoint.path
            : `/${endpoint.path}`
        : ''
    return `${scheme}://${host}${port}${path}`
}

function getReadyState(socket) {
    return typeof socket.readyState === 'number' ? socket.readyState : undefined
}

function addSocketListener(socket, event, handler) {
    if (typeof socket.on === 'function') {
        socket.on(event, handler)
        return () => {
            if (typeof socket.off === 'function') socket.off(event, handler)
            else if (typeof socket.removeListener === 'function')
                socket.removeListener(event, handler)
        }
    }

    if (typeof socket.addEventListener === 'function') {
        const eventHandler = event => {
            handler(event)
        }
        socket.addEventListener(event, eventHandler)
        return () => {
            socket.removeEventListener?.(event, eventHandler)
        }
    }

    const propertyName = `on${event}`
    const previous = socket[propertyName]
    const next = (...args) => {
        if (typeof previous === 'function') {
            previous(...args)
        }
        handler(...args)
    }
    socket[propertyName] = next
    return () => {
        if (socket[propertyName] === next) {
            socket[propertyName] = previous
        }
    }
}
