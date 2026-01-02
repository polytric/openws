import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts', 'src/builder.ts', 'src/types.ts'],
    format: ['esm', 'cjs'],
    dts: true, // emits dist/index.d.ts
    sourcemap: true,
    clean: true,
    target: 'node18',
    outDir: 'dist',
    // Don't bundle @pocketgems/schema - it's CommonJS and uses dynamic require
    external: ['@pocketgems/schema'],
    // crucial: CJS must be .cjs when package is type: module
    outExtension({ format }) {
        return { js: format === 'cjs' ? '.cjs' : '.js' }
    },
})
