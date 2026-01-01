import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { useOpenWsUiState } from '../contexts/StateProvider'
import { ROLE_BG_COLOR, stringToBorderColor } from '../utils/colors'
import { toPascalCase } from '../utils/string'

import { MessageView } from './MessageView'

export function RoleView({ roleName }: { roleName: string }) {
    const { spec, selectedNetwork, hosts } = useOpenWsUiState()
    if (!selectedNetwork) {
        return null
    }
    const role = spec?.networks[selectedNetwork].roles[roleName]
    if (!role) {
        return null
    }

    const messages = Object.keys(role.messages ?? {}).map(messageName => {
        return (
            <MessageView
                key={`${roleName}:${messageName}`}
                roleName={roleName}
                messageName={messageName}
            />
        )
    })
    const borderColor = stringToBorderColor(roleName)

    return (
        <Accordion
            id={`role-${roleName}`}
            key={roleName}
            disableGutters
            sx={{
                border: 1,
                borderColor: 'divider',
                borderLeft: 3,
                borderLeftColor: borderColor,
                bgcolor: ROLE_BG_COLOR,
                '&:before': { display: 'none' },
            }}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {toPascalCase(roleName)}{' '}
                    {hosts.includes(roleName) ? (
                        <Chip size="small" color="success" label="host" />
                    ) : null}
                    <Typography variant="caption" color="text.secondary">
                        {role.description && ` - ${role.description}`}
                    </Typography>
                </Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Stack direction="column" spacing={1}>
                    {messages}
                </Stack>
            </AccordionDetails>
        </Accordion>
    )
}
