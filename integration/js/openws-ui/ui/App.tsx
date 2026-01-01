import { AppHeader } from './AppHeader'
import { Body } from './Body'
import { StateProvider } from './contexts/StateProvider'
import { WsProvider } from './contexts/WsProvider'

function AppContent() {
    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <AppHeader />
            <Body />
        </div>
    )
}

export function App() {
    return (
        <StateProvider>
            <WsProvider>
                <AppContent />
            </WsProvider>
        </StateProvider>
    )
}
