import { defineConfig } from 'bedrock-cui'
import book from './ui/book.screen.mjs'

export default defineConfig({
    // 界面文件的命名空间（构建出 ui/book.json）
    namespace: 'book',
    // 项目中的界面
    screens: [book],
    // 贴图所在的资源包目录（预览与静态检查读取）
    textures: ['res'],
    // 预览区域的大小
    preview: { viewport: [320, 200] },
})
