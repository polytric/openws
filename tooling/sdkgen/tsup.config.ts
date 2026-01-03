import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/main.ts'],
    format: ['cjs'],
    outDir: 'dist',
    clean: true,
    shims: true,
    banner: {
        js: '#!/usr/bin/env node',
    },
})
