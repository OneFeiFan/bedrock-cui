import { defineConfig } from 'bedrock-cui'
import { buildBook } from './ui/book.mjs'

export default defineConfig({
    // 界面文件的命名空间（ui/book.json）
    namespace: 'book',
    // 界面 id → 根控件。脚本以界面 id 为标题打开服务端表单时显示该界面
    screens: {
        'cui_ui:book': () => buildBook(),
    },
    // 贴图所在的资源包目录（预览与静态检查读取）
    textures: ['res'],
    // 预览中的表单数据
    preview: {
        viewport: [320, 200],
        forms: { 'cui_ui:book': { buttons: ['close|'] } },
    },
})
