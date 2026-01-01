import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import type { Message } from '@polytric/openws-spec/types'

import { useOpenWsUiState } from '../contexts/StateProvider'
import { stringToColor, stringToBorderColor } from '../utils/colors'
import { toPascalCase } from '../utils/string'

export interface ConsoleFilter {
    direction?: 'inbound' | 'outbound'
    role?: string
    message?: string
    payload?: string
}

function DirectionFilter({
    filter,
    onChange,
}: {
    filter: ConsoleFilter
    onChange?: (filter: ConsoleFilter) => void
}) {
    return (
        <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel id="dir-label" sx={{ fontSize: '0.875rem' }}>
                Direction
            </InputLabel>
            <Select
                labelId="dir-label"
                label="Direction"
                value={filter.direction ?? ''}
                onChange={e => {
                    const value = e.target.value
                    onChange?.({
                        ...filter,
                        direction: value ? (value as 'inbound' | 'outbound') : undefined,
                    })
                }}
                sx={{ fontSize: '0.875rem' }}
            >
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="inbound">Inbound</MenuItem>
                <MenuItem value="outbound">Outbound</MenuItem>
            </Select>
        </FormControl>
    )
}

function RoleFilter({
    filter,
    onChange,
}: {
    filter: ConsoleFilter
    onChange?: (filter: ConsoleFilter) => void
}) {
    const { spec, selectedNetwork } = useOpenWsUiState()
    if (!spec || !selectedNetwork) {
        return null
    }
    const roles = Object.values(spec.networks[selectedNetwork].roles)

    return (
        <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel id="role-label" sx={{ fontSize: '0.875rem' }}>
                Role
            </InputLabel>
            <Select
                labelId="role-label"
                label="Role"
                value={filter.role ?? ''}
                onChange={e => onChange?.({ ...filter, role: e.target.value || undefined })}
                sx={{ fontSize: '0.875rem' }}
            >
                <MenuItem value="">Any</MenuItem>
                {roles.map(role => (
                    <MenuItem
                        key={role.name}
                        value={role.name}
                        sx={{
                            bgcolor: stringToColor(role.name),
                            borderLeft: 3,
                            borderColor: stringToBorderColor(role.name),
                        }}
                    >
                        {toPascalCase(role.name)}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}

function MessageFilter({
    filter,
    onChange,
}: {
    filter: ConsoleFilter
    onChange?: (filter: ConsoleFilter) => void
}) {
    const { spec, selectedNetwork } = useOpenWsUiState()
    if (!spec || !selectedNetwork) {
        return null
    }

    const messages: Message[] = []
    for (const role of Object.values(spec.networks[selectedNetwork].roles)) {
        messages.push(...Object.values(role.messages))
    }
    return (
        <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel id="msg-label" sx={{ fontSize: '0.875rem' }}>
                Message
            </InputLabel>
            <Select
                labelId="msg-label"
                label="Message"
                value={filter.message ?? ''}
                onChange={e => onChange?.({ ...filter, message: e.target.value || undefined })}
                sx={{ fontSize: '0.875rem' }}
            >
                <MenuItem value="">Any</MenuItem>
                {messages.map(message => (
                    <MenuItem
                        key={`${filter.role}-${message.name}`}
                        value={message.name}
                        sx={{
                            bgcolor: stringToColor(message.name),
                            borderLeft: 3,
                            borderColor: stringToBorderColor(message.name),
                        }}
                    >
                        {toPascalCase(message.name)}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}

function PayloadFilter({
    filter,
    onChange,
}: {
    filter: ConsoleFilter
    onChange?: (filter: ConsoleFilter) => void
}) {
    return (
        <TextField
            size="small"
            label="Payload"
            placeholder="Search..."
            value={filter.payload ?? ''}
            onChange={e => onChange?.({ ...filter, payload: e.target.value || undefined })}
            sx={{ minWidth: 180, '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
        />
    )
}

export function ConsoleTitleBar({
    filter,
    onChange,
}: {
    filter: ConsoleFilter
    onChange?: (filter: ConsoleFilter) => void
}) {
    return (
        <Box
            sx={{
                px: 1,
                py: 0.5,
                display: 'flex',
                gap: 0.75,
                alignItems: 'center',
                borderBottom: 1,
                borderColor: 'divider',
            }}
        >
            <Typography variant="h6">Console</Typography>
            <Box sx={{ flex: 1 }} />
            <DirectionFilter filter={filter} onChange={onChange} />
            <RoleFilter filter={filter} onChange={onChange} />
            <MessageFilter filter={filter} onChange={onChange} />
            <PayloadFilter filter={filter} onChange={onChange} />
        </Box>
    )
}
