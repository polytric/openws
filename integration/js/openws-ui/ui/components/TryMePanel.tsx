import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import Form from '@rjsf/mui'
import type { RJSFSchema, UiSchema } from '@rjsf/utils'
import validator from '@rjsf/validator-ajv8'
import { useState, useEffect } from 'react'

import { useOpenWsUiState } from '../contexts/StateProvider'
import { useWs } from '../contexts/WsProvider'
import { toPascalCase } from '../utils/string'

import { ColorCodedChip } from './ColorCodedChip'
import { ConnectHostDialog } from './ConnectHostDialog'

export function TryMePanel() {
    const { spec, selectedNetwork, selectedMessage, selectedRole, hosts } = useOpenWsUiState()
    const [persistedFields, setPersistedFields] = useState<Record<string, any>>({})
    const [formData, setFormData] = useState<any>({})
    const [asRole, setAsRole] = useState<string>('')
    const { connected, send } = useWs()
    const [connectHostDialogOpen, setConnectHostDialogOpen] = useState(false)

    const scrollToMessage = () => {
        const el = document.getElementById(`message-${selectedRole}-${selectedMessage}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const scrollToRole = () => {
        const el = document.getElementById(`role-${selectedRole}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    useEffect(() => {
        // Load persisted values for the new form
        if (!spec || !selectedNetwork || !selectedRole || !selectedMessage) {
            setFormData({})
            return
        }

        const schema =
            spec.networks[selectedNetwork].roles[selectedRole].messages[selectedMessage].payload
        const prefilledData: any = {}

        // Auto-populate fields that exist in both the schema and persisted data
        if (schema && typeof schema === 'object' && 'properties' in schema) {
            for (const fieldName of Object.keys(schema.properties || {})) {
                if (persistedFields[fieldName] !== undefined) {
                    prefilledData[fieldName] = persistedFields[fieldName]
                }
            }
        }

        setFormData(prefilledData)
    }, [selectedNetwork, selectedRole, selectedMessage, spec, persistedFields])

    if (!selectedMessage || !selectedRole || !selectedNetwork || !spec) {
        return (
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    overflow: 'auto',
                    p: 2,
                    bgcolor: 'grey.50',
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Select a message from any{'  '}
                    <Chip size="small" color="success" label="Host" />
                    {'  '}role on the left to try it out.
                </Typography>
            </Box>
        )
    }

    const rawSchema = (spec?.networks[selectedNetwork].roles[selectedRole].messages[selectedMessage]
        .payload ?? { type: 'object' }) as RJSFSchema

    // Remove descriptions from schema to hide documentation in form
    const removeDescriptions = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj
        const cleaned = { ...obj }
        delete cleaned.description
        if (cleaned.properties) {
            cleaned.properties = Object.fromEntries(
                Object.entries(cleaned.properties).map(([key, val]) => [
                    key,
                    removeDescriptions(val),
                ])
            )
        }
        if (cleaned.items) {
            cleaned.items = removeDescriptions(cleaned.items)
        }
        return cleaned
    }

    const schema = removeDescriptions(rawSchema)
    const uiSchema: UiSchema = {
        'ui:submitButtonOptions': { norender: true },
    }
    const remoteRoles = Object.values(spec?.networks[selectedNetwork].roles).filter(
        role => !hosts.includes(role.name)
    )

    return (
        <Box
            sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                overflow: 'auto',
                p: 2,
                bgcolor: 'grey.50',
            }}
        >
            <Typography
                variant="h6"
                sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
            >
                Send <ColorCodedChip label={selectedMessage} onClick={scrollToMessage} />
                to <ColorCodedChip label={selectedRole} onClick={scrollToRole} />
                as{' '}
                <Select
                    size="small"
                    value={asRole}
                    onChange={e => setAsRole(e.target.value)}
                    displayEmpty
                    sx={{ minWidth: 120 }}
                >
                    {remoteRoles.map(role => (
                        <MenuItem key={role.name} value={role.name}>
                            {toPascalCase(role.name)}
                        </MenuItem>
                    ))}
                </Select>
            </Typography>
            <Form
                schema={schema}
                uiSchema={uiSchema}
                validator={validator}
                formData={formData}
                onChange={(e: any) => {
                    setFormData(e.formData)
                    // Persist all field values for reuse across messages
                    setPersistedFields(prev => ({ ...prev, ...e.formData }))
                }}
                liveValidate={false}
                noHtml5Validate
            >
                {/* no submit button here; we drive send with our own button */}
            </Form>
            <Button
                variant={connected ? 'contained' : 'outlined'}
                onClick={() => {
                    if (!connected) {
                        setConnectHostDialogOpen(true)
                    } else {
                        send(asRole, selectedMessage, formData)
                    }
                }}
            >
                {connected ? 'Send' : 'Connect'}
            </Button>
            <ConnectHostDialog
                open={connectHostDialogOpen}
                onClose={() => setConnectHostDialogOpen(false)}
            />
        </Box>
    )
}
