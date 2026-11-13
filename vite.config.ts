import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
    root: 'preview-src',
    base: './',
    resolve: { alias: { 'cui/web': path.resolve(__dirname, 'src/web/index.ts'), cui: path.resolve(__dirname, 'src/index.ts') } },
    build: { outDir: '../dist-preview', emptyOutDir: true },
})
