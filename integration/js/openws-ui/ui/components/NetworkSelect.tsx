import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'

import { useOpenWsUiState } from '../contexts/StateProvider'
import { toPascalCase } from '../utils/string'

export function NetworkSelect() {
    const { spec, selectedNetwork, setSelectedNetwork } = useOpenWsUiState()
    const networks = Object.values(spec?.networks ?? {})
    const disabled = networks.length <= 1

    return (
        <FormControl fullWidth size="small" disabled={disabled}>
            <InputLabel id="network-select-label">Network</InputLabel>
            <Select
                labelId="network-select-label"
                id="network-select"
                value={selectedNetwork ?? ''}
                label="Network"
                onChange={e => setSelectedNetwork(e.target.value)}
            >
                {networks.map(network => {
                    const displayName = toPascalCase(network.name)
                    const description = network.description
                    return (
                        <MenuItem key={network.name} value={network.name}>
                            {displayName}
                            <Typography variant="caption" color="text.secondary">
                                {description ? ` - ${description}` : ''}
                            </Typography>
                        </MenuItem>
                    )
                })}
            </Select>
        </FormControl>
    )
}
