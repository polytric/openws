import Box from '@mui/material/Box'

import { ConsolePanel } from './components/ConsolePanel'
import { MessageExplorerPanel } from './components/MessageExplorerPanel'
import { TryMePanel } from './components/TryMePanel'

function VerticalPane({ children, flex = 1 }: { children: React.ReactNode; flex?: number }) {
    return (
        <Box
            sx={{
                flex,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
            }}
        >
            {children}
        </Box>
    )
}

export function Body() {
    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
            <VerticalPane flex={2}>
                <MessageExplorerPanel />
            </VerticalPane>
            <VerticalPane flex={3}>
                <TryMePanel />
                <Box sx={{ height: '50vh', minHeight: 300 }}>
                    <ConsolePanel />
                </Box>
            </VerticalPane>
        </Box>
    )
}
