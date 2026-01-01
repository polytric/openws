import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { createRoot } from 'react-dom/client'

import { App } from './App'

const theme = createTheme({
    palette: {
        mode: 'light',
    },
})

createRoot(document.getElementById('app')!).render(
    <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
    </ThemeProvider>
)
