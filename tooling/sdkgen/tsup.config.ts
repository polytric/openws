import { cpSync, readFileSync, writeFileSync } from 'node:fs'

import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        main: 'src/main.ts',
        'plans/dotnet': 'src/plans/dotnet.ts',
        'plans/typescript': 'src/plans/typescript.ts',
    },
    format: ['cjs', 'esm'],
    outDir: 'dist',
    clean: true,
    bundle: true,
    shims: true,
    dts: true,
    onSuccess: async () => {
        // Copy templates
        cpSync('src/templates', 'dist/templates', { recursive: true })

        // Add shebang only to main entry
        for (const ext of ['.js', '.cjs']) {
            const file = `dist/main${ext}`
            try {
                const content = readFileSync(file, 'utf8')
                if (!content.startsWith('#!')) {
                    writeFileSync(file, `#!/usr/bin/env node\n${content}`)
                }
            } catch {}
        }
    },
})
