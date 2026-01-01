import { fileURLToPath } from 'node:url'

export const openwsUiRoot = fileURLToPath(new URL('../public/', import.meta.url))
