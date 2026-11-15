/**
 * CuiApp：把界面挂到服务端表单、导出翻页路由、生成字形图、打包——两种用法，用户脚本写法相同：
 *
 *   const app = new CuiApp('my_book').screen('cui_ui:my_book', root)
 *   await app.build({ out: 'out', title: '我的书', scripts: 'scripts' })   // 独立打包成 .mcaddon
 *   app.useSapdon(sapdon)                                                   // 或嵌入 sapdon 的构建（import * as sapdon from '@sapdon/core'）
 *
 * 行为包脚本（两种用法一样）：
 *   import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
 *   import { paging } from './cui.generated.js'           // 构建时生成：界面 id → 翻页路由表
 *   const book = new ServerPagesForm(paging['cui_ui:my_book'])
 *
 * 嵌入 sapdon：界面 JSON 在 sapdon 的提交前钩子里登记进注册表（_ui_defs 交给 UISystemRegistry 合并），
 * cui.generated.js（与 .d.ts）写进项目的脚本目录、由 sapdon 的 rollup 连同 bedrock-cui/runtime 一起打包；清单、UUID、部署都由 sapdon 负责。
 * 独立打包：用 Addon（清单、UUID 文件、.mcaddon），运行时复制进行为包，脚本里的 'bedrock-cui/runtime…' 改写成相对路径（游戏不认裸模块名），
 * 最后对脚本做类型检查。
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
import { renderGlyphSheet, textureInfoFrom } from './tools.js'
import { Addon, checkScripts } from './addon.js'

/** 编译结果 */
export interface CuiCompiled {
    /** 资源包里的界面文件（相对资源包根目录 → JSON） */
    files: Record<string, object>
    /** 界面 id → 翻页路由表（界面里有服务端翻页箭头才有） */
    paging: Record<string, ServerPaging>
    /** 字形图：[资源包里的路径, PNG] */
    glyphs: [string, Uint8Array][]
    issues: LintIssue[]
}

/** sapdon 的 @sapdon/core 模块里用到的两样（由使用者传进来：bedrock-cui 不依赖 sapdon） */
export interface SapdonCore {
    GRegistry: {
        register(name: string, root: string, path: string, data: object): unknown
        beforeSubmit(hook: (entries: readonly { name: string, root: string, path: string }[]) => void): unknown
    }
    UISystemRegistry: { addOuterUIdefs(defs: string[]): void }
}

export interface CuiBuildOptions {
    /** 输出目录（写出 <名字>_RP、<名字>_BP、<名字>.mcaddon） */
    out: string
    /** 显示名（缺省 = 命名空间） */
    title?: string
    description?: string
    version?: [number, number, number]
    /** UUID 文件（缺省 <out>/<名字>.uuid.json；建议放进项目、提交到版本库） */
    uuidFile?: string
    /** 你的脚本目录（里面的文件原样复制进行为包的 scripts/，入口 main.js）；或直接给 脚本路径 → 内容 */
    scripts?: string | Record<string, string>
    /** 其余资源包文件：目录（整个复制进资源包）或 包内路径 → 本机文件 */
    resources?: string | Record<string, string>
    /** 行为包脚本模块依赖（缺省 @minecraft/server 2.0.0、@minecraft/server-ui 2.2.0） */
    dependencies?: Record<string, string>
    /** 对脚本做类型检查（缺省 true，需要 typescript 与 @minecraft 的类型包；找不到 typescript 时跳过并提示） */
    check?: boolean
}

export class CuiApp {
    private readonly panels: ServerPanel[] = []
    private textures?: (texture: string) => TextureInfo | undefined
    private readonly sheets: { sheet: GlyphSheet, resolve: (texture: string) => string }[] = []

    /** namespace = 界面 JSON 的命名空间（也是独立打包时附加包的名字） */
    constructor(readonly namespace: string) { }

    /** 挂一个界面：脚本用 `<panelId>…` 作表单标题打开服务端表单时显示 content（例如 'cui_ui:my_book'） */
    screen(panelId: string, content: Element, options: Omit<ServerPanel, 'panelId' | 'content'> = {}): this {
        this.panels.push({ ...options, panelId, content })
        return this
    }
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
        const { files, issues } = serverForm({ namespace: this.namespace, panels: this.panels, textures: this.textures })
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
        return { files: files as Record<string, object>, paging, glyphs, issues }
    }

    /** 打印检查结果；有错误就抛出（构建失败） */
    private report(issues: LintIssue[]): void {
        for (const i of issues) (i.level === 'error' ? console.error : console.warn)(`[bedrock-cui] ${i.level === 'error' ? '错误' : '警告'} ${i.rule} ${i.path}：${i.message}`)
        const errors = issues.filter((i) => i.level === 'error')
        if (errors.length) throw new Error(`bedrock-cui：界面有 ${errors.length} 个错误（见上）`)
    }

    /** cui.generated.js 的内容：界面 id → 翻页路由表。runtimeType = JSDoc 里 ServerPaging 类型的来源 */
    private generatedModule(paging: Record<string, ServerPaging>, runtimeType: string): string {
        return `// 由 bedrock-cui 生成，请勿手改（每次构建覆盖）\n` +
            `/** 界面 id → 翻页路由表（new ServerPagesForm(paging[界面 id])） @type {Record<string, import('${runtimeType}').ServerPaging>} */\n` +
            `export const paging = ${JSON.stringify(paging, null, 2)}\n`
    }

    /**
     * 独立打包：写出 <out>/<名字>_RP、_BP 与 <名字>.mcaddon；返回 .mcaddon 的路径。
     * 脚本：scripts 目录（或文件表）原样复制进 scripts/，'bedrock-cui/runtime…' 改写成运行时的相对路径；另写 scripts/cui.generated.js。
     */
    async build(options: CuiBuildOptions): Promise<string> {
        const c = this.compile()
        this.report(c.issues)
        const name = this.namespace
        const addon = new Addon(name).setTitle(options.title ?? name).setDescription(options.description ?? '')
            .useUuidFile(options.uuidFile ?? path.join(options.out, `${name}.uuid.json`))
        if (options.version) addon.setVersion(...options.version)
        addon.resources.addAll(c.files)
        for (const [file, png] of c.glyphs) addon.resources.add(file, png)
        if (typeof options.resources === 'string') addon.resources.addFrom(options.resources, '.')
        else for (const [target, source] of Object.entries(options.resources ?? {})) addon.resources.addFrom(source, target)
        const scripts = typeof options.scripts === 'string' ? readDir(options.scripts) : options.scripts ?? {}
        if (Object.keys(scripts).length) {
            addon.setScript('scripts/main.js', options.dependencies).addRuntime('scripts/cui')
            for (const [file, code] of Object.entries(scripts)) addon.behavior.add(`scripts/${file}`, file.endsWith('.js') ? rewriteRuntimeImports(code, file) : code)
            addon.behavior.add('scripts/cui.generated.js', this.generatedModule(c.paging, './cui/runtime/serverPages.js'))
        }
        const file = addon.pack(options.out)
        if (Object.keys(scripts).length && options.check !== false) {
            try {
                const errors = await checkScripts(path.join(options.out, `${name}_BP`))
                if (errors.length) throw new Error('bedrock-cui：脚本类型检查失败\n' + errors.join('\n'))
            } catch (e) {
                if (String(e).includes('需要 typescript')) console.warn('[bedrock-cui] 跳过脚本类型检查：' + (e as Error).message)
                else throw e
            }
        }
        return file
    }

    /**
     * 嵌入 sapdon 的构建（在 sapdon 项目的入口文件 main.ts 里调用）：提交前钩子里编译并登记界面 JSON，_ui_defs 交给 UISystemRegistry 合并；
     * 把 cui.generated.js / .d.ts 写进项目脚本目录（缺省 scripts/），由 sapdon 的 rollup 打包；字形图写进 res/（res 在项目代码运行之前同步，变了要再构建一次）。
     */
    useSapdon(sapdon: SapdonCore, options: { scriptsDir?: string, resDir?: string } = {}): this {
        sapdon.GRegistry.beforeSubmit((entries) => {
            const c = this.compile()
            this.report(c.issues)
            // sapdon 自己的服务端表单界面也写 ui/server_form.json：两边会互相覆盖
            if (entries.some((e) => e.root === 'resource' && /^ui\/?$/.test(e.path) && e.name === 'server_form')) {
                throw new Error('bedrock-cui：项目里同时用了 sapdon 的服务端表单界面（ServerFormUI）与 bedrock-cui——两者都改写 ui/server_form.json，会互相覆盖。请只用一种')
            }
            for (const [file, data] of Object.entries(c.files)) {
                if (file === 'ui/_ui_defs.json') { sapdon.UISystemRegistry.addOuterUIdefs((data as { ui_defs: string[] }).ui_defs); continue }
                sapdon.GRegistry.register(path.posix.basename(file, '.json'), 'resource', path.posix.dirname(file) + '/', data)
            }
            const scriptsDir = path.resolve(options.scriptsDir ?? 'scripts')
            fs.mkdirSync(scriptsDir, { recursive: true })
            fs.writeFileSync(path.join(scriptsDir, 'cui.generated.js'), this.generatedModule(c.paging, 'bedrock-cui/runtime/server-pages'))
            fs.writeFileSync(path.join(scriptsDir, 'cui.generated.d.ts'),
                `// 由 bedrock-cui 生成，请勿手改\nimport type { ServerPaging } from 'bedrock-cui/runtime/server-pages'\n/** 界面 id → 翻页路由表 */\nexport declare const paging: Record<string, ServerPaging>\n`)
            for (const [file, png] of c.glyphs) {
                const to = path.resolve(options.resDir ?? 'res', file)
                if (fs.existsSync(to) && Buffer.compare(fs.readFileSync(to), Buffer.from(png)) === 0) continue
                fs.mkdirSync(path.dirname(to), { recursive: true })
                fs.writeFileSync(to, png)
                console.warn(`[bedrock-cui] 字形图已更新：${path.relative(process.cwd(), to)}——res/ 在项目代码运行之前同步，请再构建一次`)
            }
        })
        return this
    }
}

/** 读目录里的全部文件（相对路径 → 文本） */
function readDir(dir: string): Record<string, string> {
    const out: Record<string, string> = {}
    const walk = (d: string) => {
        for (const f of fs.readdirSync(d)) {
            const p = path.join(d, f)
            if (fs.statSync(p).isDirectory()) walk(p)
            else out[path.relative(dir, p).replace(/\\/g, '/')] = fs.readFileSync(p, 'utf8')
        }
    }
    walk(dir)
    return out
}

/** 'bedrock-cui/runtime' / 'bedrock-cui/runtime/server-pages' → 行为包里运行时的相对路径（file = 相对 scripts/ 的路径） */
export function rewriteRuntimeImports(code: string, file: string): string {
    const up = '../'.repeat(file.split('/').length - 1) || './'
    return code
        .replace(/(['"])bedrock-cui\/runtime\/server-pages\1/g, `$1${up}cui/runtime/serverPages.js$1`)
        .replace(/(['"])bedrock-cui\/runtime\1/g, `$1${up}cui/runtime/index.js$1`)
}
