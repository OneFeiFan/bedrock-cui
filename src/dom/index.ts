/**
 * bedrock-cui/dom：把控件树渲染成 HTML（网页输出目标）。文字交给浏览器排版——可以选中、搜索、自然折行。
 *
 *   import { Column, Label } from 'bedrock-cui'
 *   import { Link, Html, renderHtml } from 'bedrock-cui/dom'
 *   const nav = new Column().setGap(4).add(new Link('guide/quick-start.html', '快速上手'), new Html('<p>正文</p>'))
 *   const html = renderHtml(nav)
 *
 * 映射：Row / Column / Stack / Scroll → flex（间距、主轴分布、交叉轴对齐、伸展）；尺寸 → CSS（像素、百分比、calc()、fit-content）；
 * Panel 的子控件按锚点与偏移绝对定位（与游戏里同义）；Label → 文字，§ 格式码 → 颜色、粗体、斜体；Image → <img>；层级 → z-index。
 * Link、Html 是网页专用的元素：编译成 JSON UI 时静态检查报错（web-only）。
 */
import { Column, Element, Image, Label, Panel, Row, Scroll, Stack } from '../core/element.js'
import { Align, Justify } from '../core/values.js'
import { isExpr } from '../core/expr.js'
import { BEDROCK_COLORS } from '../font/rich.js'

// ───────────── 网页专用的元素 ─────────────

/** 链接（网页专用）。内容是文字或子控件 */
export class Link extends Panel {
    constructor(href: string, text?: string) {
        super()
        this.props.web = { tag: 'a', href }
        if (text !== undefined) this.add(new Label(text))
    }
    /** 链接地址 */
    get href(): string { return this.props.web.href }
    set href(v: string) { this.props.web = { ...this.props.web, href: v } }
    setHref(v: string): this { this.href = v; return this }
}

/** 一段原样插入的 HTML（网页专用），例如 Markdown 渲染出的正文 */
export class Html extends Panel {
    constructor(html: string, tag = 'div') {
        super()
        this.props.web = { html, tag }
    }
    get html(): string { return this.props.web.html }
    set html(v: string) { this.props.web = { ...this.props.web, html: v } }
    setHtml(v: string): this { this.html = v; return this }
}

// ───────────── 渲染 ─────────────

export interface RenderHtmlOptions {
    /** 贴图路径 → 图片地址（缺省：<路径>.png） */
    assetUrl?: (texture: string) => string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 尺寸（JSON UI 的写法）→ CSS。flexMain = 在弹性容器的主轴上（fill 用 flex 表达） */
export function cssLength(v: unknown): string | undefined {
    if (v === undefined || v === null || v === 'default') return undefined
    if (typeof v === 'number') return `${v}px`
    const s = String(v).trim()
    if (s === 'fill') return undefined
    if (/%c/.test(s)) return 'fit-content'
    if (/%(sm|x|y)/.test(s)) return undefined
    const terms = s.match(/[+-]?\s*\d+(?:\.\d+)?\s*(?:%|px)?/g)
    if (!terms) return undefined
    const parts = terms.map((t) => t.replace(/\s+/g, '')).map((t) => (/(%|px)$/.test(t) ? t : `${t}px`))
    if (parts.length === 1) return parts[0].replace(/^\+/, '')
    return `calc(${parts.map((p, i) => (i === 0 ? p.replace(/^\+/, '') : p.startsWith('-') ? `- ${p.slice(1)}` : `+ ${p.replace(/^\+/, '')}`)).join(' ')})`
}

/** 锚点名 → [横向位置, 纵向位置]（0 / 50 / 100） */
function anchorPoint(name: string | undefined): [number, number] {
    const n = name ?? 'center'
    const x = /left/.test(n) ? 0 : /right/.test(n) ? 100 : 50
    const y = /top/.test(n) ? 0 : /bottom/.test(n) ? 100 : 50
    return [x, y]
}

/** § 格式码 → HTML（颜色、粗体、斜体；§r 复原） */
export function formatCodesToHtml(text: string): string {
    let out = '', open = 0, color: string | undefined, bold = false, italic = false
    const close = () => { out += '</span>'.repeat(open); open = 0 }
    const reopen = () => {
        const st = [color ? `color:${color}` : '', bold ? 'font-weight:bold' : '', italic ? 'font-style:italic' : ''].filter(Boolean).join(';')
        if (st) { out += `<span style="${st}">`; open++ }
    }
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '§' && i + 1 < text.length) {
            const c = text[++i].toLowerCase()
            if (BEDROCK_COLORS[c]) { color = BEDROCK_COLORS[c]; bold = false; italic = false }
            else if (c === 'l') bold = true
            else if (c === 'o') italic = true
            else if (c === 'r') { color = undefined; bold = false; italic = false }
            else continue
            close(); reopen()
            continue
        }
        out += text[i] === '\n' ? '<br>' : esc(text[i])
    }
    close()
    return out
}

const JUSTIFY: Record<string, string> = { [Justify.START]: 'flex-start', [Justify.CENTER]: 'center', [Justify.END]: 'flex-end', [Justify.SPACE_BETWEEN]: 'space-between' }
const ALIGN: Record<string, string> = { [Align.START]: 'flex-start', [Align.CENTER]: 'center', [Align.END]: 'flex-end', [Align.STRETCH]: 'stretch' }

/** 渲染成 HTML 字符串 */
export function renderHtml(el: Element, options: RenderHtmlOptions = {}): string {
    return render(el, undefined, options)
}

function render(el: Element, parent: Element | undefined, options: RenderHtmlOptions): string {
    const p = el.props
    if (p.visible === false) return ''
    const style: string[] = []
    const css = (k: string, v: string | undefined) => { if (v !== undefined) style.push(`${k}:${v}`) }

    // 尺寸
    const [w, h] = (p.size as unknown[] | undefined) ?? []
    const inFlex = parent instanceof Row || parent instanceof Column || parent instanceof Stack || parent instanceof Scroll
    const parentRow = parent instanceof Row || (parent instanceof Stack && parent.props.orientation === 'horizontal')
    if (inFlex && (p.grow || (parentRow ? w : h) === 'fill')) css('flex', '1 1 0')
    css('width', cssLength(w)); css('height', cssLength(h))
    const [minW, minH] = (p.minSize as unknown[] | undefined) ?? []
    const [maxW, maxH] = (p.maxSize as unknown[] | undefined) ?? []
    css('min-width', cssLength(minW)); css('min-height', cssLength(minH)); css('max-width', cssLength(maxW)); css('max-height', cssLength(maxH))

    // 位置：Panel 的子控件按锚点与偏移绝对定位
    if (parent instanceof Panel && !(parent instanceof Link) && !(parent instanceof Html) && !inFlex) {
        const from = anchorPoint(p.anchorFrom ?? p.anchor), to = anchorPoint(p.anchorTo ?? p.anchor)
        const [ox, oy] = ((p.offset as unknown[] | undefined) ?? [0, 0]).map((v) => cssLength(v) ?? '0px')
        css('position', 'absolute')
        css('left', `calc(${from[0]}% + ${ox})`); css('top', `calc(${from[1]}% + ${oy})`)
        if (to[0] || to[1]) css('transform', `translate(-${to[0]}%, -${to[1]}%)`)
    } else if (p.offset) {
        const [ox, oy] = (p.offset as unknown[]).map((v) => cssLength(v) ?? '0px')
        css('position', 'relative'); css('left', ox); css('top', oy)
    }
    if (p.layer) css('z-index', String(p.layer))
    if (typeof p.alpha === 'number') css('opacity', String(p.alpha))
    if (p.clip) css('overflow', 'hidden')
    if (p.padding) {
        const [l, t, r, b] = Array.isArray(p.padding) ? p.padding : [p.padding, p.padding, p.padding, p.padding]
        css('padding', `${t}px ${r}px ${b}px ${l}px`); css('box-sizing', 'border-box')
    }

    // 弹性容器
    if (el instanceof Row || el instanceof Column || el instanceof Scroll || el instanceof Stack) {
        const row = el instanceof Row || (el instanceof Stack && el.props.orientation === 'horizontal')
        css('display', 'flex'); css('flex-direction', row ? 'row' : 'column')
        const flex = el as unknown as { gap?: number, justify?: string, align?: string }
        if (flex.gap) css('gap', `${flex.gap}px`)
        if (flex.justify) css('justify-content', JUSTIFY[flex.justify])
        if (flex.align) css('align-items', ALIGN[flex.align])
        if (el instanceof Scroll) css('overflow-y', 'auto')
    } else if (el instanceof Panel && !(el instanceof Link) && el.children.some((c) => !(c instanceof Html))) {
        css('position', style.some((s) => s.startsWith('position:')) ? undefined : 'relative')
    }

    const cls = p.className ? ` class="${esc(String(p.className))}"` : ''
    const name = el.name ? ` data-cui="${esc(el.name)}"` : ''
    const attrs = () => `${cls}${name}${style.length ? ` style="${style.join(';')}"` : ''}`
    const kids = () => el.children.map((c) => render(c, el, options)).join('')

    const web = p.web as { tag?: string, href?: string, html?: string } | undefined
    if (web?.html !== undefined) return `<${web.tag ?? 'div'}${attrs()}>${web.html}</${web.tag ?? 'div'}>`
    if (web?.tag === 'a') return `<a href="${esc(web.href ?? '#')}"${attrs()}>${kids()}</a>`
    if (el instanceof Label) {
        if (p.color) css('color', `rgb(${(p.color as number[]).map((c) => Math.round(c * 255)).join(',')})`)
        if (p.fontScale && p.fontScale !== 1) css('font-size', `${p.fontScale}em`)
        if (p.shadow) css('text-shadow', '0.08em 0.08em 0 rgba(0,0,0,0.35)')
        if (p.align) css('text-align', String(p.align))
        const text = isExpr(p.text) ? '' : formatCodesToHtml(String(p.text ?? ''))
        return `<span${attrs()}>${text}</span>`
    }
    if (el instanceof Image) {
        const tex = typeof p.texture === 'string' ? p.texture : (p.texture as { path?: string } | undefined)?.path
        if (!tex) return `<span${attrs()}></span>`
        css('object-fit', p.keepRatio === false ? 'fill' : 'contain')
        const src = options.assetUrl ? options.assetUrl(tex) : `${tex}.png`
        return `<img src="${esc(src)}" alt=""${attrs()}>${kids() ? `<span>${kids()}</span>` : ''}`
    }
    return `<div${attrs()}>${kids()}</div>`
}
