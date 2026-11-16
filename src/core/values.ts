/**
 * 面向对象 API 的值类型：尺寸、锚点、偏移、颜色、内边距、贴图、文字样式。
 *
 *   const card = new Panel()
 *       .setSize(Size.of(Length.pct(90), Length.children().plus(8)))
 *       .setMaxSize(Size.px(320, 240))
 *       .setAnchor(Anchor.CENTER)
 *       .setPadding(Insets.all(4))
 *
 * 值都是**不可变**的：plus() / withWidth() 之类返回新对象，可以放心地在多处共用（例如一个 TextStyle 给全书用）。
 * 内部仍存成 JSON UI 的写法（数字、'100% - 6px' 之类），编译器与排版引擎不变——值类型只负责「写的时候有类型、读的时候有对象」。
 */
import type { Anchor as AnchorName, RGB } from './node.js'

/** 长度可以直接写数字（= 像素） */
export type LengthLike = Length | number

/**
 * 一个方向上的长度：像素、百分比、按子控件、填充、缺省，可以相加减。
 * 对应 JSON UI 的尺寸表达式（'100% - 6px'、'100%c + 8px'、'fill'、'default'）。
 */
export class Length {
    private constructor(private readonly expr: string | number) { }

    /** 像素 */
    static px(n: number): Length { return new Length(n) }
    /** 父控件的百分比 */
    static pct(n = 100): Length { return new Length(`${n}%`) }
    /** 子控件之和（stack 里两个方向都是求和——真机；要贴合最大的子控件用 largestChild） */
    static children(pct = 100): Length { return new Length(`${pct}%c`) }
    /** 最大的子控件 */
    static largestChild(pct = 100): Length { return new Length(`${pct}%cm`) }
    /** 自身宽度的百分比（用于高度：保持宽高比） */
    static ofOwnWidth(pct = 100): Length { return new Length(`${pct}%x`) }
    /** 自身高度的百分比（用于宽度） */
    static ofOwnHeight(pct = 100): Length { return new Length(`${pct}%y`) }
    /** 在 stack / Row / Column 里平分剩余空间 */
    static fill(): Length { return new Length('fill') }
    /** 缺省（文字 = 文字尺寸；其它 = 父控件大小） */
    static auto(): Length { return new Length('default') }

    /** 由数字（像素）或 JSON UI 写法得到 Length */
    static from(v: LengthLike | string): Length {
        if (v instanceof Length) return v
        return new Length(v)
    }

    plus(v: LengthLike): Length { return this.combine('+', v) }
    minus(v: LengthLike): Length { return this.combine('-', v) }

    private combine(op: '+' | '-', v: LengthLike): Length {
        if (this.expr === 'fill' || this.expr === 'default') throw new Error(`Length.${this.expr} 不能参与加减`)
        const other = Length.from(v).term()
        const self = typeof this.expr === 'number' ? `${this.expr}px` : this.expr
        return new Length(`${self} ${op} ${other}`)
    }

    private term(): string {
        if (typeof this.expr === 'number') return `${this.expr}px`
        if (this.expr === 'fill' || this.expr === 'default') throw new Error(`Length.${this.expr} 不能参与加减`)
        return this.expr
    }

    /** 是否由子控件决定（%c / %cm / default） */
    get dependsOnContent(): boolean { return typeof this.expr === 'string' && (/%c/.test(this.expr) || this.expr === 'default') }
    get isFill(): boolean { return this.expr === 'fill' }
    get isAuto(): boolean { return this.expr === 'default' }

    /** JSON UI 写法 */
    toJSON(): number | string { return this.expr }
    toString(): string { return String(this.expr) }
}

/** 宽 × 高 */
export class Size {
    readonly width: Length
    readonly height: Length
    constructor(width: LengthLike, height: LengthLike) {
        this.width = Length.from(width)
        this.height = Length.from(height)
    }

    static of(width: LengthLike, height: LengthLike): Size { return new Size(width, height) }
    static px(width: number, height: number): Size { return new Size(width, height) }
    static square(n: LengthLike): Size { return new Size(n, n) }
    /** 铺满父控件 */
    static full(): Size { return new Size(Length.pct(100), Length.pct(100)) }
    /** 贴合子控件（可加内边距）：宽 = 最宽的子控件，高 = 最高的子控件 */
    static fitContent(pad = 0): Size {
        const l = Length.largestChild()
        return pad ? new Size(l.plus(pad * 2), l.plus(pad * 2)) : new Size(l, l)
    }
    static auto(): Size { return new Size(Length.auto(), Length.auto()) }

    /** 由 JSON 写法 [w, h] 得到 Size */
    static from(v: Size | [LengthLike | string, LengthLike | string]): Size {
        return v instanceof Size ? v : new Size(Length.from(v[0]), Length.from(v[1]))
    }

    withWidth(w: LengthLike): Size { return new Size(w, this.height) }
    withHeight(h: LengthLike): Size { return new Size(this.width, h) }

    toJSON(): [number | string, number | string] { return [this.width.toJSON(), this.height.toJSON()] }
}

/** 偏移 / 二维向量（分量可以是像素或百分比） */
export class Vec2 {
    readonly x: Length
    readonly y: Length
    constructor(x: LengthLike, y: LengthLike) { this.x = Length.from(x); this.y = Length.from(y) }
    static of(x: LengthLike, y: LengthLike): Vec2 { return new Vec2(x, y) }
    static readonly ZERO = new Vec2(0, 0)
    static from(v: Vec2 | [LengthLike | string, LengthLike | string]): Vec2 {
        return v instanceof Vec2 ? v : new Vec2(Length.from(v[0]), Length.from(v[1]))
    }
    toJSON(): [number | string, number | string] { return [this.x.toJSON(), this.y.toJSON()] }
}

/** 锚点（控件上的九个点） */
export class Anchor {
    private constructor(readonly json: AnchorName) { }
    static readonly TOP_LEFT = new Anchor('top_left')
    static readonly TOP_CENTER = new Anchor('top_middle')
    static readonly TOP_RIGHT = new Anchor('top_right')
    static readonly CENTER_LEFT = new Anchor('left_middle')
    static readonly CENTER = new Anchor('center')
    static readonly CENTER_RIGHT = new Anchor('right_middle')
    static readonly BOTTOM_LEFT = new Anchor('bottom_left')
    static readonly BOTTOM_CENTER = new Anchor('bottom_middle')
    static readonly BOTTOM_RIGHT = new Anchor('bottom_right')
    private static readonly ALL = [Anchor.TOP_LEFT, Anchor.TOP_CENTER, Anchor.TOP_RIGHT, Anchor.CENTER_LEFT, Anchor.CENTER, Anchor.CENTER_RIGHT, Anchor.BOTTOM_LEFT, Anchor.BOTTOM_CENTER, Anchor.BOTTOM_RIGHT]
    static from(v: Anchor | AnchorName): Anchor {
        if (v instanceof Anchor) return v
        const a = Anchor.ALL.find((x) => x.json === v)
        if (!a) throw new Error(`未知锚点：${v}`)
        return a
    }
    toJSON(): AnchorName { return this.json }
}

/** 颜色 */
export class Color {
    private constructor(readonly r: number, readonly g: number, readonly b: number) { }
    /** 0–255 */
    static rgb(r: number, g: number, b: number): Color { return new Color(r, g, b) }
    /** '#3d2108' 或 '3d2108' */
    static hex(hex: string): Color {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex)
        if (!m) throw new Error(`颜色写法不对：${hex}`)
        const n = parseInt(m[1], 16)
        return new Color((n >> 16) & 255, (n >> 8) & 255, n & 255)
    }
    /** 由 JSON UI 的 [0–1, 0–1, 0–1] 得到（无损：[0.27, 0.19, 0.11] 写回去还是这三个数，不会因取整变成 0.271） */
    static fromJSON(v: RGB): Color { return new Color(v[0] * 255, v[1] * 255, v[2] * 255) }
    static readonly WHITE = new Color(255, 255, 255)
    static readonly BLACK = new Color(0, 0, 0)
    /** JSON UI 写法：0–1 浮点（保留三位小数） */
    toJSON(): RGB { return [this.r, this.g, this.b].map((v) => Math.round((v / 255) * 1000) / 1000) as RGB }
    toString(): string { return `#${[this.r, this.g, this.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` }
}

/** 内边距（安全区） */
export class Insets {
    private constructor(readonly left: number, readonly top: number, readonly right: number, readonly bottom: number) { }
    static all(n: number): Insets { return new Insets(n, n, n, n) }
    static symmetric(horizontal: number, vertical: number): Insets { return new Insets(horizontal, vertical, horizontal, vertical) }
    static of(left: number, top: number, right: number, bottom: number): Insets { return new Insets(left, top, right, bottom) }
    static readonly NONE = new Insets(0, 0, 0, 0)
    static from(v: Insets | number | [number, number, number, number]): Insets {
        if (v instanceof Insets) return v
        return typeof v === 'number' ? Insets.all(v) : new Insets(...v)
    }
    toJSON(): [number, number, number, number] { return [this.left, this.top, this.right, this.bottom] }
}

/**
 * 贴图：路径 + 它的尺寸 / 九宫格信息。信息跟着贴图走（不用另外维护一张表）：
 * 用过的贴图会登记到 Texture.info()，编译时的静态检查与浏览器预览直接查这里。
 *
 *   const CELL = Texture.of('textures/ui/cell_image').withSize(10, 10).withBaseSize(5, 5).withNineslice(1)
 */
/** 内置纯白贴图的路径（Texture.SOLID） */
export const SOLID_TEXTURE = 'textures/bedrock_cui/solid'

export class Texture {
    private static readonly registry = new Map<string, TextureMeta>()

    private constructor(readonly path: string, private readonly meta: TextureMeta) {
        if (meta.size || meta.nineslice !== undefined || meta.baseSize) Texture.registry.set(path, meta)
    }

    static of(path: string): Texture { return new Texture(path, {}) }
    /**
     * 纯白贴图（bedrock-cui 内置，用到时构建自动写进资源包）：配合颜色画纯色矩形，例如底色、进度条。
     * 原版的 textures/ui/white 不是纯色：15×15，四周有 2 像素黑边（真机 1.52.0）
     */
    static readonly SOLID = new Texture(SOLID_TEXTURE, {})
    static from(v: Texture | string): Texture { return v instanceof Texture ? v : Texture.of(v) }

    /** 贴图像素尺寸 */
    withSize(w: number, h: number): Texture { return new Texture(this.path, { ...this.meta, size: [w, h] }) }
    /** 九宫格边宽（单位：base_size 的格） */
    withNineslice(n: number | [number, number, number, number]): Texture { return new Texture(this.path, { ...this.meta, nineslice: n }) }
    /** 逻辑尺寸（贴图 .json 的 base_size） */
    withBaseSize(w: number, h: number): Texture { return new Texture(this.path, { ...this.meta, baseSize: [w, h] }) }

    get size(): [number, number] | undefined { return this.meta.size }
    get nineslice(): number | [number, number, number, number] | undefined { return this.meta.nineslice }

    /** 登记过的贴图信息（静态检查、预览用） */
    static info(path: string): TextureMeta | undefined { return Texture.registry.get(path) }

    toJSON(): string { return this.path }
    toString(): string { return this.path }
}

export interface TextureMeta {
    size?: [number, number]
    nineslice?: number | [number, number, number, number]
    baseSize?: [number, number]
}

/** 文字对齐 */
export type TextAlign = 'left' | 'center' | 'right'

/**
 * 文字样式：颜色、阴影、缩放、对齐。不可变，可以整本书共用一个：
 *
 *   const BODY = TextStyle.of(Color.hex('#45301c'))
 *   const CAPTION = BODY.withShadow().withScale(0.8)
 */
export class TextStyle {
    private constructor(
        readonly color?: Color,
        readonly shadow?: boolean,
        readonly scale?: number,
        readonly align?: TextAlign,
    ) { }
    static of(color?: Color): TextStyle { return new TextStyle(color) }
    static readonly DEFAULT = new TextStyle()
    withColor(c: Color): TextStyle { return new TextStyle(c, this.shadow, this.scale, this.align) }
    withShadow(on = true): TextStyle { return new TextStyle(this.color, on, this.scale, this.align) }
    withScale(n: number): TextStyle { return new TextStyle(this.color, this.shadow, n, this.align) }
    withAlign(a: TextAlign): TextStyle { return new TextStyle(this.color, this.shadow, this.scale, a) }
}

/** 弹性布局：主轴方向的分布 */
export enum Justify { START = 'start', CENTER = 'center', END = 'end', SPACE_BETWEEN = 'space_between' }
/** 弹性布局：交叉轴方向的对齐 */
export enum Align { START = 'start', CENTER = 'center', END = 'end', STRETCH = 'stretch' }
