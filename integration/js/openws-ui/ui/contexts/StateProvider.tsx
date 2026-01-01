import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import type { Spec } from '@polytric/openws-spec/types'

import { readRuntimeConfig } from '../model/runtime-config'
import { fetchOpenWsSpec } from '../model/spec-client'

interface StateContextValue {
    spec: Spec | undefined
    specUrl: string
    isProduction: boolean
    hosts: string[]
    error: string | null
    loading: boolean
    selectedNetwork: string | undefined
    selectedRole: string | undefined
    selectedMessage: string | undefined
    setSelectedNetwork: (network: string) => void
    setSelectedRole: (role: string) => void
    setSelectedMessage: (message: string) => void
}

const StateContext = createContext<StateContextValue | undefined>(undefined)

export function StateProvider({ children }: { children: ReactNode }) {
    const { specUrl, networkHosts, isProduction } = readRuntimeConfig()

    const [spec, setSpec] = useState<Spec | undefined>(undefined)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedNetwork, setSelectedNetwork] = useState<string | undefined>(undefined)
    const [selectedRole, setSelectedRole] = useState<string | undefined>(undefined)
    const [selectedMessage, setSelectedMessage] = useState<string | undefined>(undefined)

    useEffect(() => {
        setLoading(true)
        setError(null)

        fetchOpenWsSpec(specUrl)
            .then(loadedSpec => {
                setSpec(loadedSpec)
                setSelectedNetwork(Object.keys(loadedSpec.networks ?? {})[0])
                setLoading(false)
            })
            .catch(err => {
                setError(String(err?.message ?? err))
                setLoading(false)
            })
    }, [specUrl])

    const value: StateContextValue = {
        spec,
        specUrl,
        isProduction,
        hosts: selectedNetwork ? networkHosts[selectedNetwork] : [],
        error,
        loading,
        selectedNetwork,
        selectedRole,
        selectedMessage,
        setSelectedNetwork,
        setSelectedRole,
        setSelectedMessage,
    }

    return <StateContext.Provider value={value}>{children}</StateContext.Provider>
}

export function useOpenWsUiState() {
    const context = useContext(StateContext)
    if (!context) {
        throw new Error('useState must be used within a StateProvider')
    }
    return context
}
