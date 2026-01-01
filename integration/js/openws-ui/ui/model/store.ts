import type { MessageSelection } from './model'

export type AppState = {
    spec: any | null
    specUrl: string
    selectedNetwork: string | null
    selection: MessageSelection | null
    error: string | null
}

export type AppAction =
    | { type: 'specLoaded'; spec: any }
    | { type: 'specError'; error: string }
    | { type: 'selectNetwork'; networkName: string }
    | { type: 'selectMessage'; selection: MessageSelection }

export function reduce(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'specLoaded': {
            const networks = Object.keys(action.spec.networks ?? {})
            const selectedNetwork = state.selectedNetwork ?? networks[0] ?? null
            return { ...state, spec: action.spec, selectedNetwork, error: null }
        }
        case 'specError':
            return { ...state, error: action.error }
        case 'selectNetwork':
            return { ...state, selectedNetwork: action.networkName, selection: null }
        case 'selectMessage':
            return { ...state, selection: action.selection }
        default:
            return state
    }
}
