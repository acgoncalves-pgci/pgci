import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

// PDF.js needs these local resources for embedded fonts and image formats.
export function pdfAssets(): Plugin {
  const files = new Map<string, string>()
  for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    const root = resolve('node_modules/pdfjs-dist', directory)
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isFile()) files.set(`pdf-assets/${directory}/${entry.name}`, resolve(root, entry.name))
    }
  }
  files.set('pdf-assets/LICENSE', resolve('node_modules/pdfjs-dist/LICENSE'))
  return {
    name: 'local-pdf-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const key = request.url?.split('?')[0].replace(/^\//, '')
        const file = key ? files.get(key) : undefined
        if (!file) return next()
        response.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream')
        response.end(readFileSync(file))
      })
    },
    generateBundle() {
      for (const [fileName, file] of files) this.emitFile({ type: 'asset', fileName, source: readFileSync(file) })
    },
  }
}
