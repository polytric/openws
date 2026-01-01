import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts', 'src/fluent/index.ts', 'src/class/index.ts', 'src/decorator/index.ts'],
    format: ['esm', 'cjs'],
    dts: true, // emits dist/index.d.ts
    sourcemap: true,
    clean: true,
    target: 'node18',
    outDir: 'dist',
    // crucial: CJS must be .cjs when package is type: module
    outExtension({ format }) {
        return { js: format === 'cjs' ? '.cjs' : '.js' }
    },
})
