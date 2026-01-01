import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import * as React from 'react'

import type { Endpoint } from '@polytric/openws-spec/types'

import { useOpenWsUiState } from '../contexts/StateProvider'
import { useWs } from '../contexts/WsProvider'
import { toUrl } from '../utils/endpoint'
import { toPascalCase } from '../utils/string'

type Props = {
    open: boolean
    onClose: () => void
}

type Scheme = 'ws' | 'wss'

function normPath(path: string) {
    const p = (path ?? '').trim() || '/'
    return p.startsWith('/') ? p : `/${p}`
}

function joinUrl(scheme: Scheme, host: string, port: string, path: string) {
    const h = host.trim()
    const pt = port.trim()
    if (!h) return ''
    return `${scheme}://${h}${pt ? `:${pt}` : ''}${normPath(path)}`
}

function EndpointList({ onSelectEndpoint }: { onSelectEndpoint: (ep: Endpoint) => void }) {
    const { spec, selectedNetwork, hosts } = useOpenWsUiState()

    if (!spec || !selectedNetwork || !hosts) {
        return null
    }

    return (
        <Stack spacing={1}>
            {hosts.map(roleName => {
                return (
                    <Accordion key={roleName} disableGutters defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                {toPascalCase(roleName)}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <List dense disablePadding>
                                {spec.networks[selectedNetwork].roles[roleName]?.endpoints?.map(
                                    ep => {
                                        return (
                                            <ListItemButton
                                                key={ep.path}
                                                onClick={() => {
                                                    onSelectEndpoint(ep)
                                                }}
                                            >
                                                <ListItemText primary={toUrl(ep)} />
                                            </ListItemButton>
                                        )
                                    }
                                )}
                            </List>
                        </AccordionDetails>
                    </Accordion>
                )
            })}
        </Stack>
    )
}

export function ConnectHostDialog({ open, onClose }: Props) {
    const { spec, selectedNetwork } = useOpenWsUiState()
    const { connect } = useWs()

    // manual form state
    const [scheme, setScheme] = React.useState<Scheme>('ws')
    const [host, setHost] = React.useState('')
    const [port, setPort] = React.useState('80')
    const [path, setPath] = React.useState('/')

    const url = joinUrl(scheme, host, port, path)
    const dialogOpen = open && !!spec && !!selectedNetwork

    return (
        <Dialog open={dialogOpen} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Connect</DialogTitle>

            <DialogContent dividers>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    {/* Left: Endpoints grouped by role accordions */}
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                            Pick a predefined endpoint
                        </Typography>

                        <EndpointList
                            onSelectEndpoint={ep => {
                                setScheme(ep.scheme as Scheme)
                                setHost(ep.host)
                                setPort(ep.port.toString())
                                setPath(ep.path)
                            }}
                        />
                    </Stack>

                    {/* Right: Manual form */}
                    <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            Enter a custom URL
                        </Typography>

                        <Stack direction="row" spacing={1}>
                            <FormControl size="small" sx={{ width: 120 }}>
                                <InputLabel id="scheme-label">Scheme</InputLabel>
                                <Select
                                    labelId="scheme-label"
                                    label="Scheme"
                                    value={scheme}
                                    onChange={e => setScheme(e.target.value as Scheme)}
                                >
                                    <MenuItem value="ws">ws</MenuItem>
                                    <MenuItem value="wss">wss</MenuItem>
                                </Select>
                            </FormControl>

                            <TextField
                                size="small"
                                label="Host"
                                value={host}
                                onChange={e => setHost(e.target.value)}
                                fullWidth
                                placeholder="localhost"
                            />

                            <TextField
                                size="small"
                                label="Port"
                                value={port}
                                onChange={e => setPort(e.target.value)}
                                sx={{ width: 120 }}
                            />
                        </Stack>

                        <TextField
                            size="small"
                            label="Path"
                            value={path}
                            onChange={e => setPath(e.target.value)}
                            placeholder="/ws"
                            fullWidth
                        />

                        <Divider />

                        <TextField
                            size="small"
                            label="URL"
                            value={url}
                            InputProps={{ readOnly: true }}
                            fullWidth
                        />

                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="contained"
                                disabled={!host.trim()}
                                onClick={async () => {
                                    await connect({
                                        scheme,
                                        host,
                                        port: parseInt(port, 10),
                                        path: normPath(path),
                                    })
                                    onClose()
                                }}
                            >
                                Connect
                            </Button>
                            <Button onClick={onClose}>Cancel</Button>
                        </Stack>
                    </Stack>
                </Stack>
            </DialogContent>
        </Dialog>
    )
}
