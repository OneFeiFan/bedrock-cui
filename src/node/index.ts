/**
 * bedrock-cui/node：构建工具（只在 Node 里用）。
 *   CuiApp —— 挂界面、导出翻页路由、字形图；独立打包成 .mcaddon，或嵌入 sapdon 的构建
 *   Addon、checkScripts —— 清单 / UUID / .mcaddon、生成的脚本做类型检查
 *   textureInfoFrom、renderGlyphSheet、copyRuntime …… —— 贴图信息、字形图、运行时文件
 */
export * from './tools.js'
export { Addon, PackFiles, checkScripts, zip } from './addon.js'
export { CuiApp, rewriteRuntimeImports, type CuiBuildOptions, type CuiCompiled, type SapdonCore } from './app.js'
