import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/cli/index.ts', 'src/benchmark/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  // Markdown/YAML template files shipped as-is (no compilation)
  // templates/ and locales/ are included in package via package.json "files"
})
