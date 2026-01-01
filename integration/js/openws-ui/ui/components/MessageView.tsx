import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { useOpenWsUiState } from '../contexts/StateProvider'
import { stringToBorderColor } from '../utils/colors'
import { toPascalCase } from '../utils/string'

import { ColorCodedChip } from './ColorCodedChip'
import { SchemaView } from './SchemaView'

export function MessageView({ roleName, messageName }: { roleName: string; messageName: string }) {
    const { spec, selectedNetwork, hosts, setSelectedRole, setSelectedMessage } = useOpenWsUiState()
    if (!selectedNetwork) {
        return null
    }
    const message = spec?.networks[selectedNetwork].roles[roleName].messages[messageName]
    if (!message) {
        return null
    }

    const scrollToRole = (roleName: string) => {
        const el = document.getElementById(`role-${roleName}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const borderColor = stringToBorderColor(messageName)
    const payload = message.payload

    const isHost = hosts.includes(roleName)
    const selectMessage = (_event: React.SyntheticEvent) => {
        if (isHost) {
            setSelectedRole(roleName)
            setSelectedMessage(messageName)
        }
    }
    return (
        <Accordion
            id={`message-${roleName}-${messageName}`}
            disableGutters
            sx={{
                border: 1,
                borderColor: 'divider',
                borderLeft: 3,
                borderLeftColor: borderColor,
                bgcolor: 'background.paper',
                '&:before': { display: 'none' },
            }}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} onClick={selectMessage}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, flex: 1 }}>
                        {toPascalCase(messageName)}
                    </Typography>
                    {message.description && (
                        <Typography component="span" variant="caption" color="text.secondary">
                            {` - ${message.description}`}
                        </Typography>
                    )}
                </Box>
            </AccordionSummary>
            <AccordionDetails>
                {message.from && message.from?.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                            Received From:
                        </Typography>
                        {message.from?.map((f: string) => (
                            <ColorCodedChip
                                key={f}
                                label={f}
                                onClick={() => {
                                    scrollToRole(f)
                                }}
                            />
                        ))}
                    </Box>
                )}
                <SchemaView schema={payload} />
            </AccordionDetails>
        </Accordion>
    )
}
