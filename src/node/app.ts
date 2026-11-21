/**
 * CuiApp：把界面挂到服务端表单、导出翻页路由、生成字形图，并接入 sapdon 的构建（清单、UUID、打包由 sapdon 负责）。
 *
 *   const app = CuiApp.fromConfig(config)       // 或 new CuiApp('my_book').screen('cui_ui:my_book', root)
 *   app.compile()                               // 只编译：界面文件、翻页路由、字形图、静态检查结果
 *   app.useSapdon({ GRegistry, UISystemRegistry })
 */
import fs from 'node:fs'
import path from 'node:path'
import { serverForm, type ServerFormPanel as ServerPanel } from '../mc/serverForm.js'
import { Pages } from '../components/pages.js'
import type { Element } from '../core/element.js'
import type { GlyphSheet } from '../core/glyphs.js'
import type { LintIssue } from '../mc/lint.js'
import type { TextureInfo } from '../layout/engine.js'
import type { ServerPaging } from '../core/serverPagesShared.js'
import { screenOf, type CuiConfig } from '../core/config.js'
import { Screen, type ScreenManifest } from '../core/screen.js'
import { encodePng, renderGlyphSheet, textureInfoFrom } from './tools.js'
import { SOLID_TEXTURE } from '../core/values.js'

/** 编译结果 */
export interface CuiCompiled {
    /** 资源包里的界面文件（相对资源包根目录 → JSON） */
    files: Record<string, object>
    /** 界面 id → 翻页路由表（界面里有服务端翻页箭头才有） */
    paging: Record<string, ServerPaging>
    /** defineUI 定义的界面：界面 id → 清单（名字与按钮序号的对应，附翻页路由表） */
    screens: Record<string, ScreenManifest & { paging?: ServerPaging }>
    /** 计时 HUD 的协议与槽位清单 */
    /** 字形图：[资源包里的路径, PNG] */
    glyphs: [string, Uint8Array][]
    issues: LintIssue[]
}

/**
 * useSapdon() 用到的 sapdon 成员（由使用者传进来：bedrock-cui 不依赖 sapdon）。
 * sapdon 4：GRegistry 在 @sapdon/core，UISystemRegistry 在 @sapdon/ui——
 *   import { GRegistry } from '@sapdon/core'; import { UISystemRegistry } from '@sapdon/ui'; app.useSapdon({ GRegistry, UISystemRegistry })
 * sapdon 3：两者都在 @sapdon/core——import * as sapdon from '@sapdon/core'; app.useSapdon(sapdon)
 */
export interface SapdonCore {
    GRegistry: {
        register(name: string, root: string, path: string, data: object): unknown
        beforeSubmit(hook: (entries: readonly { name: string, root: string, path: string, data?: unknown }[]) => void): unknown
    }
    /** 合并各方的 _ui_defs.json；不给时 bedrock-cui 自己登记（项目里别的界面定义会被覆盖） */
    UISystemRegistry?: { addOuterUIdefs(defs: string[]): void }
    /**
     * sapdon 的构建包解析器（@sapdon/core 的 addPacketResolver）。给出时，界面文件写成紧凑的 JSON；
     * 不给时由 sapdon 按缩进 2 格写出（嵌套很深的控件树中，缩进约占文件的八成）
     */
    addPacketResolver?(resolver: (state: { entries: readonly { name: string, root: string, path: string, data: unknown }[] }) => { files?: unknown[], consumed?: unknown[] } | void, options?: { priority?: number, id?: string }): void
}

/** 合并 sapdon 自动登记的 HUD 与 CUI 的通道补丁，保留不相关的 HUD 控件。 */
function mergeHudPatch(base: unknown, patch: object): object {
    if (base && typeof (base as { toObject?: unknown }).toObject === 'function') base = (base as { toObject(): unknown }).toObject()
    if (!base || typeof base !== 'object' || Array.isArray(base) || (base as { namespace?: unknown }).namespace !== 'hud') {
        throw new Error('bedrock-cui：现有 hud_screen.json 无法解析为 hud 命名空间，请先合并 HUD 修改')
    }
    const inspect = (value: unknown) => {
        if (!value || typeof value !== 'object') return
        const factory = (value as { factory?: { name?: string } }).factory?.name
        if (factory === 'hud_title_text_factory' || factory === 'hud_actionbar_text_factory') {
            throw new Error('bedrock-cui：现有 HUD 另行登记了标题或 actionbar 工厂，需要先统一通道所有权')
        }
        for (const child of Object.values(value)) inspect(child)
    }
    inspect(base)
    const merge = (a: unknown, b: unknown, key = ''): unknown => {
        if (Array.isArray(a) && Array.isArray(b) && key === 'modifications') {
            return [...new Map([...a, ...b].map((item) => [JSON.stringify(item), item])).values()]
        }
        if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
            const result: Record<string, unknown> = { ...a }
            for (const [name, value] of Object.entries(b)) result[name] = merge(result[name], value, name)
            return result
        }
        return b
    }
    return merge(base, patch) as object
}

export class CuiApp {
    private readonly panels: ServerPanel[] = []
    private textures?: (texture: string) => TextureInfo | undefined
    private readonly sheets: { sheet: GlyphSheet, resolve: (texture: string) => string }[] = []

    /** namespace = 界面 JSON 的命名空间（也是独立打包时附加包的名字） */
    constructor(readonly namespace: string) { }

    private manifests = new Map<string, ScreenManifest>()

    /** 挂载 defineUI 定义的界面：构建视图，记下清单 */
    addScreen(screen: Screen): this {
        const { root, manifest } = screen.build()
        this.manifests.set(screen.id, manifest)
        return this.screen(screen.id, root)
    }

    /** 由项目配置创建（root = 项目根目录，贴图目录相对于它） */
    static fromConfig(config: CuiConfig, root = process.cwd()): CuiApp {
        const app = new CuiApp(config.namespace)
        if (Array.isArray(config.screens)) for (const s of config.screens) app.addScreen(s)
        else for (const [panelId, s] of Object.entries(config.screens)) {
            if (s instanceof Screen) {
                if (s.id !== panelId) throw new Error(`配置中的界面 id「${panelId}」与 defineUI 的 id「${s.id}」不一致`)
                app.addScreen(s)
                continue
            }
            const { build, routed } = screenOf(s)
            app.screen(panelId, build(), routed ? { routed } : {})
        }
        const dirs = (config.textures ?? ['res']).map((d) => path.resolve(root, d))
        app.setTextures(dirs)
        for (const sheet of config.glyphs ?? []) {
            app.glyphSheet(sheet, (texture) => dirs.map((d) => path.join(d, `${texture}.png`)).find((f) => fs.existsSync(f)) ?? path.join(dirs[0], `${texture}.png`))
        }
        return app
    }

    /** 挂一个界面：脚本用 `<panelId>…` 作表单标题打开服务端表单时显示 content（例如 'cui_ui:my_book'） */
    screen(panelId: string, content: Element, options: Omit<ServerPanel, 'panelId' | 'content'> = {}): this {
        this.panels.push({ ...options, panelId, content })
        return this
    }
    /** 登记独立计时 HUD */
    /** 贴图信息（尺寸、九宫格；静态检查与预览用）：函数，或资源包目录列表（读 PNG 尺寸与 .json） */
    setTextures(textures: ((texture: string) => TextureInfo | undefined) | string[]): this {
        this.textures = Array.isArray(textures) ? textureInfoFrom(textures) : textures
        return this
    }
    /** 字形图（emoji 页）：resolve = 贴图路径 → 本机 PNG 文件 */
    glyphSheet(sheet: GlyphSheet, resolve: (texture: string) => string): this {
        this.sheets.push({ sheet, resolve })
        return this
    }

    /** 编译（不写文件）：界面文件、翻页路由、字形图、静态检查结果 */
    compile(): CuiCompiled {
        if (!this.panels.length) throw new Error('CuiApp：还没有 screen()')
        // 可以反复编译（构建多次、提交前钩子多次）：serverForm 会把界面根元素放进外层面板，先从上一次的外层面板里取下来
        for (const p of this.panels) {
            const parent = p.content.parent
            if (!parent) continue
            const i = parent.children.indexOf(p.content)
            if (i >= 0) (parent.children as Element[]).splice(i, 1)
            p.content.parent = undefined
        }
        const { files, issues } = this.panels.length ? serverForm({ namespace: this.namespace, panels: this.panels, textures: this.textures }) : { files: {} as Record<string, unknown>, issues: [] as LintIssue[] }
        const paging: Record<string, ServerPaging> = {}
        for (const p of this.panels) {
            const found: ServerPaging[] = []
            const walk = (el: Element) => {
                if (el instanceof Pages) { const r = el.serverPaging(p.panelId); if (r.arrows.length || r.stay !== undefined) found.push(r) }
                el.children.forEach(walk)
            }
            walk(p.content)
            if (found.length > 1) throw new Error(`界面 ${p.panelId} 里有 ${found.length} 组带服务端翻页的 Pages：表单按钮序号会冲突，一个界面只放一组（或用 setButtonBase 错开并自己写脚本）`)
            if (found.length) paging[p.panelId] = found[0]
        }
        const glyphs: [string, Uint8Array][] = []
        for (const { sheet, resolve } of this.sheets) {
            const g = renderGlyphSheet(sheet, resolve)
            if (g.issues.length) issues.push(...g.issues.map((message) => ({ rule: 'glyph-sheet', level: 'error' as const, path: g.file, message })))
            glyphs.push([g.file, g.png])
        }
        // 内置纯白贴图：界面用到时才写进资源包
        if (JSON.stringify(files).includes(SOLID_TEXTURE)) glyphs.push([`${SOLID_TEXTURE}.png`, new Uint8Array(encodePng(2, 2, new Uint8Array(16).fill(255)))])
        const screens = Object.fromEntries([...this.manifests].map(([id, m]) => [id, paging[id] ? { ...m, paging: paging[id] } : m]))
        return { files: files as Record<string, object>, paging, screens, glyphs, issues }
    }

    /** 打印检查结果；有错误就抛出（构建失败） */
    private report(issues: LintIssue[]): void {
        for (const i of issues) (i.level === 'error' ? console.error : console.warn)(`[bedrock-cui] ${i.level === 'error' ? '错误' : '警告'} ${i.rule} ${i.path}：${i.message}`)
        const errors = issues.filter((i) => i.level === 'error')
        if (errors.length) throw new Error(`bedrock-cui：界面有 ${errors.length} 个错误（见上）`)
    }

    /** cui.generated.js 的内容：界面 id → 翻页路由表。runtimeType = JSDoc 里 ServerPaging 类型的来源 */
    private generatedModule(paging: Record<string, ServerPaging>, runtimeType: string, screens: CuiCompiled['screens'] = {}): string {
        return `// 由 bedrock-cui 生成，请勿手改（每次构建覆盖）\n` +
            `/** 界面 id → 翻页路由表（new ServerPagesForm(paging[界面 id])） @type {Record<string, import('${runtimeType}').ServerPaging>} */\n` +
            `export const paging = ${JSON.stringify(paging, null, 2)}\n` +
            `/** defineUI 定义的界面：界面 id → 清单（名字与按钮序号的对应） @type {Record<string, import('bedrock-cui').ScreenManifest & { paging?: import('${runtimeType}').ServerPaging }>} */\n` +
            `export const screens = ${JSON.stringify(screens, null, 2)}\n` +
            (Object.keys(screens).length ? `// 登记清单：之后界面的 open() / close() 可用\nimport { registerScreens } from 'bedrock-cui/runtime/screens'\nregisterScreens(screens)\n` : '')
    }

    /**
     * 嵌入 sapdon 的构建（在 sapdon 项目的入口文件 main.ts 里调用）：提交前钩子里编译并登记界面 JSON，_ui_defs 交给 UISystemRegistry 合并；
     * 把 cui.generated.js / .d.ts 写进项目脚本目录（缺省 scripts/），由 sapdon 的 rollup 打包；字形图写进 res/（res 在项目代码运行之前同步，变了要再构建一次）。
     */
    useSapdon(sapdon: SapdonCore, options: { scriptsDir?: string, resDir?: string } = {}): this {
        // sapdon 4 提交构建内容时用 JSON.rawJSON / JSON.isRawJSON（Node 21 起才有）。旧版 Node 上提交会出错，而 sapdon 只打印
        // 「Dev server not running」、构建照样成功——包里缺了全部界面文件却毫无提示。所以在这里先拦住
        if (typeof (JSON as unknown as { rawJSON?: unknown }).rawJSON !== 'function') {
            throw new Error(`bedrock-cui：sapdon 4 需要 Node.js 22.12 或更高版本（当前 ${process.version} 没有 JSON.rawJSON，提交构建内容会失败，界面文件不会写出）`)
        }
        // 界面文件写成紧凑的 JSON：认领 bedrock-cui 登记的界面文件，以文本写出（sapdon 缺省按缩进 2 格写 JSON）
        const ours = new Set<string>()
        sapdon.addPacketResolver?.(({ entries }) => {
            const mine = entries.filter((e) => e.root === 'resource' && ours.has(`${e.path}${e.name}`))
            return {
                files: mine.map((e) => ({ root: 'resource', path: e.path, name: e.name, ext: 'json', format: 'text', data: JSON.stringify(e.data) })),
                consumed: mine,
            }
        }, { id: 'bedrock-cui:compact-ui', priority: 10 })
        sapdon.GRegistry.beforeSubmit((entries) => {
            const c = this.compile()
            this.report(c.issues)
            // sapdon 自己的服务端表单界面也写 ui/server_form.json：两边会互相覆盖
            if (c.files['ui/server_form.json'] && entries.some((e) => e.root === 'resource' && /^ui\/?$/.test(e.path) && e.name === 'server_form')) {
                throw new Error('bedrock-cui：项目里同时用了 sapdon 的服务端表单界面（ServerFormUI）与 bedrock-cui——两者都改写 ui/server_form.json，会互相覆盖。请只用一种')
            }
            for (const [file, data] of Object.entries(c.files)) {
                if (file === 'ui/_ui_defs.json') {
                    const defs = (data as { ui_defs: string[] }).ui_defs
                    if (sapdon.UISystemRegistry?.addOuterUIdefs) {
                        const existingDefs = entries.filter((e) => e.root === 'resource' && /^ui\/?$/.test(e.path) && e.name === '_ui_defs').at(-1)?.data as { ui_defs?: string[] } | undefined
                        const known = new Set(existingDefs?.ui_defs ?? [])
                        sapdon.UISystemRegistry.addOuterUIdefs(defs.filter((name) => !known.has(name)))
                        continue
                    }
                    console.warn('[bedrock-cui] 没有传入 UISystemRegistry（sapdon 4 在 @sapdon/ui 里）：自己登记 ui/_ui_defs.json，项目里别的界面定义会被覆盖')
                }
                ours.add(`${path.posix.dirname(file)}/${path.posix.basename(file, '.json')}`)
                sapdon.GRegistry.register(path.posix.basename(file, '.json'), 'resource', path.posix.dirname(file) + '/', data)
            }
            const scriptsDir = path.resolve(options.scriptsDir ?? 'scripts')
            fs.mkdirSync(scriptsDir, { recursive: true })
            fs.writeFileSync(path.join(scriptsDir, 'cui.generated.js'), this.generatedModule(c.paging, 'bedrock-cui', c.screens))
            fs.writeFileSync(path.join(scriptsDir, 'cui.generated.d.ts'),
                `// 由 bedrock-cui 生成，请勿手改\nimport type { ScreenManifest, ServerPaging } from 'bedrock-cui'\n/** 界面 id → 翻页路由表 */\nexport declare const paging: Record<string, ServerPaging>\n/** 界面文件定义的界面：界面 id → 清单 */\nexport declare const screens: Record<string, ScreenManifest & { paging?: ServerPaging }>\n`)
            // 字形图：写进 res/（以后的构建由 sapdon 同步）；sapdon 4 通过 SAPDON_BUILD_CONTEXT 告知本次构建的输出目录，
            // 同时直接写进本次输出的资源包——res/ 在运行构建入口之前就同步完了，否则新生成的字形图要再构建一次才进包
            let ctx: { projectName?: string, projectPath?: string, buildDir?: string } | undefined
            try { ctx = process.env.SAPDON_BUILD_CONTEXT ? JSON.parse(process.env.SAPDON_BUILD_CONTEXT) : undefined } catch { ctx = undefined }
            const rpOut = ctx?.projectName && ctx.projectPath ? path.join(ctx.projectPath, ctx.buildDir ?? 'dev', `${ctx.projectName}_RP`) : undefined
            for (const [file, png] of c.glyphs) {
                if (rpOut) { const out = path.join(rpOut, file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, png) }
                const to = path.resolve(options.resDir ?? 'res', file)
                if (fs.existsSync(to) && Buffer.compare(fs.readFileSync(to), Buffer.from(png)) === 0) continue
                fs.mkdirSync(path.dirname(to), { recursive: true })
                fs.writeFileSync(to, png)
                if (!rpOut) console.warn(`[bedrock-cui] 生成的贴图已更新：${path.relative(process.cwd(), to)}——res/ 在项目代码运行之前同步，请再构建一次`)
            }
        })
        return this
    }
}

/**
 * 嵌入 sapdon 的构建（sapdon 项目的入口文件 main.mjs 中调用）：
 *   import config from './cui.config.mjs'
 *   import { GRegistry, registry } from '@sapdon/core'
 *   import { UISystemRegistry } from '@sapdon/ui'
 *   useSapdon(config, { GRegistry, UISystemRegistry })
 *   registry.submit()
 */
export function useSapdon(config: CuiConfig, sapdon: SapdonCore, root = process.cwd()): CuiApp {
    return CuiApp.fromConfig(config, root).useSapdon(sapdon, { scriptsDir: path.resolve(root, config.scripts ?? 'scripts') })
}
