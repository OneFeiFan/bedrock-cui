/**
 * 排版引擎：按 JSON UI 的规则算出每个控件的位置与尺寸（纯函数；预览与单测共用）。
 *
 *   位置   = 父矩形上的 anchor_from 点 + offset − 自身的 anchor_to 点（缺省都是 center）
 *   尺寸   = 见 units.ts（default / % / %c / %cm / %x / %y / fill / 混合表达式）
 *   stack  = 沿排列方向依次摆放，交叉方向按锚点；visible=false 的子控件不占位置；fill 平分剩余空间
 *   grid   = 格子 = 网格尺寸 / 行列数；子控件按 gridPos（缺省按序号行优先）落格，在格子里按锚点
 *   layer  = 相对父控件累加；同层按文档顺序
 *   clip   = clips_children：子孙裁剪到本控件矩形
 *   image  = keep_ratio 缺省 true：按贴图宽高比缩到矩形内并居中（九宫格贴图例外，直接拉伸）
 *   label  = default 尺寸取文字尺寸；宽度确定、高度 default 时按宽度折行
 */
import { asBool, evalExpr, isExpr, type EvalEnv, type Expr, type Source, type Value } from '../core/expr.js'
import type { Anchor, RNode } from '../core/node.js'
import { LINE_HEIGHT, measureText } from '../font/metrics.js'
import { evalOffset, evalTerms, parseSize, usesChildren, usesSelf, type SizeSpec } from './units.js'

export interface Rect { x: number, y: number, w: number, h: number }

export interface TextureInfo {
    /** 贴图像素尺寸（keep_ratio 要用；不知道时按拉伸画，并由 lint 提示） */
    size?: [number, number]
    /** 九宫格（贴图的 .json 里声明的 nineslice_size） */
    nineslice?: number | [number, number, number, number]
}

/** 求值作用域：所在的集合项（FormButton 里读 #form_button_text 用） */
export interface Scope { collection?: { name: string, index: number } }

export interface LayoutEnv {
    viewport: [number, number]
    textures?: (path: string) => TextureInfo | undefined
    /** 读数据来源（预览里接信号；单测里给固定值） */
    data?: (name: string, source: Source, scope: Scope) => Value
    /** 按钮 / 开关当前的鼠标状态（预览里由鼠标决定） */
    buttonState?: (path: string) => 'default' | 'hover' | 'pressed'
    /** 开关是否选中（预览里由开关组状态决定） */
    toggleChecked?: (n: RNode) => boolean
    translate?: (key: string) => string
}

export interface Box {
    node: RNode
    rect: Rect
    z: number
    order: number
    clip?: Rect
    /** 按钮 / 开关状态子树里的控件（状态名） */
    state?: string
    scope: Scope
    // image
    texture?: string
    /** 实际画出贴图的矩形（keep_ratio 之后） */
    draw?: Rect
    nineslice?: number | [number, number, number, number]
    clipRatio?: number
    // label
    lines?: string[]
    children: Box[]
}

const ANCHOR_POINT: Record<Anchor, [number, number]> = {
    top_left: [0, 0], top_middle: [0.5, 0], top_right: [1, 0],
    left_middle: [0, 0.5], center: [0.5, 0.5], right_middle: [1, 0.5],
    bottom_left: [0, 1], bottom_middle: [0.5, 1], bottom_right: [1, 1],
}

class Engine {
    private order = 0
    constructor(private readonly env: LayoutEnv) { }

    private evalEnv(scope: Scope): EvalEnv {
        return {
            ref: (name, source) => this.env.data?.(name, source, scope) ?? '',
            variable: () => undefined,
        }
    }

    value<T extends Value>(v: T | Expr | undefined, scope: Scope, fallback: T): T {
        if (v === undefined) return fallback
        return (isExpr(v) ? evalExpr(v, this.evalEnv(scope)) : v) as T
    }

    visible(n: RNode, scope: Scope): boolean {
        const v = n.props.visible
        if (v === undefined) return true
        return isExpr(v) ? asBool(evalExpr(v, this.evalEnv(scope))) : Boolean(v)
    }

    childScope(n: RNode, scope: Scope): Scope {
        return n.type === 'collection_item' ? { ...scope, collection: { name: n.props.collection, index: n.props.index } } : scope
    }

    labelText(n: RNode, scope: Scope): string {
        const t = String(this.value(n.props.text, scope, ''))
        return n.props.localize && this.env.translate ? this.env.translate(t) : t
    }

    /** 当前显示的状态名（按钮：default / hover / pressed；开关：unchecked / checked / *_hover，悬停态没内容时用普通态） */
    slotName(n: RNode): string | undefined {
        if (!n.slots) return undefined
        const mouse = this.env.buttonState?.(n.path) ?? 'default'
        if (n.type === 'button') return mouse === 'default' || n.slots[mouse]?.length ? mouse : 'default'
        if (n.type === 'toggle') {
            const base = this.env.toggleChecked?.(n) ? 'checked' : 'unchecked'
            return mouse !== 'default' && n.slots[`${base}_hover`]?.length ? `${base}_hover` : base
        }
        return undefined
    }

    /** 子控件（含按钮 / 开关当前状态的子树） */
    kids(n: RNode): RNode[] {
        const st = this.slotName(n)
        return st ? [...(n.slots![st] ?? []), ...n.children] : n.children
    }

    /** 自身尺寸（需要时会量子控件） */
    size(n: RNode, pw: number, ph: number, scope: Scope, inStack?: 'vertical' | 'horizontal'): [number, number] {
        const sw = parseSize(n.props.size?.[0]), sh = parseSize(n.props.size?.[1])
        const fill = (s: SizeSpec) => (s.kind === 'fill' ? { kind: 'expr', terms: [{ unit: '%', value: 100 }] } as SizeSpec : s)
        let w = 0, h = 0
        // label 的 default：文字尺寸（宽度确定时按宽度折行）
        if (n.type === 'label') {
            const scale = n.props.fontScale ?? 1
            const text = this.labelText(n, scope)
            const fixedW = sw.kind === 'default' ? undefined : this.axis(fill(sw), pw, 0, 0, 0, 0)
            const m = measureText(text, scale, fixedW ?? Infinity)
            w = fixedW ?? m.width
            h = sh.kind === 'default' ? m.height : this.axis(fill(sh), ph, 0, 0, w, 0)
            return [w, h]
        }
        const def = { kind: 'expr', terms: [{ unit: '%', value: 100 }] } as SizeSpec
        const SW = sw.kind === 'default' ? def : fill(sw), SH = sh.kind === 'default' ? def : fill(sh)
        // 先算不依赖子控件的部分（%x / %y 依赖另一轴：先算没有依赖的那一轴）
        const needKids = usesChildren(SW) || usesChildren(SH)
        const first = (cw = 0, ch = 0, cmw = 0, cmh = 0) => {
            if (usesSelf(SW, '%y') && !usesSelf(SH, '%x')) {
                h = this.axis(SH, ph, ch, cmh, 0, 0)
                w = this.axis(SW, pw, cw, cmw, 0, h)
            } else {
                w = this.axis(SW, pw, cw, cmw, 0, 0)
                h = this.axis(SH, ph, ch, cmh, w, 0)
            }
        }
        first()
        if (needKids) {
            const [cw, ch, cmw, cmh] = this.extent(n, w, h, scope)
            first(cw, ch, cmw, cmh)
        }
        void inStack
        return [Math.max(0, w), Math.max(0, h)]
    }

    private axis(s: SizeSpec, parent: number, children: number, childrenMax: number, selfX: number, selfY: number): number {
        if (s.kind !== 'expr') return parent
        return evalTerms(s.terms, { parent, children, childrenMax, sibling: parent, selfX, selfY })
    }

    /** 子控件的范围：[总宽, 总高, 最大宽, 最大高]（stack 沿方向求和） */
    private extent(n: RNode, w: number, h: number, scope: Scope): [number, number, number, number] {
        const s = this.childScope(n, scope)
        const kids = this.kids(n).filter((c) => this.visible(c, s))
        const sizes = kids.map((c) => this.size(c, w, h, s))
        const maxW = Math.max(0, ...sizes.map((z) => z[0])), maxH = Math.max(0, ...sizes.map((z) => z[1]))
        if (n.type === 'stack') {
            const vertical = (n.props.orientation ?? 'vertical') === 'vertical'
            const sum = sizes.reduce((a, z) => a + (vertical ? z[1] : z[0]), 0)
            return vertical ? [maxW, sum, maxW, maxH] : [sum, maxH, maxW, maxH]
        }
        return [maxW, maxH, maxW, maxH]
    }

    /** 在父矩形里定位一个控件并排它的子控件 */
    place(n: RNode, parent: Rect, scope: Scope, z: number, clip: Rect | undefined, size?: [number, number]): Box | undefined {
        if (!this.visible(n, scope)) return undefined
        const [w, h] = size ?? this.size(n, parent.w, parent.h, scope)
        const from = ANCHOR_POINT[(n.props.anchorFrom ?? n.props.anchor ?? 'center') as Anchor]
        const to = ANCHOR_POINT[(n.props.anchorTo ?? n.props.anchor ?? 'center') as Anchor]
        const ox = evalOffset(n.props.offset?.[0], parent.w), oy = evalOffset(n.props.offset?.[1], parent.h)
        const rect = { x: parent.x + from[0] * parent.w + ox - to[0] * w, y: parent.y + from[1] * parent.h + oy - to[1] * h, w, h }
        return this.finish(n, rect, scope, z, clip)
    }

    finish(n: RNode, rect: Rect, scope: Scope, z: number, clip: Rect | undefined): Box {
        const myZ = z + (n.props.layer ?? 0)
        const box: Box = { node: n, rect, z: myZ, order: this.order++, clip, scope, children: [] }
        const childClip = n.props.clip ? intersect(clip, rect) : clip
        const s = this.childScope(n, scope)
        if (n.type === 'image') {
            const tex = String(this.value(n.props.texture, scope, ''))
            const info = this.env.textures?.(tex)
            box.texture = tex
            box.nineslice = n.props.nineslice ?? info?.nineslice
            box.draw = rect
            const keep = n.props.keepRatio ?? true
            if (keep && !box.nineslice && info?.size) {
                const k = Math.min(rect.w / info.size[0], rect.h / info.size[1])
                const dw = info.size[0] * k, dh = info.size[1] * k
                box.draw = { x: rect.x + (rect.w - dw) / 2, y: rect.y + (rect.h - dh) / 2, w: dw, h: dh }
            }
            if (n.props.clipRatio !== undefined) box.clipRatio = Number(this.value(n.props.clipRatio, scope, 0))
        }
        if (n.type === 'label') {
            const sw = parseSize(n.props.size?.[0])
            box.lines = measureText(this.labelText(n, scope), n.props.fontScale ?? 1, sw.kind === 'default' ? Infinity : rect.w).lines
        }
        // 子控件
        const kids = this.kids(n)
        const stateOf = (c: RNode) => (n.slots && !n.children.includes(c) ? this.slotName(n) : undefined)
        if (n.type === 'stack') {
            const vertical = (n.props.orientation ?? 'vertical') === 'vertical'
            const visibleKids = kids.filter((c) => this.visible(c, s))
            const sizes = visibleKids.map((c) => (parseSize(c.props.size?.[vertical ? 1 : 0]).kind === 'fill' ? undefined : this.size(c, rect.w, rect.h, s)))
            const used = sizes.reduce((a, z) => a + (z ? (vertical ? z[1] : z[0]) : 0), 0)
            const fills = sizes.filter((z) => !z).length
            const share = fills ? Math.max(0, (vertical ? rect.h : rect.w) - used) / fills : 0
            let cursor = 0
            visibleKids.forEach((c, i) => {
                let sz = sizes[i]
                if (!sz) {
                    const other = this.size(c, rect.w, rect.h, s)
                    sz = vertical ? [other[0], share] : [share, other[1]]
                }
                // 交叉方向按锚点，排列方向按游标
                // 交叉方向的锚点缺省 center（与其它控件一致）；排列方向由游标决定，锚点不起作用
                const from = ANCHOR_POINT[(c.props.anchorFrom ?? c.props.anchor ?? 'center') as Anchor]
                const to = ANCHOR_POINT[(c.props.anchorTo ?? c.props.anchor ?? 'center') as Anchor]
                const ox = evalOffset(c.props.offset?.[0], rect.w), oy = evalOffset(c.props.offset?.[1], rect.h)
                const r = vertical
                    ? { x: rect.x + from[0] * rect.w + ox - to[0] * sz[0], y: rect.y + cursor + oy, w: sz[0], h: sz[1] }
                    : { x: rect.x + cursor + ox, y: rect.y + from[1] * rect.h + oy - to[1] * sz[1], w: sz[0], h: sz[1] }
                cursor += vertical ? sz[1] : sz[0]
                const b = this.finish(c, r, s, myZ, childClip)
                b.state = stateOf(c)
                box.children.push(b)
            })
            return box
        }
        if (n.type === 'grid') {
            const [cols, rows] = n.props.dims as [number, number]
            const cw = rect.w / cols, ch = rect.h / rows
            kids.forEach((c, i) => {
                const [col, row] = (c.props.gridPos as [number, number] | undefined) ?? [i % cols, Math.floor(i / cols)]
                const cell = { x: rect.x + col * cw, y: rect.y + row * ch, w: cw, h: ch }
                const b = this.place(c, cell, s, myZ, childClip)
                if (b) { b.state = stateOf(c); box.children.push(b) }
            })
            return box
        }
        for (const c of kids) {
            const b = this.place(c, rect, s, myZ, childClip)
            if (b) { b.state = stateOf(c); box.children.push(b) }
        }
        return box
    }
}

function intersect(a: Rect | undefined, b: Rect): Rect {
    if (!a) return b
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y)
    return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) }
}

/** 排版：根控件放在视口里 */
export function layout(roots: RNode[], env: LayoutEnv): Box[] {
    const e = new Engine(env)
    const vp = { x: 0, y: 0, w: env.viewport[0], h: env.viewport[1] }
    return roots.map((r) => e.place(r, vp, {}, 0, undefined)).filter((b): b is Box => !!b)
}

/** 按绘制顺序（z，再文档顺序）展平 */
export function drawOrder(boxes: Box[]): Box[] {
    const out: Box[] = []
    const visit = (b: Box) => { out.push(b); b.children.forEach(visit) }
    boxes.forEach(visit)
    return out.sort((a, b) => a.z - b.z || a.order - b.order)
}

/** 找一个路径的控件（测试用） */
export function findBox(boxes: Box[], pathOrName: string): Box | undefined {
    for (const b of drawOrder(boxes)) if (b.node.path === pathOrName || b.node.path.endsWith(`/${pathOrName}`) || b.node.name === pathOrName) return b
    return undefined
}

export { LINE_HEIGHT }
