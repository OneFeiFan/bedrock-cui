/**
 * 浏览器预览：完全按排版引擎的结果画（不用 CSS 布局去近似锚点），所以预览里看到的位置就是引擎算的位置。
 *
 *   mountPreview(el, { root, textures, viewport, scale })
 *     · 数据：表单正文、表单按钮文字、标题都是信号（可在开发面板里改），改了自动重排重绘
 *     · 交互：鼠标悬停 / 按下按「最上层的按钮」判定，驱动按钮的三种状态；点击调用 onPress / onFormButton
 *     · 贴图：像素风缩放；九宫格用 border-image；keep_ratio 按引擎算出的实际绘制矩形画
 */
import { finalize, Panel, type Element } from '../core/element.js'
import { walk, type RNode } from '../core/node.js'
import { effect, signal, type Signal } from '../core/reactivity.js'
import { drawOrder, layout, type Box, type Rect, type TextureInfo } from '../layout/engine.js'
import { compileNamespace } from '../mc/compile.js'
import type { LintIssue } from '../mc/lint.js'
import { GLYPH_HEIGHT, LINE_HEIGHT, boldExtra, charWidth, usesUnifont } from '../font/metrics.js'
import { BEDROCK_COLORS, PLAIN, parseRich, type TextStyle } from '../font/rich.js'
import { drawText, loadPixelFonts, type PixelFonts } from './pixelFont.js'

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
    title: Signal<string>
    outlines: Signal<boolean>
    /** 当前排版结果（测试 / 调试用） */
    boxes(): Box[]
    issues(): LintIssue[]
    compiled(namespace?: string): Record<string, unknown>
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
function lineHtml(line: string, base: string, start: TextStyle, px: number, unifont: boolean): { html: string, end: TextStyle } {
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
    const viewport = options.viewport ?? [320, 210]
    const scale = options.scale ?? 3
    const formText = options.formText ?? signal('')
    const formButtons = options.formButtons ?? signal<string[]>([])
    const title = options.title ?? signal('')
    const outlines = options.outlines ?? signal(false)
    const hover = signal<string | undefined>(undefined)
    const pressed = signal<string | undefined>(undefined)
    const textures = options.textures ?? {}
    const pixel = signal<PixelFonts | undefined>(undefined)
    if (options.fonts) void loadPixelFonts(options.fonts).then((f) => { if (f.unifont || f.ascii) pixel.value = f })
    const rootEl = (): Element => (typeof options.root === 'function' ? (options.root as () => Element)() : options.root)
    let nodes: RNode[] = []
    let toggleByName = new Map<string, RNode>()
    /**
     * 单选组里**被点的那个开关**的名字（真机：同序号的开关不会一起选中，只有被点的那个选中）；
     * 还没点过时，序号 = 初始选中序号的开关算选中。非单选开关单独记状态。
     */
    const groups = signal<Record<string, string>>({})
    const flags = signal<Record<string, boolean>>({})
    const tree = (): RNode[] => {
        nodes = finalize(rootEl())
        toggleByName = new Map()
        walk(nodes, (n) => { if (n.type === 'toggle') toggleByName.set(n.name, n) })
        return nodes
    }
    const checked = (n: RNode): boolean => {
        if (n.props.radio === false) return flags.value[n.name] ?? Boolean(n.props.defaultState)
        const picked = groups.value[n.props.group]
        return picked !== undefined ? picked === n.name : (n.props.defaultSelected ?? 0) === n.props.index
    }
    let current: Box[] = []

    const screen = document.createElement('div')
    Object.assign(screen.style, {
        position: 'relative', width: `${viewport[0] * scale}px`, height: `${viewport[1] * scale}px`, overflow: 'hidden',
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
        return ''
    }

    const S = (v: number) => `${v * scale}px`
    const clipPath = (b: Box, area: Rect) => {
        if (!b.clip) return ''
        const c = b.clip
        const top = Math.max(0, c.y - area.y), left = Math.max(0, c.x - area.x)
        const right = Math.max(0, area.x + area.w - (c.x + c.w)), bottom = Math.max(0, area.y + area.h - (c.y + c.h))
        return `inset(${S(top)} ${S(right)} ${S(bottom)} ${S(left)})`
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
            if (!t) {
                Object.assign(d.style, { background: 'repeating-linear-gradient(45deg,#f0f 0 4px,#000 4px 8px)', opacity: '0.6' })
                d.title = `缺贴图：${b.texture}`
            } else if (b.nineslice !== undefined && !degenerate(b, t)) {
                // 切图用贴图像素（高清贴图 = 边宽 × 像素 / base_size），画宽用界面像素
                const [l, tp, r, bt] = b.nineslice
                const [sl, st, sr, sb] = b.slice ?? b.nineslice
                Object.assign(d.style, { borderStyle: 'solid', borderWidth: `${S(tp)} ${S(r)} ${S(bt)} ${S(l)}`, borderImage: `url("${t.url}") ${st} ${sr} ${sb} ${sl} fill stretch`, boxSizing: 'border-box' })
            } else {
                Object.assign(d.style, { backgroundImage: `url("${t.url}")`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' })
            }
            if (b.clipRatio !== undefined && n.props.clipDirection) {
                const k = Math.max(0, Math.min(1, b.clipRatio))
                const dir = n.props.clipDirection
                const ins = dir === 'left' ? `0 0 0 ${k * 100}%` : dir === 'right' ? `0 ${k * 100}% 0 0` : dir === 'up' ? `${k * 100}% 0 0 0` : dir === 'down' ? `0 0 ${k * 100}% 0` : `${k * 50}%`
                d.style.clipPath = `inset(${ins})`
            }
        } else if (n.type === 'label' && pixel.value) {
            // 像素字体：照游戏画（画布按文字实际宽度，可能比控件宽——与游戏一样不裁剪）
            const canvas = document.createElement('canvas')
            const lines = b.lines ?? []
            const ok = drawText(canvas, pixel.value, {
                lines, color: (n.props.color ?? [1, 1, 1]) as [number, number, number], shadow: !!n.props.shadow,
                unifont: usesUnifont(lines.join('\n')), align: n.props.align ?? 'left', width: b.rect.w, scale, fontScale: n.props.fontScale ?? 1,
            })
            if (ok) {
                Object.assign(canvas.style, { width: `${canvas.width}px`, height: `${canvas.height}px`, imageRendering: 'pixelated', display: 'block' })
                d.style.width = `${canvas.width}px`; d.style.height = `${canvas.height}px`
                d.appendChild(canvas)
            }
        } else if (n.type === 'label') {
            const fs = (n.props.fontScale ?? 1) * scale
            Object.assign(d.style, {
                fontSize: `${GLYPH_HEIGHT * fs}px`, lineHeight: `${LINE_HEIGHT * fs}px`, whiteSpace: 'pre', textAlign: n.props.align ?? 'left',
                textShadow: n.props.shadow ? `${fs}px ${fs}px 0 rgba(0,0,0,0.75)` : 'none', overflow: 'visible',
            })
            // 样式延续到下一行（与游戏里一段文字被折成多行时一致；预折行的每行开头也补了样式码）
            let st: TextStyle = PLAIN
            const uni = usesUnifont((b.lines ?? []).join('\n'))
            d.innerHTML = (b.lines ?? []).map((l) => { const r = lineHtml(l, rgb(n.props.color), st, fs, uni); st = r.end; return `<div>${r.html}</div>` }).join('')
        } else if (!outlines.value) {
            return undefined
        }
        if (outlines.value) d.style.outline = `1px solid ${n.type === 'button' ? '#ff0' : n.type === 'toggle' ? '#f0f' : n.type === 'collection_item' ? '#0ff' : 'rgba(255,80,80,0.7)'}`
        return d
    }

    const render = effect(() => {
        // 读信号 → 建立依赖
        void formText.value; void formButtons.value; void title.value; void outlines.value; void groups.value; void flags.value; void pixel.value
        const st = { hover: hover.value, pressed: pressed.value }
        current = layout(tree(), {
            viewport, data: data as never, translate: options.translate,
            textures: (p) => textures[p],
            buttonState: (path) => (st.pressed === path ? 'pressed' : st.hover === path ? 'hover' : 'default'),
            toggleChecked: checked,
        })
        screen.replaceChildren()
        for (const b of drawOrder(current)) { const d = draw(b); if (d) screen.appendChild(d) }
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
        formText, formButtons, title, outlines,
        boxes: () => current,
        issues: () => compileNamespace('preview', { root: rootEl() }, { textures: (p) => textures[p] }).issues,
        compiled: (ns = 'preview') => compileNamespace(ns, { root: rootEl() }, { textures: (p) => textures[p] }).json,
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
