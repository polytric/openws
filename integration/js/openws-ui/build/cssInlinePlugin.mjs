import fs from 'node:fs/promises'

export function cssInlinePlugin() {
  return {
    name: 'css-inline',
    setup(build) {
      build.onResolve({ filter: /\.css\?inline$/ }, async (args) => {
        const withoutQuery = args.path.replace(/\?inline$/, '')
        const resolved = await build.resolve(withoutQuery, {
          resolveDir: args.resolveDir,
          kind: args.kind,
        })
        if (resolved.errors?.length) return { errors: resolved.errors }
        return { path: resolved.path, namespace: 'css-inline' }
      })

      build.onLoad({ filter: /.*/, namespace: 'css-inline' }, async (args) => {
        const css = await fs.readFile(args.path, 'utf8')
        return { contents: css, loader: 'text' }
      })
    },
  }
}
