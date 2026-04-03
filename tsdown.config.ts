import { defineConfig } from 'tsdown'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))

export default defineConfig({
  entry: ['src/cli/index.ts', 'src/benchmark/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  define: {
    __BP_VERSION__: JSON.stringify(pkg.version),
  },
  // Markdown/YAML template files shipped as-is (no compilation)
  // templates/ and locales/ are included in package via package.json "files"
})
