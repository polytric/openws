import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { Endpoint } from '@polytric/openws-spec/types'

import { WsClient } from '../model/ws-client'

import { useOpenWsUiState } from './StateProvider'

type WsContextValue = {
    connected: boolean
    lastEndpoint?: Endpoint
    connect: (endpoint: Endpoint) => void
    disconnect: () => void
    send: (roleName: string, messageName: string, payload: any) => void
    onMessage: (
        listener: (fromRole: string, messageName: string, payload: any) => void
    ) => () => void
    onSend: (listener: (roleName: string, messageName: string, payload: any) => void) => () => void
    onConnect: (listener: (reconnecting: boolean) => void) => void
    onDisconnect: (listener: (reconnecting: boolean) => void) => void
}

const WsContext = createContext<WsContextValue | undefined>(undefined)
const WS_CLIENT = new WsClient()

export function WsProvider({ children }: { children: ReactNode }) {
    const { spec, selectedNetwork } = useOpenWsUiState()
    const client = WS_CLIENT

    const [connected, setConnected] = useState(client.connected)
    const [connectionEndpoint, setConnectionEndpoint] = useState<Endpoint | undefined>(undefined)

    // Subscribe once
    useEffect(() => {
        const offConnect = client.on('connect', () => setConnected(true))
        const offDisconnect = client.on('disconnect', () => setConnected(false))

        return () => {
            offConnect?.()
            offDisconnect?.()
            client.disconnect()
        }
    }, [client])

    // When spec/network changes, optionally clear endpoint (but don't thrash the socket).
    // Keep it minimal: if spec disappears, clear + disconnect.
    useEffect(() => {
        if (!spec || !selectedNetwork) {
            setConnectionEndpoint(undefined)
            client.disconnect()
            setConnected(client.connected)
        }
    }, [spec, selectedNetwork, client])

    // Connect whenever connectionEndpoint changes (single source of truth)
    useEffect(() => {
        if (connectionEndpoint) client.connect(connectionEndpoint)
    }, [connectionEndpoint, client])

    const value = useMemo<WsContextValue>(() => {
        return {
            connected,
            lastEndpoint: connectionEndpoint,

            // IMPORTANT: do NOT call client.connect here (effect will do it once)
            connect: (endpoint: Endpoint) => {
                setConnectionEndpoint(endpoint)
            },

            disconnect: () => {
                setConnectionEndpoint(undefined)
                client.disconnect()
                setConnected(client.connected)
            },

            send: (roleName, messageName, payload) => {
                client.send(roleName, messageName, payload)
            },

            onSend: (listener: (roleName: string, messageName: string, payload: any) => void) => {
                client.onSend(listener)
                return () => {
                    client.offSend(listener)
                }
            },

            onMessage: (
                listener: (fromRole: string, messageName: string, payload: any) => void
            ) => {
                client.onMessage(listener)
                return () => {
                    client.offMessage(listener)
                }
            },

            onConnect: (listener: (reconnecting: boolean) => void) => {
                client.on('connect', listener)
            },

            onDisconnect: (listener: (reconnecting: boolean) => void) => {
                client.on('disconnect', listener)
            },
        }
    }, [connected, connectionEndpoint, client])

    return <WsContext.Provider value={value}>{children}</WsContext.Provider>
}

export function useWs() {
    const ctx = useContext(WsContext)
    if (!ctx) throw new Error('useWs must be used within WsProvider')
    return ctx
}
