/**
 * 项目配置（cui.config.mjs）：bedrock-cui dev（预览）、useSapdon()（嵌入 sapdon 构建）共用的唯一依据。
 * 只依赖 bedrock-cui 本身，浏览器里也能加载。
 *
 *   import { defineConfig } from 'bedrock-cui'
 *   import book from './ui/book.screen.mjs'
 *   export default defineConfig({
 *       namespace: 'book',
 *       screens: [book],
 *       textures: ['res'],
 *   })
 */
import type { Element } from './element.js'
import type { GlyphSheet } from './glyphs.js'
import type { Screen } from './screen.js'
import type { TimerHud } from './timerHud.js'

/** 一个界面：返回根控件的函数，或 { build, routed }（routed：路由方式，见手册「服务端表单」） */
export type CuiScreen = (() => Element) | { build: () => Element, routed?: boolean }

/** 界面的构建函数与选项 */
export function screenOf(s: CuiScreen | Screen): { build: () => Element, routed: boolean } {
    if ('options' in s && typeof (s as Screen).build === 'function' && 'id' in s) return { build: () => (s as Screen).build().root, routed: false }
    return typeof s === 'function' ? { build: s, routed: false } : { build: (s as { build: () => Element }).build, routed: !!(s as { routed?: boolean }).routed }
}

/** 预览时某个界面的表单数据 */
export interface CuiPreviewForm {
    /** 表单标题（缺省 = 界面 id） */
    title?: string
    /** 表单正文 */
    text?: string
    /** 表单按钮，按序号：文字，或 { text, icon }（图标路径，界面中用 form.buttonTexture 读取） */
    buttons?: (string | { text: string, icon?: string })[]
}

export interface CuiConfig {
    /** 界面文件的命名空间（ui/<namespace>.json） */
    namespace: string
    /** 界面：defineScreen 定义的界面对象的数组；或「界面 id → 返回根控件的函数」（需要路由方式时写成 { build, routed: true }） */
    screens: Screen[] | Record<string, CuiScreen | Screen>
    /** 独立计时 HUD；每个玩家同一时刻打开一个，每个 HUD 最多三个计时器 */
    timerHuds?: TimerHud[]
    /** 存放贴图的资源包目录（相对项目根目录），用于预览与静态检查；缺省 ['res'] */
    textures?: string[]
    /** 字形图（GlyphSheet），图标贴图从 textures 目录中查找 */
    glyphs?: GlyphSheet[]
    /** 行为包脚本目录（相对项目根目录），翻页路由表 cui.generated.js 写在这里；缺省 'scripts' */
    scripts?: string
    preview?: {
        /** 模拟的屏幕尺寸（界面像素），缺省 [400, 240] */
        viewport?: [number, number]
        /** 各界面在预览中的表单数据 */
        forms?: Record<string, CuiPreviewForm>
    }
}

/** 定义项目配置（只做类型提示，原样返回） */
export function defineConfig(config: CuiConfig): CuiConfig {
    return config
}
