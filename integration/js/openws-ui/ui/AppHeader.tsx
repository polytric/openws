import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'

import { ConnectHostButton } from './components/ConnectHostButton'
import { useOpenWsUiState } from './contexts/StateProvider'
import { getEnvBgColor } from './utils/colors'

export function AppHeader() {
    const { spec, specUrl, isProduction } = useOpenWsUiState()
    if (!spec) {
        return null
    }

    const apiVersion = spec?.version

    return (
        <AppBar position="static" color="default" elevation={0}>
            <Toolbar
                sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: getEnvBgColor(isProduction),
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                            OpenWS UI
                        </Typography>
                        <Chip label={`UI ${__UI_VERSION__}`} size="small" color="primary" />
                        <Chip label={`Spec ${spec.openws}`} size="small" color="primary" />
                        {spec.version && (
                            <Chip label={`Doc ${spec.version}`} size="small" color="primary" />
                        )}
                    </Stack>

                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Link
                            href={specUrl}
                            target="_blank"
                            rel="noreferrer"
                            underline="hover"
                            variant="caption"
                        >
                            {specUrl}
                        </Link>
                        {apiVersion && (
                            <Typography variant="caption" color="text.secondary">
                                API {apiVersion}
                            </Typography>
                        )}
                    </Stack>
                </Box>

                <Box sx={{ flex: 1 }} />

                <ConnectHostButton />
            </Toolbar>
        </AppBar>
    )
}
