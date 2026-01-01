import Button from '@mui/material/Button'
import { useState } from 'react'

import { useOpenWsUiState } from '../contexts/StateProvider'
import { useWs } from '../contexts/WsProvider'

import { ConnectHostDialog } from './ConnectHostDialog'

export function ConnectHostButton() {
    const { spec, selectedNetwork, hosts } = useOpenWsUiState()
    const [open, setOpen] = useState(false)
    const { connected } = useWs()

    if (!spec || !selectedNetwork || !hosts) {
        return null
    }

    return (
        <>
            <Button variant="outlined" onClick={() => setOpen(true)}>
                {connected ? 'Connected' : 'Connect'}
            </Button>
            <ConnectHostDialog open={open} onClose={() => setOpen(false)} />
        </>
    )
}
