import { Chip } from '@mui/material'

import { stringToBorderColor, stringToColor } from '../utils/colors'
import { toPascalCase } from '../utils/string'

export function ColorCodedChip({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <Chip
            label={toPascalCase(label)}
            size="small"
            clickable
            onClick={onClick}
            sx={{
                bgcolor: stringToColor(label),
                borderLeft: 3,
                borderLeftColor: stringToBorderColor(label),
                borderRadius: 1,
                cursor: 'pointer',
                fontWeight: 800,
            }}
        />
    )
}
