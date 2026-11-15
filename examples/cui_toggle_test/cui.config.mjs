import { defineConfig } from 'bedrock-cui'
import { buildBook, FORM, GLYPHS } from './ui/toggle-book.mjs'
import { buildResponsiveDemo, RESPONSIVE_FORM } from './ui/responsive-demo.mjs'

export default defineConfig({
    namespace: 'cui_toggle_test',
    screens: {
        [FORM.title]: () => buildBook(),                       // 测试书（静态界面、混合翻页）
        [RESPONSIVE_FORM.title]: () => buildResponsiveDemo(),  // 响应式演示
    },
    // res：测试书自己的贴图（进资源包）；vanilla：原版贴图（预览与字形图用，不进资源包，fetch-vanilla-textures 下载）
    textures: ['res', 'vanilla'],
    glyphs: [GLYPHS],
    preview: { viewport: [320, 220] },
})
