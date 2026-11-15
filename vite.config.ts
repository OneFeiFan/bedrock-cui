import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
    root: 'preview-src',
    base: './',
    resolve: { alias: { 'bedrock-cui/web': path.resolve(__dirname, 'src/web/index.ts'), 'bedrock-cui/runtime': path.resolve(__dirname, 'src/runtime/index.ts'), 'bedrock-cui': path.resolve(__dirname, 'src/index.ts') } },
    build: { outDir: '../dist-preview', emptyOutDir: true },
})
