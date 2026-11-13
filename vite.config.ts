import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
    root: 'preview-src',
    base: './',
    resolve: { alias: { 'cui/jsx-runtime': path.resolve(__dirname, 'src/core/jsx-runtime.ts'), 'cui/web': path.resolve(__dirname, 'src/web/index.ts'), cui: path.resolve(__dirname, 'src/index.ts') } },
    esbuild: { jsx: 'automatic', jsxImportSource: 'cui' },
    build: { outDir: '../dist-preview', emptyOutDir: true },
})
