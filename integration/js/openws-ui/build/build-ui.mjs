import * as esbuild from 'esbuild'
import { readFileSync } from 'node:fs'
import { cssInlinePlugin } from './cssInlinePlugin.mjs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const watch = process.argv.includes('--watch')
const prod = process.argv.includes('--prod')

const config = {
  entryPoints: ['ui/main.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'OpenWSUI',
  outfile: 'public/app.js',
  jsx: 'automatic',
  define: {
    global: 'window',
    '__UI_VERSION__': JSON.stringify(pkg.version),
    'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
  },
  plugins: [cssInlinePlugin()],
  sourcemap: prod ? false : 'linked',
  minify: prod,
  treeShaking: true,
  logLevel: 'info',
}

if (watch) {
  const ctx = await esbuild.context(config)
  await ctx.watch()
  console.log('[openws-ui] watching...')
} else {
  await esbuild.build(config)
}