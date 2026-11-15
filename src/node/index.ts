/**
 * bedrock-cui/node：构建工具（只在 Node 里用）。
 *   CuiApp、useSapdon —— 挂界面、导出翻页路由、字形图，接入 sapdon 的构建
 *   checkScripts —— 对行为包的脚本做类型检查
 *   textureInfoFrom、renderGlyphSheet、copyRuntime …… —— 贴图信息、字形图、运行时文件
 */
export * from './tools.js'
export { checkScripts } from './check.js'
export { CuiApp, useSapdon, type CuiCompiled, type SapdonCore } from './app.js'
