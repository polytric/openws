import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

import { useOpenWsUiState } from '../contexts/StateProvider'

import { NetworkSelect } from './NetworkSelect'
import { RoleView } from './RoleView'

export function MessageExplorerPanel() {
    const { spec, selectedNetwork } = useOpenWsUiState()

    if (!selectedNetwork) {
        return null
    }
    const roles = spec?.networks[selectedNetwork].roles ?? {}

    // Reset view state when switching networks (optional but usually feels right).

    return (
        <Box
            sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                overflow: 'auto',
                p: 2,
                borderRight: 1,
                borderColor: 'divider',
                bgcolor: 'grey.50',
            }}
        >
            <Stack direction="column" spacing={1}>
                <NetworkSelect />
                {Object.keys(roles).map(roleName => {
                    return <RoleView key={roleName} roleName={roleName} />
                })}
            </Stack>
        </Box>
    )
}
