import { Box, Chip } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useEffect, useState } from 'react'

import { useOpenWsUiState } from '../contexts/StateProvider'
import { useWs } from '../contexts/WsProvider'
import { stringToColor, stringToBorderColor } from '../utils/colors'

import { ConsoleTitleBar, type ConsoleFilter } from './ConsoleTitleBar'

interface MessageRecord {
    network: string
    role: string
    message: string
    direction: 'inbound' | 'outbound'
    timestamp: string
    payload: string
}

const COLUMNS: GridColDef[] = [
    { field: 'timestamp', headerName: 'Time', width: 180, filterable: false },
    { field: 'direction', headerName: 'Direction', width: 110, filterable: false },
    {
        field: 'role',
        headerName: 'Sender',
        width: 140,
        filterable: false,
        renderCell: params => (
            <Chip
                label={params.value}
                size="small"
                sx={{
                    bgcolor: stringToColor(params.value as string),
                    borderLeft: 3,
                    borderColor: stringToBorderColor(params.value as string),
                }}
            />
        ),
    },
    {
        field: 'message',
        headerName: 'Message',
        width: 180,
        filterable: false,
        renderCell: params => (
            <Chip
                label={params.value}
                size="small"
                sx={{
                    bgcolor: stringToColor(params.value as string),
                    borderLeft: 3,
                    borderColor: stringToBorderColor(params.value as string),
                }}
            />
        ),
    },
    { field: 'payload', headerName: 'Payload', flex: 1, minWidth: 300, filterable: false },
]

export function ConsolePanel() {
    const { selectedNetwork } = useOpenWsUiState()
    const { onMessage, onSend } = useWs()
    const [messages, setMessages] = useState<MessageRecord[]>([])
    const [filter, setFilter] = useState<ConsoleFilter>({})

    useEffect(() => {
        if (!selectedNetwork) return

        const push = (record: MessageRecord) => {
            setMessages(prev => [...prev, record].slice(-500))
        }

        const offMessage = onMessage((fromRole, messageName, payload) => {
            push({
                network: selectedNetwork,
                role: String(fromRole),
                message: String(messageName),
                direction: 'inbound',
                timestamp: new Date().toISOString(),
                payload: JSON.stringify(payload),
            })
        })

        const offSend = onSend((roleName, messageName, payload) => {
            push({
                network: selectedNetwork,
                role: String(roleName),
                message: String(messageName),
                direction: 'outbound',
                timestamp: new Date().toISOString(),
                payload: JSON.stringify(payload),
            })
        })

        return () => {
            offMessage?.()
            offSend?.()
        }
    }, [onMessage, onSend, selectedNetwork])

    if (!selectedNetwork) return null

    const rows = messages
        .map(m => ({
            id: `${m.timestamp}-${m.direction}-${m.role}-${m.message}`,
            ...m,
        }))
        .filter(m => {
            if (selectedNetwork !== m.network) return false
            if (filter.direction && m.direction !== filter.direction) return false
            if (filter.role && m.role !== filter.role) return false
            if (filter.message && m.message !== filter.message) return false
            if (filter.payload && !m.payload.includes(filter.payload)) return false
            return true
        })

    return (
        <Box
            sx={{
                height: 360,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
            }}
        >
            <ConsoleTitleBar filter={filter} onChange={setFilter} />
            <Box sx={{ flex: 1, minHeight: 0 }}>
                <DataGrid
                    rows={rows}
                    columns={COLUMNS}
                    density="compact"
                    disableRowSelectionOnClick
                    filterMode="client"
                    sortingMode="client"
                    sx={{ border: 0 }}
                />
            </Box>
        </Box>
    )
}
