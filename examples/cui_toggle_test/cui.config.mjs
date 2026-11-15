import { defineConfig } from 'bedrock-cui'
import { buildBook, FORM, GLYPHS } from '../toggle-book.mjs'
import { buildResponsiveDemo, RESPONSIVE_FORM } from '../responsive-demo.mjs'

export default defineConfig({
    namespace: 'cui_toggle_test',
    screens: {
        [FORM.title]: () => buildBook(),                       // 测试书（静态界面、混合翻页）
        [RESPONSIVE_FORM.title]: () => buildResponsiveDemo(),  // 响应式演示
    },
    // 测试书的贴图由 build.mjs 从 preview-src/public/textures 复制进来
    textures: ['res', 'glyph-src'],
    glyphs: [GLYPHS],
    preview: { viewport: [320, 220] },
})
