/**
 * 浏览器预览：完全按排版引擎的结果画（不用 CSS 布局去近似锚点），所以预览里看到的位置就是引擎算的位置。
 *
 *   mountPreview(el, { root, textures, viewport, scale })
 *     · 数据：表单正文、表单按钮文字、标题都是信号（可在开发面板里改），改了自动重排重绘
 *     · 交互：鼠标悬停 / 按下按「最上层的按钮」判定，驱动按钮的三种状态；点击调用 onPress / onFormButton
 *     · 贴图：像素风缩放；九宫格用 border-image；keep_ratio 按引擎算出的实际绘制矩形画
 */
import { finalize, Panel, type Element } from '../core/element.js'
import { asBool, evalExpr, isExpr } from '../core/expr.js'
import { walk, type RNode } from '../core/node.js'
import { effect, signal, type Signal } from '../core/reactivity.js'
import { drawOrder, layout, type Box, type Rect, type TextureInfo } from '../layout/engine.js'
import { compileNamespace } from '../mc/compile.js'
import type { LintIssue } from '../mc/lint.js'
import { GLYPH_HEIGHT, LINE_HEIGHT, boldExtra, charWidth, usesUnifont } from '../font/metrics.js'
import { BEDROCK_COLORS, PLAIN, parseRich, type RunStyle } from '../font/rich.js'
import { drawText, loadPixelFonts, type PixelFonts } from './pixelFont.js'
import { GlyphSheet } from '../core/glyphs.js'

export { loadPixelFonts, drawText, type PixelFonts } from './pixelFont.js'

export interface PreviewTexture extends TextureInfo {
    /** 图片地址 */
    url: string
}

export interface PreviewOptions {
    /** 根元素（或每次重新构建的函数） */
    root: Element | (() => Element)
    viewport?: [number, number]
    scale?: number
    textures?: Record<string, PreviewTexture>
    /** 表单数据（不给就新建） */
    formText?: Signal<string>
    formButtons?: Signal<string[]>
    /** 表单按钮的图标路径，按序号（form.buttonTexture 读它） */
    formButtonIcons?: Signal<string[]>
    title?: Signal<string>
    /** 点击了第 index 个表单按钮（预览里模拟服务端：可以改 formText / formButtons） */
    onFormButton?: (index: number, text: string) => void
    translate?: (key: string) => string
    /** 叠加显示每个控件的边框 */
    outlines?: Signal<boolean>
    /**
     * 像素字体（照游戏画文字）：Unifont（.hex / .hex.gz）与 Minecraft 默认字体 ascii.png 的地址。
     * 由 scripts/fetch-fonts.mjs 准备；不给或加载失败就退回系统字体。
     */
    fonts?: { unifont?: string, ascii?: string }
}

export interface Preview {
    formText: Signal<string>
    formButtons: Signal<string[]>
    formButtonIcons: Signal<string[]>
    title: Signal<string>
    outlines: Signal<boolean>
    /** 当前排版结果（测试 / 调试用） */
    boxes(): Box[]
    issues(): LintIssue[]
    compiled(namespace?: string): Record<string, unknown>
    /** 清空开关状态（模拟服务端重新打开表单：开关回到初始状态）；start = 服务端分页按路由打开到的页（组 → 序号） */
    resetToggles(start?: Record<string, number>): void
    /** 改屏幕大小（界面像素）：看响应式布局在手机 / 平板 / 电脑上的样子 */
    resize(width: number, height: number): void
    readonly viewport: Signal<[number, number]>
    dispose(): void
}


const rgb = (c?: number[]) => (c ? `rgb(${c.map((v) => Math.round(v * 255)).join(',')})` : '#ffffff')

/**
 * 九宫格的切片把整张贴图都切完了（原版 highlight_slot：1×1 像素、nineslice 1）：中间区域为 0，
 * 浏览器的 border-image 会把中间画成空的，游戏里则是整块拉伸 ⇒ 按拉伸画。
 */
function degenerate(b: Box, t: PreviewTexture): boolean {
    const s = b.slice ?? b.nineslice
    if (!s || !t.size) return false
    return s[0] + s[2] >= t.size[0] || s[1] + s[3] >= t.size[1]
}

const OBF = 'abcdefghjkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=?'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/**
 * 一行富文本 → span（基岩版格式码：颜色、§l 粗体、§o 斜体、§k 乱码、§r 重置）；返回行末样式（延续到下一行）。
 * **逐字定位**：每个字占的宽度严格按字宽表（与排版引擎一致），字形居中放在自己的格子里——
 * 系统字体的字形宽度与游戏不同（等宽字体里 i 和 W 一样宽），不逐字定位的话预览里的折行位置会对不上。
 */
function lineHtml(line: string, base: string, start: RunStyle, px: number, unifont: boolean): { html: string, end: RunStyle } {
    const { runs, end } = parseRich(line, start)
    let html = ''
    for (const r of runs) {
        const st = r.style
        const color = st.color ? BEDROCK_COLORS[st.color] : base
        const style = `color:${color};${st.bold ? 'font-weight:bold;' : ''}${st.italic ? 'font-style:italic;' : ''}`
        for (const ch of r.text) {
            const shown = st.obfuscated && ch !== ' ' ? OBF[Math.floor(Math.random() * OBF.length)] : ch
            const w = (charWidth(ch, unifont) + (st.bold ? boldExtra(ch, unifont) : 0)) * px
            html += `<span style="${style}display:inline-block;width:${w}px;text-align:center;overflow:visible">${ch === ' ' ? '&nbsp;' : esc(shown)}</span>`
        }
    }
    return { html: html || '&#8203;', end }
}

export function mountPreview(el: HTMLElement, options: PreviewOptions): Preview {
    // 视口是信号：resize() 改屏幕大小，排版重算（响应式布局在不同屏幕上的样子）
    const viewport = signal<[number, number]>(options.viewport ?? [320, 210])
    const scale = options.scale ?? 3
    const formText = options.formText ?? signal('')
    const formButtons = options.formButtons ?? signal<string[]>([])
    const formButtonIcons = options.formButtonIcons ?? signal<string[]>([])
    const title = options.title ?? signal('')
    const outlines = options.outlines ?? signal(false)
    const hover = signal<string | undefined>(undefined)
    const pressed = signal<string | undefined>(undefined)
    const textures = options.textures ?? {}
    const pixel = signal<PixelFonts | undefined>(undefined)
    // 图片染色：游戏把贴图的颜色逐像素乘上 color。预览用画布生成一份染过色的贴图（按贴图与颜色缓存），生成后重画；
    // 普通贴图与九宫格（border-image，CSS 混合模式对它不起作用）都用这份结果
    const tintLoaded = signal(0)
    const tinted = new Map<string, string>()
    const tintUrl = (url: string, color: number[] | undefined): string => {
        if (!color || color.slice(0, 3).every((c) => c >= 0.999)) return url
        const key = `${url}|${color.join(',')}`
        const hit = tinted.get(key)
        if (hit) return hit
        if (hit === undefined) {
            tinted.set(key, '')
            const img = new Image()
            img.onload = () => {
                const c = document.createElement('canvas')
                c.width = img.naturalWidth; c.height = img.naturalHeight
                const ctx = c.getContext('2d')!
                ctx.drawImage(img, 0, 0)
                const data = ctx.getImageData(0, 0, c.width, c.height)
                for (let i = 0; i < data.data.length; i += 4) for (let k = 0; k < 3; k++) data.data[i + k] = Math.round(data.data[i + k] * color[k])
                ctx.putImageData(data, 0, 0)
                tinted.set(key, c.toDataURL())
                tintLoaded.value++
            }
            img.src = url
        }
        return url
    }
    // 字形图标的图片：按需加载，加载完重画
    const glyphLoaded = signal(0)
    const glyphImgs = new Map<string, HTMLImageElement>()
    const glyphImage = (ch: string) => {
        const g = GlyphSheet.lookup(ch)
        const url = g && textures[g.texture.path]?.url
        if (!g || !url) return undefined
        let img = glyphImgs.get(url)
        if (!img) { img = new Image(); img.onload = () => { glyphLoaded.value++ }; img.src = url; glyphImgs.set(url, img) }
        return img.complete && img.naturalWidth ? { img, ink: g.ink } : undefined
    }
    if (options.fonts) void loadPixelFonts(options.fonts).then((f) => { if (f.unifont || f.ascii) pixel.value = f })
    const rootEl = (): Element => (typeof options.root === 'function' ? (options.root as () => Element)() : options.root)
    let nodes: RNode[] = []
    let toggleByName = new Map<string, RNode>()
    /**
     * 单选组里**被点的那个开关**的名字（真机：同序号的开关不会一起选中，只有被点的那个选中）；
     * 还没点过时，序号 = 初始选中序号的开关算选中。非单选开关单独记状态。
     */
    const groups = signal<Record<string, string>>({})
    /** 服务端分页：模拟按路由打开到某页（组 → 初始选中序号） */
    const startOf = signal<Record<string, number>>({})
    /** 滚动区域的滚动量（路径 → 像素） */
    const scrolls = signal<Record<string, number>>({})
    const flags = signal<Record<string, boolean>>({})
    const tree = (): RNode[] => {
        nodes = finalize(rootEl())
        toggleByName = new Map()
        walk(nodes, (n) => { if (n.type === 'toggle') toggleByName.set(n.name, n) })
        return nodes
    }
    const checked = (n: RNode): boolean => {
        // 用表达式设定状态的开关（stateFrom）：按当前数据算
        if (n.props.stateFrom) return asBool(evalExpr(n.props.stateFrom, { ref: (name, src) => data(name, src as never, {}) as never }))
        if (n.props.radio === false) return flags.value[n.name] ?? Boolean(n.props.defaultState)
        const picked = groups.value[n.props.group]
        // 服务端分页的开关继承路由变量：预览里由 resetToggles({ 组: 序号 }) 模拟，缺省是初始页
        const def = n.props.defaultSelected ?? startOf.value[n.props.group] ?? n.props.serverDefault ?? 0
        return picked !== undefined ? picked === n.name : def === n.props.index
    }
    let current: Box[] = []

    const screen = document.createElement('div')
    Object.assign(screen.style, {
        // isolation：预览内部按层级设置的 z-index（可达上千）只在预览里比较，不会盖到宿主页面的导航栏等元素上
        position: 'relative', isolation: 'isolate', width: `${viewport.value[0] * scale}px`, height: `${viewport.value[1] * scale}px`, overflow: 'hidden',
        background: 'repeating-conic-gradient(#3a3a3a 0% 25%, #333 0% 50%) 0 0 / 24px 24px', imageRendering: 'pixelated', userSelect: 'none',
        fontFamily: '"Minecraft", "Unifont", "Zpix", monospace',
    })
    el.appendChild(screen)

    const data = (name: string, src: { kind: string, control?: string }, scope: { collection?: { index: number } }) => {
        if (src.kind === 'control') {
            const t = toggleByName.get(src.control ?? '')
            return name === '#toggle_state' && t ? checked(t) : ''
        }
        if (name === '#form_text') return formText.value
        if (name === '#title_text') return title.value
        if (name === '#form_button_text') return formButtons.value[scope.collection?.index ?? -1] ?? ''
        if (name === '#form_button_texture') return formButtonIcons.value[scope.collection?.index ?? -1] ?? ''
        return ''
    }

    // 设备像素比（Windows 显示缩放 150% = 1.5、浏览器缩放也算）：文字按设备像素画，不让浏览器再拉伸——
    // 先前画布按 CSS 像素画，150% 缩放下被浏览器放大 1.5 倍，文字发虚、形状走样（用户反馈）。缩放改变时重画
    const dprNow = () => (typeof window !== 'undefined' && window.devicePixelRatio) || 1
    const dpr = signal(dprNow())
    if (typeof window !== 'undefined') window.addEventListener('resize', () => { if (dprNow() !== dpr.value) dpr.value = dprNow() })
    // 控件的位置与尺寸取整到设备像素：汉字字距 8.5，行内排版拆出的文字段常从 x.5 开始——摆在小数坐标上，浏览器会再插值一次、整段发虚
    const S = (v: number) => `${Math.round(v * scale * dpr.value) / dpr.value}px`
    // 裁剪区 = 祖先的裁剪框（相对这个元素，可以伸到元素外面：文字画布比控件大一圈——阴影、斜体、大字形图标——不能被控件自己的框切掉）
    const clipPath = (b: Box, area: Rect) => {
        if (!b.clip) return ''
        const c = b.clip
        const l = S(c.x - area.x), t = S(c.y - area.y), r = S(c.x + c.w - area.x), bt = S(c.y + c.h - area.y)
        return `polygon(${l} ${t}, ${r} ${t}, ${r} ${bt}, ${l} ${bt})`
    }

    const draw = (b: Box): HTMLElement | undefined => {
        const n = b.node
        const d = document.createElement('div')
        const area = b.draw ?? b.rect
        Object.assign(d.style, { position: 'absolute', left: S(area.x), top: S(area.y), width: S(area.w), height: S(area.h), zIndex: String(1000 + b.z), pointerEvents: 'none' })
        if (n.props.alpha !== undefined) d.style.opacity = String(n.props.alpha)
        const cp = clipPath(b, area)
        if (cp) d.style.clipPath = cp
        if (n.type === 'image') {
            const t = textures[b.texture ?? '']
            if (!b.texture && isExpr(n.props.texture)) {
                d.style.display = 'none'       // 贴图来自绑定且为空（例如按钮没有图标）：游戏中隐藏
            } else if (!t) {
                Object.assign(d.style, { background: 'repeating-linear-gradient(45deg,#f0f 0 4px,#000 4px 8px)', opacity: '0.6' })
                d.title = `缺贴图：${b.texture}`
            } else if (b.nineslice !== undefined && !degenerate(b, t)) {
                // 切图用贴图像素（高清贴图 = 边宽 × 像素 / base_size），画宽用界面像素
                const [l, tp, r, bt] = b.nineslice
                const [sl, st, sr, sb] = b.slice ?? b.nineslice
                Object.assign(d.style, { borderStyle: 'solid', borderWidth: `${S(tp)} ${S(r)} ${S(bt)} ${S(l)}`, borderImage: `url("${tintUrl(t.url, n.props.color)}") ${st} ${sr} ${sb} ${sl} fill stretch`, boxSizing: 'border-box' })
            } else {
                Object.assign(d.style, { backgroundImage: `url("${tintUrl(t.url, n.props.color)}")`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' })
            }
            if (b.clipRatio !== undefined && n.props.clipDirection) {
                const k = Math.max(0, Math.min(1, b.clipRatio))
                const dir = n.props.clipDirection
                const ins = dir === 'left' ? `0 0 0 ${k * 100}%` : dir === 'right' ? `0 ${k * 100}% 0 0` : dir === 'up' ? `${k * 100}% 0 0 0` : dir === 'down' ? `0 0 ${k * 100}% 0` : `${k * 50}%`
                d.style.clipPath = `inset(${ins})`
            }
        } else if (n.type === 'label' && pixel.value && drawPixelLabel(d, b, n, pixel.value)) {
            // 像素字体画好了（画不出来——例如 Unifont 没加载——就走下面的系统字体画法，文字不会消失）
        } else if (n.type === 'label') {
            const fs = (n.props.fontScale ?? 1) * scale
            Object.assign(d.style, {
                fontSize: `${GLYPH_HEIGHT * fs}px`, lineHeight: `${LINE_HEIGHT * fs}px`, whiteSpace: 'pre', textAlign: n.props.align ?? 'left',
                textShadow: n.props.shadow ? `${fs}px ${fs}px 0 rgba(0,0,0,0.75)` : 'none', overflow: 'visible',
            })
            // 样式延续到下一行（与游戏里一段文字被折成多行时一致；预折行的每行开头也补了样式码）
            let st: RunStyle = PLAIN
            const uni = usesUnifont((b.lines ?? []).join('\n'))
            d.innerHTML = (b.lines ?? []).map((l) => { const r = lineHtml(l, rgb(n.props.color), st, fs, uni); st = r.end; return `<div>${r.html}</div>` }).join('')
        } else if (!outlines.value) {
            return undefined
        }
        if (outlines.value) d.style.outline = `1px solid ${n.type === 'button' ? '#ff0' : n.type === 'toggle' ? '#f0f' : n.type === 'collection_item' ? '#0ff' : 'rgba(255,80,80,0.7)'}`
        return d
    }

    /** 像素字体画一个文字控件：画布按文字实际宽度（可能比控件宽，与游戏一样不裁剪）；大字形图标上下留余量、画布往上挪 */
    const drawPixelLabel = (d: HTMLElement, b: Box, n: RNode, fonts: PixelFonts): boolean => {
        const canvas = document.createElement('canvas')
        const lines = b.lines ?? []
        const k = dpr.value
        // 画布按设备像素画（缩放 × 设备像素比），CSS 尺寸 = 画布像素 / 设备像素比：一个画布像素正好是一个屏幕像素
        const r = drawText(canvas, fonts, {
            lines, color: (n.props.color ?? [1, 1, 1]) as [number, number, number], shadow: !!n.props.shadow,
            unifont: usesUnifont(lines.join('\n')), align: n.props.align ?? 'left', width: b.rect.w, scale: scale * k, fontScale: n.props.fontScale ?? 1,
            glyphImage, lineSpacing: n.props.lineSpacing,
        })
        if (!r) return false
        // 画布比控件大一圈（阴影、斜体、大字形图标的余量），从控件左上角开始、超出部分照常显示——控件的 div 保持排版尺寸，
        // 调试边框才与控件对齐（先前把 div 撑成画布大小，边框比控件大一圈、文字看起来偏在左上角）
        Object.assign(canvas.style, {
            position: 'absolute', left: '0px', top: `${-Math.round(r.padTop * scale * k * (n.props.fontScale ?? 1)) / k}px`,
            width: `${canvas.width / k}px`, height: `${canvas.height / k}px`, imageRendering: 'pixelated', display: 'block',
        })
        d.appendChild(canvas)
        return true
    }

    const render = effect(() => {
        // 读信号 → 建立依赖
        void formText.value; void formButtons.value; void formButtonIcons.value; void title.value; void outlines.value; void groups.value; void flags.value; void pixel.value; void startOf.value; void scrolls.value; void glyphLoaded.value; void tintLoaded.value; void dpr.value
        const vp = viewport.value
        screen.style.width = `${vp[0] * scale}px`; screen.style.height = `${vp[1] * scale}px`
        const st = { hover: hover.value, pressed: pressed.value }
        current = layout(tree(), {
            viewport: vp, data: data as never, translate: options.translate,
            textures: (p) => textures[p],
            buttonState: (path) => (st.pressed === path ? 'pressed' : st.hover === path ? 'hover' : 'default'),
            toggleChecked: checked,
            scrollOffset: (path) => scrolls.value[path] ?? 0,
        })
        screen.replaceChildren()
        for (const b of drawOrder(current)) {
            const d = draw(b); if (d) screen.appendChild(d)
            // 滚动区域：内容超出视口时画滚动条（区域内侧，宽 4，左边距 2）
            if (b.scroll && b.scroll.content > b.scroll.view + 0.5) {
                const { view, content, offset } = b.scroll
                const track = { x: b.rect.x + b.rect.w - 6, y: b.rect.y, w: 4, h: view }
                const thumbH = Math.max(6, (view / content) * view)
                const thumbY = track.y + (offset / (content - view)) * (view - thumbH)
                for (const [r, color] of [[track, 'rgba(0,0,0,0.35)'], [{ ...track, y: thumbY, h: thumbH }, 'rgba(200,200,200,0.8)']] as const) {
                    const bar = document.createElement('div')
                    Object.assign(bar.style, { position: 'absolute', left: S(r.x), top: S(r.y), width: S(r.w), height: S(r.h), background: color, zIndex: String(1000 + b.z + 1), pointerEvents: 'none' })
                    screen.appendChild(bar)
                }
            }
        }
    })

    /** 最上层、可见、包含该点的按钮 / 开关 */
    const hit = (x: number, y: number): Box | undefined => {
        let found: Box | undefined
        for (const b of drawOrder(current)) {
            if (b.node.type !== 'button' && b.node.type !== 'toggle') continue
            if (b.enabled === false) continue
            const r = b.rect
            const c = b.clip
            if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) continue
            if (c && (x < c.x || y < c.y || x >= c.x + c.w || y >= c.y + c.h)) continue
            found = b
        }
        return found
    }
    const pos = (e: MouseEvent) => { const r = screen.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale] as const }
    screen.addEventListener('mousemove', (e) => { hover.value = hit(...pos(e))?.node.path })
    // 鼠标滚轮：滚动光标下最上层的滚动区域
    screen.addEventListener('wheel', (e) => {
        const [x, y] = pos(e)
        let target: Box | undefined
        const visit = (b: Box) => { const r = b.rect; if (b.scroll && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) target = b; b.children.forEach(visit) }
        current.forEach(visit)
        if (!target?.scroll) return
        e.preventDefault()
        const max = Math.max(0, target.scroll.content - target.scroll.view)
        const next = Math.min(max, Math.max(0, target.scroll.offset + Math.sign(e.deltaY) * 10))
        scrolls.value = { ...scrolls.value, [target.node.path]: next }
    }, { passive: false })
    screen.addEventListener('mouseleave', () => { hover.value = undefined; pressed.value = undefined })
    screen.addEventListener('mousedown', (e) => { pressed.value = hit(...pos(e))?.node.path })
    screen.addEventListener('mouseup', (e) => {
        const b = hit(...pos(e))
        if (b && b.node.path === pressed.value && b.node.type === 'toggle') {
            const t = b.node
            if (t.props.radio === false) flags.value = { ...flags.value, [t.name]: !checked(t) }
            else groups.value = { ...groups.value, [t.props.group]: t.name }
        } else if (b && b.node.path === pressed.value) {
            b.node.props.onPress?.()
            const idx = b.scope.collection?.index
            if (idx !== undefined) options.onFormButton?.(idx, formButtons.value[idx] ?? '')
        }
        pressed.value = undefined
    })

    return {
        formText, formButtons, formButtonIcons, title, outlines,
        boxes: () => current,
        issues: () => compileNamespace('preview', { root: rootEl() }, { textures: (p) => textures[p] }).issues,
        compiled: (ns = 'preview') => compileNamespace(ns, { root: rootEl() }, { textures: (p) => textures[p] }).json,
        resetToggles: (start?: Record<string, number>) => { groups.value = {}; flags.value = {}; startOf.value = start ?? {} },
        resize: (w: number, h: number) => { viewport.value = [w, h] },
        viewport,
        dispose: () => { render.stop(); screen.remove() },
    }
}

/** 开发面板：改表单正文 / 按钮文字、看静态检查与编译出的 JSON、叠加边框 */
export function mountDevtools(el: HTMLElement, preview: Preview): void {
    el.innerHTML = `
<div style="font:13px system-ui,sans-serif;color:#ddd;display:flex;flex-direction:column;gap:8px">
  <label>表单正文 <code>#form_text</code><textarea data-k="text" rows="2" style="width:100%;font:12px monospace"></textarea></label>
  <label>表单按钮文字（每行一个，从 0 起）<textarea data-k="buttons" rows="8" style="width:100%;font:12px monospace"></textarea></label>
  <label><input type="checkbox" data-k="outlines"> 显示控件边框</label>
  <div><b>静态检查</b><ul data-k="issues" style="margin:4px 0;padding-left:18px"></ul></div>
  <details><summary>编译出的 JSON UI</summary><pre data-k="json" style="max-height:320px;overflow:auto;font:11px monospace;background:#111;padding:6px"></pre></details>
</div>`
    const q = <T extends HTMLElement>(k: string) => el.querySelector(`[data-k="${k}"]`) as T
    const text = q<HTMLTextAreaElement>('text'), buttons = q<HTMLTextAreaElement>('buttons'), out = q<HTMLInputElement>('outlines')
    effect(() => { if (document.activeElement !== text) text.value = preview.formText.value })
    effect(() => { if (document.activeElement !== buttons) buttons.value = preview.formButtons.value.join('\n') })
    text.addEventListener('input', () => { preview.formText.value = text.value })
    buttons.addEventListener('input', () => { preview.formButtons.value = buttons.value.split('\n') })
    out.addEventListener('change', () => { preview.outlines.value = out.checked })
    const issues = preview.issues()
    q('issues').innerHTML = issues.length
        ? issues.map((i) => `<li style="color:${i.level === 'error' ? '#f77' : '#fd6'}"><code>${i.rule}</code> ${i.path}：${i.message}</li>`).join('')
        : '<li style="color:#8f8">没有问题</li>'
    q('json').textContent = JSON.stringify(preview.compiled(), null, 1)
}
export { ServerPagesPreview } from './serverPages.js'
