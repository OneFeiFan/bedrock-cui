/**
 * 纯面向对象的元素：界面就是一棵**真实的对象树**，属性是有类型的读写属性 / 链式方法——
 *
 *   const row = new Panel().setSize(116, 18).setAnchor(Anchor.TOP_LEFT)
 *   row.add(new Image(BOOK_ICON).setSize(16, 16))
 *   row.add(new Label('入门', BODY).setAnchor(Anchor.CENTER_LEFT).setOffset(23, 0))
 *   row.layer = 2                       // 也可以直接读写属性
 *
 * 构造函数只收必要参数（文字、贴图、开关组…）；其余属性用 setXxx() 链式设置或直接赋值。值是有类型的对象（Size、Length、Anchor、
 * Color、Insets、Texture、TextStyle，见 values.ts）。按钮 / 开关的各个状态是实例上现成的面板（button.hover.add(...)）。
 * 自定义组件 = 继承内置类的子类（class BookRow extends FormButton { … }）。
 * 旧写法（构造函数传一个参数对象）仍可用，但已标记 @deprecated。
 *
 * 编译与预览前，`finalize()` 把对象树拍成快照（RNode）：给没写名字的元素分配确定的名字（类型 + 同级序号），
 * 并让需要「全部建完再算」的元素（如 Pages 的页面显示条件）在这时收尾。
 */
import { isExpr, type Expr } from './expr.js'
import type { Anchor, Dyn, Intrinsic, RGB, RNode, Size } from './node.js'
import { Align, Anchor as AnchorValue, Color, Insets, Justify, Length, Size as SizeValue, Texture, TextStyle, Vec2, type LengthLike, type TextAlign } from './values.js'
import type { Anchor as AnchorName } from './node.js'

export interface LayoutOptions {
    /** 控件名（同级唯一；缺省 = 类型 + 序号）。开关的名字还要全局唯一（别的控件按名字读它的状态） */
    name?: string
    size?: [Size, Size]
    offset?: [Size, Size]
    /** 同时设 anchor_from 与 anchor_to */
    anchor?: Anchor
    /** 父控件上的锚点 */
    anchorFrom?: Anchor
    /** 自身的锚点 */
    anchorTo?: Anchor
    layer?: number
    visible?: Dyn<boolean>
    alpha?: number
    /** clips_children */
    clip?: boolean
    /** 能否交互（按钮 / 开关；可写表达式 → #enabled 绑定）。禁用的开关显示 locked 态 */
    enabled?: Dyn<boolean>
    /**
     * 内边距（安全区）：子元素放进一个缩进的内容面板里（JSON UI 没有 padding，CUI 编译成内层面板）。
     * 数字 = 四边相同；[左, 上, 右, 下]
     */
    padding?: number | [number, number, number, number]
    /** 子元素不得越出本元素（含内边距）的范围：lint 按排版结果检查（out-of-bounds） */
    contain?: boolean
    /** 允许越界（例如提示框、弹出物）：contain 检查跳过它和它的子孙 */
    overflow?: boolean
    /** 在 grid 里的格位 [列, 行] */
    gridPos?: [number, number]
    /** 最小 / 最大尺寸（min_size / max_size）：百分比尺寸在大屏 / 小屏上的上下限——响应式布局 */
    minSize?: [Size, Size]
    maxSize?: [Size, Size]
    /** 在 Row / Column 里沿主轴伸展，平分剩余空间（CSS 的 flex-grow） */
    grow?: boolean
    /** JSON UI 变量（$name: value） */
    variables?: Record<string, unknown>
    /** 逃生口：原样并入输出 JSON 的属性 */
    raw?: Record<string, unknown>
    /** 子元素（也可以之后用 add()） */
    children?: Element[]
}

export interface StackOptions extends LayoutOptions { orientation?: 'vertical' | 'horizontal' }
export interface GridOptions extends LayoutOptions { dims: [number, number] }
export interface ImageOptions extends LayoutOptions {
    texture: Dyn<string>
    /** 保持贴图宽高比。**JSON UI 缺省为 true**：拉伸 1×1 的纯色贴图请写 false（lint 会提示） */
    keepRatio?: boolean
    /** 九宫格边宽（通常写在贴图 .json 里，不用在这里写） */
    nineslice?: number | [number, number, number, number]
    /** 逻辑尺寸（base_size；高清贴图用，通常写在贴图 .json 里） */
    baseSize?: [number, number]
    uv?: [number, number]
    uvSize?: [number, number]
    color?: RGB
    clipDirection?: 'left' | 'right' | 'up' | 'down' | 'center'
    clipRatio?: Dyn<number>
    anims?: string[]
}
export interface LabelOptions extends LayoutOptions {
    text: Dyn<string>
    color?: RGB
    shadow?: boolean
    fontScale?: number
    align?: 'left' | 'center' | 'right'
    /** 文字是语言键，按玩家语言显示 */
    localize?: boolean
}
export interface ButtonOptions extends LayoutOptions {
    /** 继承的原版模板（缺省 common.button） */
    template?: string
    /** 按下时发出的按钮事件（缺省 button.form_button_click） */
    pressedName?: string
    /** 仅预览：点击回调 */
    onPress?: () => void
    /**
     * 默认聚焦优先级（default_focus_precedence，越大越优先）。真机 1.5.2：服务端重开表单后鼠标没动，
     * 点击交给**默认聚焦**的控件——翻页箭头要比关闭按钮优先。
     */
    focusPrecedence?: number
}
export interface ToggleOptions extends LayoutOptions {
    /** 开关组名（toggle_name）。同组 + radio = 单选组 */
    group: string
    /** 单选组（缺省 true） */
    radio?: boolean
    /** 在单选组里的序号（toggle_group_forced_index） */
    index: number
    /** 单选组初始选中的序号（toggle_group_default_selected；同组应一致） */
    defaultSelected?: number
    /** 非单选时的初始状态 */
    defaultState?: boolean
    /** 禁用（locked）时是否照常显示（缺省 true：沿用普通态的样子；false：什么都不画） */
    lockedVisible?: boolean
    /** 默认聚焦优先级（default_focus_precedence，越大越优先） */
    focusPrecedence?: number
    /**
     * 用表达式设定开关状态（view 绑定写 #toggle_state）。用途：把「只读全局绑定」的条件变成一个开关状态，
     * 别处再按开关名读——真机 1.5.2：一条表达式同时读开关状态与全局绑定（#title_text）时，开关变化不会触发重新计算。
     */
    stateFrom?: Expr
}
export interface CollectionItemOptions extends LayoutOptions { collection: string, index: number }
export interface RawOptions extends LayoutOptions {
    json: Record<string, unknown>
    /** 继承的原版模板（编译成 `名字@模板`，例如 common.text_cycler） */
    template?: string
}

type Addable = Element | string | null | undefined | false

/** 所有元素的基类 */
export abstract class Element {
    abstract readonly type: Intrinsic
    name?: string
    props: Record<string, any>
    readonly children: Element[] = []
    parent?: Element

    constructor(options: LayoutOptions = {}) {
        const { children, name, ...rest } = options
        this.name = name
        this.props = rest
        if (children) this.add(...children)
    }

    /**
     * 加子元素（字符串 = Label）。一个元素只能有一个父元素：已经加在别处的元素会报错——
     * 同一份内容要出现在两处（例如两个悬停态各要一个提示框）请新建或用 clone()。
     */
    add(...items: Addable[]): this {
        for (const it of items) {
            if (!it) continue
            const el = typeof it === 'string' ? new Label(it) : it
            if (el.parent && el.parent !== this) {
                throw new Error(`元素 ${el.name ?? el.type} 已经在 ${el.parent.name ?? el.parent.type} 里了：一个元素只能有一个父元素，要出现在两处请 clone()`)
            }
            if (el.parent === this) continue
            el.parent = this
            this.children.push(el)
        }
        return this
    }

    /** 深拷贝（子元素、状态面板、实例上引用的子元素都换成新副本；表达式是不可变的，共用） */
    clone(): this {
        return cloneInto(this, new Map()) as this
    }

    remove(el: Element): this {
        const i = this.children.indexOf(el)
        if (i >= 0) { this.children.splice(i, 1); el.parent = undefined }
        return this
    }

    /** 合并原始属性（低层逃生口；平时用下面有类型的属性 / setXxx()） */
    /**
     * 一次设置多项：`el.set({ size: Size.full(), layer: 2, color: Color.WHITE })`。有同名属性的键走属性写入器（与 `el.size = …` 一样、
     * 自动转换类型——有类型的值与早期写法的原始值都接受）；children 追加子元素；其余键原样并入（逃生口）。
     */
    set(props: Record<string, unknown>): this {
        for (const [k, v] of Object.entries(props)) {
            if (k === 'children') { if (v) this.add(...(v as Addable[])); continue }
            if (hasSetter(this, k)) (this as Record<string, unknown>)[k] = v
            else this.props[k] = v
        }
        return this
    }

    // ───────── 有类型的属性（读写） ─────────

    /** 尺寸 */
    get size(): SizeValue | undefined { return this.props.size ? SizeValue.from(this.props.size) : undefined }
    set size(v: SizeValue | [LengthLike | string, LengthLike | string] | undefined) { this.props.size = v === undefined ? undefined : SizeValue.from(v as SizeValue).toJSON() }
    /** 偏移 */
    get offset(): Vec2 | undefined { return this.props.offset ? Vec2.from(this.props.offset) : undefined }
    set offset(v: Vec2 | [LengthLike | string, LengthLike | string] | undefined) { this.props.offset = v === undefined ? undefined : Vec2.from(v as Vec2).toJSON() }
    /** 父控件上的锚点 */
    get anchorFrom(): AnchorValue | undefined { const a = this.props.anchorFrom ?? this.props.anchor; return a ? AnchorValue.from(a) : undefined }
    /** 自身的锚点 */
    get anchorTo(): AnchorValue | undefined { const a = this.props.anchorTo ?? this.props.anchor; return a ? AnchorValue.from(a) : undefined }
    /** 层级（相对父控件） */
    get layer(): number | undefined { return this.props.layer }
    set layer(v: number | undefined) { this.props.layer = v }
    /** 是否显示：布尔或表达式（表达式 → 绑定） */
    get visible(): boolean | Expr | undefined { return this.props.visible }
    set visible(v: boolean | Expr | undefined) { this.props.visible = v }
    /** 透明度 0–1 */
    get alpha(): number | undefined { return this.props.alpha }
    set alpha(v: number | undefined) { this.props.alpha = v }
    /** 内边距（安全区） */
    get padding(): Insets | undefined { return this.props.padding === undefined ? undefined : Insets.from(this.props.padding) }
    set padding(v: Insets | number | [number, number, number, number] | undefined) { this.props.padding = v === undefined ? undefined : Insets.from(v).toJSON() }
    get minSize(): SizeValue | undefined { return this.props.minSize ? SizeValue.from(this.props.minSize) : undefined }
    set minSize(v: SizeValue | [LengthLike | string, LengthLike | string] | undefined) { this.props.minSize = v === undefined ? undefined : SizeValue.from(v as SizeValue).toJSON() }
    get maxSize(): SizeValue | undefined { return this.props.maxSize ? SizeValue.from(this.props.maxSize) : undefined }
    set maxSize(v: SizeValue | [LengthLike | string, LengthLike | string] | undefined) { this.props.maxSize = v === undefined ? undefined : SizeValue.from(v as SizeValue).toJSON() }
    /** 在 Row / Column 里沿主轴伸展 */
    get grow(): boolean { return Boolean(this.props.grow) }
    set grow(v: boolean) { this.props.grow = v || undefined }
    /** 锚点（父控件上与自身上用同一个点；分开指定用 anchorFrom / anchorTo） */
    get anchor(): AnchorValue | undefined { return this.props.anchor ? AnchorValue.from(this.props.anchor) : undefined }
    set anchor(v: AnchorValue | AnchorName | undefined) {
        delete this.props.anchorFrom; delete this.props.anchorTo
        this.props.anchor = v === undefined ? undefined : AnchorValue.from(v).toJSON()
    }
    set anchorFrom(v: AnchorValue | AnchorName | undefined) {
        const to = this.props.anchorTo ?? this.props.anchor
        delete this.props.anchor
        this.props.anchorFrom = v === undefined ? undefined : AnchorValue.from(v).toJSON()
        if (to !== undefined) this.props.anchorTo = to
    }
    set anchorTo(v: AnchorValue | AnchorName | undefined) {
        const from = this.props.anchorFrom ?? this.props.anchor
        delete this.props.anchor
        this.props.anchorTo = v === undefined ? undefined : AnchorValue.from(v).toJSON()
        if (from !== undefined) this.props.anchorFrom = from
    }
    /** 裁掉越出自身的子控件（clips_children） */
    get clip(): boolean { return Boolean(this.props.clip) }
    set clip(v: boolean) { this.props.clip = v || undefined }
    /** 能否交互（按钮 / 开关）：布尔或表达式 */
    get enabled(): boolean | Expr | undefined { return this.props.enabled }
    set enabled(v: boolean | Expr | undefined) { this.props.enabled = v }
    /** 子孙不得越出本元素（含内边距）：静态检查 out-of-bounds */
    get contain(): boolean { return Boolean(this.props.contain) }
    set contain(v: boolean) { this.props.contain = v || undefined }
    /** 允许越界（提示框、弹出物）：contain 检查跳过 */
    get overflow(): boolean { return Boolean(this.props.overflow) }
    set overflow(v: boolean) { this.props.overflow = v || undefined }
    /** 在 grid 里的格位 [列, 行] */
    get gridPos(): [number, number] | undefined { return this.props.gridPos }
    set gridPos(v: [number, number] | undefined) { this.props.gridPos = v }
    /** JSON UI 变量（$name → 值） */
    get variables(): Record<string, unknown> | undefined { return this.props.variables }
    set variables(v: Record<string, unknown> | undefined) {
        this.props.variables = v === undefined ? undefined : Object.fromEntries(Object.entries(v).map(([k, x]) => [k.startsWith('$') ? k : `$${k}`, x]))
    }

    // ───────── 链式方法 ─────────

    setName(name: string): this { this.name = name; return this }
    /** 尺寸：setSize(Size) 或 setSize(宽, 高)（数字 = 像素，或 Length） */
    setSize(size: SizeValue): this
    setSize(width: LengthLike, height: LengthLike): this
    setSize(a: SizeValue | LengthLike, b?: LengthLike): this {
        this.size = a instanceof SizeValue ? a : SizeValue.of(a, b ?? a)
        return this
    }
    setWidth(w: LengthLike): this { this.size = (this.size ?? SizeValue.auto()).withWidth(w); return this }
    setHeight(h: LengthLike): this { this.size = (this.size ?? SizeValue.auto()).withHeight(h); return this }
    setOffset(offset: Vec2): this
    setOffset(x: LengthLike, y: LengthLike): this
    setOffset(a: Vec2 | LengthLike, b?: LengthLike): this {
        this.offset = a instanceof Vec2 ? a : Vec2.of(a, b ?? 0)
        return this
    }
    /** 锚点（父控件上与自身上用同一个点） */
    setAnchor(a: AnchorValue): this {
        this.props.anchor = a.toJSON(); delete this.props.anchorFrom; delete this.props.anchorTo
        return this
    }
    /** 父控件上的锚点（自身上的锚点不变） */
    setAnchorFrom(a: AnchorValue): this { this.anchorFrom = a; return this }
    /** 自身上的锚点（父控件上的锚点不变） */
    setAnchorTo(a: AnchorValue): this { this.anchorTo = a; return this }
    /** 分别指定父控件上的点（from）与自身上的点（to）：例如 from 右上、to 左上 = 贴在父控件右边外侧 */
    setPlacement(from: AnchorValue, to: AnchorValue): this {
        delete this.props.anchor; this.props.anchorFrom = from.toJSON(); this.props.anchorTo = to.toJSON()
        return this
    }
    setLayer(n: number): this { this.layer = n; return this }
    setVisible(v: boolean | Expr): this { this.visible = v; return this }
    setAlpha(a: number): this { this.alpha = a; return this }
    /** 裁掉越出自身的子控件（clips_children） */
    setClip(on = true): this { this.props.clip = on || undefined; return this }
    /** 能否交互（按钮 / 开关）：布尔或表达式 */
    setEnabled(v: boolean | Expr): this { this.props.enabled = v; return this }
    setPadding(v: Insets | number): this { this.padding = Insets.from(v); return this }
    /** 子孙不得越出本元素（含内边距）：静态检查 out-of-bounds */
    setContain(on = true): this { this.props.contain = on || undefined; return this }
    /** 允许越界（提示框、弹出物）：contain 检查跳过 */
    setOverflow(on = true): this { this.overflow = on; return this }
    /** 同 setOverflow */
    allowOverflow(on = true): this { return this.setOverflow(on) }
    setMinSize(size: SizeValue): this
    setMinSize(width: LengthLike, height: LengthLike): this
    setMinSize(a: SizeValue | LengthLike, b?: LengthLike): this { this.minSize = a instanceof SizeValue ? a : SizeValue.of(a, b ?? a); return this }
    setMaxSize(size: SizeValue): this
    setMaxSize(width: LengthLike, height: LengthLike): this
    setMaxSize(a: SizeValue | LengthLike, b?: LengthLike): this { this.maxSize = a instanceof SizeValue ? a : SizeValue.of(a, b ?? a); return this }
    setGrow(on = true): this { this.grow = on; return this }
    /** 在 grid 里的格位 */
    setGridPos(col: number, row: number): this { this.gridPos = [col, row]; return this }
    /** 同 setGridPos */
    setGridPosition(col: number, row: number): this { return this.setGridPos(col, row) }
    /** JSON UI 变量（$name） */
    setVariable(name: string, value: unknown): this { this.props.variables = { ...this.props.variables, [name.startsWith('$') ? name : `$${name}`]: value }; return this }
    /** 一次设置多个 JSON UI 变量（替换原有的） */
    setVariables(vars: Record<string, unknown>): this { this.variables = vars; return this }
    /** 逃生口：原样并入输出 JSON 的属性 */
    setRaw(key: string, value: unknown): this { this.props.raw = { ...this.props.raw, [key]: value }; return this }
    /** 本元素的绑定一律 binding_condition: always（要在别的控件后来才出现时重新读取，例如读路由界面里的标记） */
    setBindingAlways(on = true): this { this.props.bindingAlways = on || undefined; return this }

    /** 按名字找后代 */
    find(name: string): Element | undefined {
        for (const c of this.children) {
            if (c.name === name) return c
            const f = c.find(name)
            if (f) return f
        }
        return undefined
    }

    /** 状态面板（按钮 / 开关覆盖） */
    slots(): Record<string, Panel> | undefined { return undefined }

    /** finalize 前的收尾（子类按需覆盖：例如根据收集到的链接算显示条件） */
    protected beforeFinalize(): void { }

    /** @internal */
    _beforeFinalize(): void {
        this.beforeFinalize()
        for (const c of this.children) c._beforeFinalize()
        for (const s of Object.values(this.slots() ?? {})) s._beforeFinalize()
    }
}

function cloneInto(el: Element, map: Map<Element, Element>): Element {
    const c = Object.create(Object.getPrototypeOf(el)) as Element & Record<string, unknown>
    for (const [k, v] of Object.entries(el)) c[k] = v
    c.parent = undefined
    c.props = { ...el.props }
    ;(c as { children: Element[] }).children = []
    map.set(el, c)
    for (const ch of el.children) {
        const cc = cloneInto(ch, map)
        cc.parent = c
        c.children.push(cc)
    }
    // 状态面板、FormButton.button 这类实例字段：指向子树里的元素就用对应副本，否则单独拷贝
    for (const [k, v] of Object.entries(el)) {
        if (k !== 'parent' && v instanceof Element) c[k] = map.get(v) ?? cloneInto(v, map)
    }
    return c
}

/** @internal 判断是不是旧写法的参数对象（普通对象字面量） */
export function isOptions(v: unknown): v is Record<string, any> {
    return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype
}

/** 面板（容器） */
export class Panel extends Element {
    readonly type = 'panel' as const
    constructor()
    /** @deprecated 用 new Panel() 加 setXxx() / 属性 */
    constructor(options: LayoutOptions)
    constructor(options: LayoutOptions = {}) { super(options) }
}

/** 堆叠面板（stack_panel）：子控件沿一个方向依次排列 */
export class Stack extends Element {
    readonly type = 'stack' as const
    constructor(orientation?: 'vertical' | 'horizontal')
    /** @deprecated 用 new Stack('vertical') */
    constructor(options: StackOptions)
    constructor(a: 'vertical' | 'horizontal' | StackOptions = {}) { super(isOptions(a) ? a : { orientation: a }) }
    /** 排列方向（缺省 vertical） */
    get orientation(): 'vertical' | 'horizontal' | undefined { return this.props.orientation }
    set orientation(v: 'vertical' | 'horizontal' | undefined) { this.props.orientation = v }
    setOrientation(v: 'vertical' | 'horizontal'): this { this.orientation = v; return this }
}

/** 网格 */
export class Grid extends Element {
    readonly type = 'grid' as const
    constructor(columns: number, rows: number)
    /** @deprecated 用 new Grid(列, 行) */
    constructor(options: GridOptions)
    constructor(a: number | GridOptions, rows?: number) { super(isOptions(a) ? a as GridOptions : { dims: [a as number, rows ?? 1] } as GridOptions) }
    /** [列, 行] */
    get dims(): [number, number] { return this.props.dims }
    set dims(v: [number, number]) { this.props.dims = v }
    setDims(columns: number, rows: number): this { this.dims = [columns, rows]; return this }
}

/** 图片 */
export class Image extends Element {
    readonly type = 'image' as const
    constructor(texture: Texture | string | Expr)
    /** @deprecated 用 new Image(贴图) */
    constructor(options: ImageOptions)
    constructor(a: Texture | string | Expr | ImageOptions) {
        super(isOptions(a) ? a as ImageOptions : {})
        if (!isOptions(a)) this.texture = a as Texture | string | Expr
    }
    /** 贴图（Texture、路径或表达式） */
    get texture(): Texture | Expr { const t = this.props.texture; return isExpr(t) ? t : Texture.from(t) }
    set texture(v: Texture | string | Expr) { this.props.texture = isExpr(v) ? v : Texture.from(v).path }
    setTexture(v: Texture | string | Expr): this { this.texture = v; return this }
    /** 保持宽高比（JSON UI 缺省 true；拉伸纯色贴图要关掉） */
    get keepRatio(): boolean | undefined { return this.props.keepRatio }
    set keepRatio(v: boolean | undefined) { this.props.keepRatio = v }
    setKeepRatio(on: boolean): this { this.keepRatio = on; return this }
    /** 九宫格边宽（贴图 .json 的 nineslice_size；通常跟着贴图走：Texture.withNineslice） */
    get nineslice(): number | [number, number, number, number] | undefined { return this.props.nineslice }
    set nineslice(v: number | [number, number, number, number] | undefined) { this.props.nineslice = v }
    setNineslice(v: number | [number, number, number, number]): this { this.nineslice = v; return this }
    /** 九宫格的基准尺寸（贴图 .json 的 base_size；通常跟着贴图走：Texture.withBaseSize） */
    get baseSize(): [number, number] | undefined { return this.props.baseSize }
    set baseSize(v: [number, number] | undefined) { this.props.baseSize = v }
    setBaseSize(w: number, h: number): this { this.baseSize = [w, h]; return this }
    /** 贴图上取样区域的左上角（像素） */
    get uv(): [number, number] | undefined { return this.props.uv }
    set uv(v: [number, number] | undefined) { this.props.uv = v }
    setUv(u: number, v: number): this { this.uv = [u, v]; return this }
    /** 贴图上取样区域的大小（像素） */
    get uvSize(): [number, number] | undefined { return this.props.uvSize }
    set uvSize(v: [number, number] | undefined) { this.props.uvSize = v }
    setUvSize(w: number, h: number): this { this.uvSize = [w, h]; return this }
    /** 同时设取样区域的位置与大小 */
    setUV(u: number, v: number, w: number, h: number): this { return this.setUv(u, v).setUvSize(w, h) }
    /** 染色 */
    get color(): Color | undefined { return this.props.color ? Color.fromJSON(this.props.color) : undefined }
    set color(v: Color | RGB | undefined) { this.props.color = v === undefined ? undefined : v instanceof Color ? v.toJSON() : v }
    setColor(c: Color): this { this.color = c; return this }
    /** 按比例裁剪的方向（进度条） */
    get clipDirection(): 'left' | 'right' | 'up' | 'down' | 'center' | undefined { return this.props.clipDirection }
    set clipDirection(v: 'left' | 'right' | 'up' | 'down' | 'center' | undefined) { this.props.clipDirection = v }
    setClipDirection(d: 'left' | 'right' | 'up' | 'down' | 'center'): this { this.clipDirection = d; return this }
    /** 按比例裁剪的比例（数字或表达式） */
    get clipRatio(): number | Expr | undefined { return this.props.clipRatio }
    set clipRatio(v: number | Expr | undefined) { this.props.clipRatio = v }
    /** setClipRatio(比例)，或 setClipRatio(方向, 比例) 一次设两项 */
    setClipRatio(ratio: number | Expr): this
    setClipRatio(direction: 'left' | 'right' | 'up' | 'down' | 'center', ratio: number | Expr): this
    setClipRatio(a: number | Expr | 'left' | 'right' | 'up' | 'down' | 'center', b?: number | Expr): this {
        if (b === undefined) { this.clipRatio = a as number | Expr; return this }
        this.clipDirection = a as 'left' | 'right' | 'up' | 'down' | 'center'; this.clipRatio = b
        return this
    }
    /** 动画（JSON UI anims：动画定义的引用，例如 '@my_ns.fade_in'） */
    get anims(): string[] | undefined { return this.props.anims }
    set anims(v: string[] | undefined) { this.props.anims = v }
    setAnims(...anims: string[]): this { this.anims = anims; return this }
}

/** 文字 */
export class Label extends Element {
    readonly type = 'label' as const
    constructor(text: string | Expr, style?: TextStyle)
    /** @deprecated 用 new Label(文字, 样式) */
    constructor(options: LabelOptions)
    constructor(a: string | Expr | LabelOptions, style?: TextStyle) {
        super(isOptions(a) ? a as LabelOptions : {})
        if (!isOptions(a)) { this.text = a as string | Expr; if (style) this.setStyle(style) }
    }
    /** 文字（字符串或表达式） */
    get text(): string | Expr { return this.props.text }
    set text(v: string | Expr) { this.props.text = v }
    setText(v: string | Expr): this { this.text = v; return this }
    /** 套用样式（颜色、阴影、缩放、对齐；样式里没写的项不动） */
    setStyle(st: TextStyle): this {
        if (st.color) this.props.color = st.color.toJSON()
        if (st.shadow !== undefined) this.props.shadow = st.shadow
        if (st.scale !== undefined) this.props.fontScale = st.scale
        if (st.align) this.props.align = st.align
        return this
    }
    /** 颜色 */
    get color(): Color | undefined { return this.props.color ? Color.fromJSON(this.props.color) : undefined }
    set color(v: Color | RGB | undefined) { this.props.color = v === undefined ? undefined : v instanceof Color ? v.toJSON() : v }
    setColor(c: Color): this { this.color = c; return this }
    /** 阴影 */
    get shadow(): boolean | undefined { return this.props.shadow }
    set shadow(v: boolean | undefined) { this.props.shadow = v }
    setShadow(on = true): this { this.shadow = on; return this }
    /** 字号倍数（font_scale_factor） */
    get fontScale(): number | undefined { return this.props.fontScale }
    set fontScale(v: number | undefined) { this.props.fontScale = v }
    setFontScale(n: number): this { this.fontScale = n; return this }
    /** 对齐 */
    get align(): TextAlign | undefined { return this.props.align }
    set align(v: TextAlign | undefined) { this.props.align = v }
    setAlign(a: TextAlign): this { this.align = a; return this }
    /** 文字是语言键，按玩家语言显示 */
    get localize(): boolean | undefined { return this.props.localize }
    set localize(v: boolean | undefined) { this.props.localize = v }
    setLocalize(on = true): this { this.localize = on; return this }
    /** 行距（line_padding） */
    get lineSpacing(): number | undefined { return this.props.lineSpacing }
    set lineSpacing(v: number | undefined) { this.props.lineSpacing = v }
    /**
     * 行距（line_padding，原版聊天栏用它调行距）。真机 1.20.0：**每一行都多占 n**，文字在行里居中（上下各 n/2，第一行也下移 n/2），
     * 控件高 = 行数 × (10 + n)。运行期文字里放 emoji 字形图标（16 高、以文字行为中心）时设 ≥ 6，图标就不会压到上下行
     */
    setLineSpacing(n: number): this { this.lineSpacing = n; return this }
}

/** 原样输出的 JSON（逃生口） */
export class Raw extends Element {
    readonly type = 'raw' as const
    constructor(json: Record<string, unknown>, template?: string)
    /** @deprecated 用 new Raw(json, 模板) */
    constructor(options: RawOptions)
    constructor(a: Record<string, unknown> | RawOptions, template?: string) {
        super(isOptions(a) && 'json' in a ? a as RawOptions : { json: a, template })
    }
    /** 原样输出的 JSON */
    get json(): Record<string, unknown> { return this.props.json }
    set json(v: Record<string, unknown>) { this.props.json = v }
    setJson(v: Record<string, unknown>): this { this.json = v; return this }
    /** 继承的模板（name@模板） */
    get template(): string | undefined { return this.props.template }
    set template(v: string | undefined) { this.props.template = v }
    setTemplate(v: string): this { this.template = v; return this }
}

const statePanel = () => new Panel().setSize(SizeValue.full())

/** 按钮：default / hover / pressed 三个状态面板，加上始终显示的子元素 */
export class Button extends Element {
    readonly type = 'button' as const
    readonly default = statePanel()
    readonly hover = statePanel()
    readonly pressed = statePanel()
    constructor()
    /** @deprecated 用 new Button() 加 setXxx() */
    constructor(options: ButtonOptions)
    constructor(options: ButtonOptions = {}) { super(options) }
    slots() { return { default: this.default, hover: this.hover, pressed: this.pressed } }
    /** 按下时发出的按钮事件（缺省 button.form_button_click） */
    get pressedName(): string | undefined { return this.props.pressedName }
    set pressedName(v: string | undefined) { this.props.pressedName = v }
    setPressedName(name: string): this { this.pressedName = name; return this }
    /** 继承的原版模板（缺省 common.button） */
    get template(): string | undefined { return this.props.template }
    set template(v: string | undefined) { this.props.template = v }
    setTemplate(t: string): this { this.template = t; return this }
    /** 默认聚焦优先级（服务端重开表单、鼠标没动时，点击交给默认聚焦的控件） */
    get focusPrecedence(): number | undefined { return this.props.focusPrecedence }
    set focusPrecedence(v: number | undefined) { this.props.focusPrecedence = v }
    setFocusPrecedence(n: number): this { this.focusPrecedence = n; return this }
    /** 仅预览：点击回调 */
    setOnPress(fn: () => void): this { this.props.onPress = fn; return this }
    /** 同 setOnPress */
    onPress(fn: () => void): this { return this.setOnPress(fn) }
}

/**
 * 开关（客户端状态，不经过服务端）：unchecked / checked / uncheckedHover / checkedHover 四个状态面板。
 * 编译成继承原版 common.toggle（单选组：toggle_name + radio_toggle_group + toggle_group_forced_index）。
 * 别的控件用 toggleState(开关名) 读它是否选中。
 */
export class Toggle extends Element {
    readonly type = 'toggle' as const
    readonly unchecked = statePanel()
    readonly checked = statePanel()
    readonly uncheckedHover = statePanel()
    readonly checkedHover = statePanel()
    /** 单选组 group 里的第 index 个 */
    constructor(group: string, index: number)
    /** @deprecated 用 new Toggle(组名, 序号) */
    constructor(options: ToggleOptions)
    constructor(a: string | ToggleOptions, index?: number) { super(isOptions(a) ? a as ToggleOptions : { group: a, index: index ?? 0 }) }
    slots() { return { unchecked: this.unchecked, checked: this.checked, unchecked_hover: this.uncheckedHover, checked_hover: this.checkedHover } }
    /** 单选组名 */
    get group(): string { return this.props.group }
    set group(v: string) { this.props.group = v }
    setGroup(v: string): this { this.group = v; return this }
    /** 组里的序号 */
    get index(): number { return this.props.index }
    set index(v: number) { this.props.index = v }
    setIndex(v: number): this { this.index = v; return this }
    /** 单选（缺省 true）；false = 各自独立的勾选框 */
    get radio(): boolean | undefined { return this.props.radio }
    set radio(v: boolean | undefined) { this.props.radio = v }
    setRadio(on: boolean): this { this.radio = on; return this }
    /** 单选组初始选中的序号（同组应一致） */
    get defaultSelected(): number | undefined { return this.props.defaultSelected }
    set defaultSelected(v: number | undefined) { this.props.defaultSelected = v }
    setDefaultSelected(i: number): this { this.defaultSelected = i; return this }
    /** 非单选时的初始状态 */
    get defaultState(): boolean | undefined { return this.props.defaultState }
    set defaultState(v: boolean | undefined) { this.props.defaultState = v }
    setDefaultState(on: boolean): this { this.defaultState = on; return this }
    /** 禁用（locked）时是否照常显示 */
    get lockedVisible(): boolean | undefined { return this.props.lockedVisible }
    set lockedVisible(v: boolean | undefined) { this.props.lockedVisible = v }
    setLockedVisible(on: boolean): this { this.lockedVisible = on; return this }
    /** 默认聚焦优先级 */
    get focusPrecedence(): number | undefined { return this.props.focusPrecedence }
    set focusPrecedence(v: number | undefined) { this.props.focusPrecedence = v }
    setFocusPrecedence(n: number): this { this.focusPrecedence = n; return this }
    /** 用表达式设定开关状态（只读全局绑定的条件 → 开关状态，别处再按开关名读） */
    get stateFrom(): Expr | undefined { return this.props.stateFrom }
    set stateFrom(v: Expr | undefined) { this.props.stateFrom = v }
    setStateFrom(e: Expr): this { this.stateFrom = e; return this }
}

/** 集合项：子树绑定到某个集合（如 form_buttons）的第 index 项 */
export class CollectionItem extends Element {
    readonly type = 'collection_item' as const
    constructor(collection: string, index: number)
    /** @deprecated 用 new CollectionItem(集合名, 序号) */
    constructor(options: CollectionItemOptions)
    constructor(a: string | CollectionItemOptions, index?: number) { super(isOptions(a) ? a as CollectionItemOptions : { collection: a, index: index ?? 0 }) }
    /** 集合名（例如 form_buttons） */
    get collection(): string { return this.props.collection }
    set collection(v: string) { this.props.collection = v }
    setCollection(v: string): this { this.collection = v; return this }
    /** 集合里的第几项 */
    get index(): number { return this.props.index }
    set index(v: number) { this.props.index = v }
    setIndex(v: number): this { this.index = v; return this }
}

/**
 * 弹性布局（现代前端的 flexbox）：Row 横排、Column 竖排。子控件沿主轴依次排列，支持
 *   间距 setGap、主轴分布 setJustify（START / CENTER / END / SPACE_BETWEEN）、交叉轴对齐 setAlign（START / CENTER / END / STRETCH）、
 *   子控件 setGrow()（平分剩余空间）、setMinSize / setMaxSize（上下限）。
 * 编译成 JSON UI 原生的 stack_panel + 百分比 / fill + 占位面板——**运行时随屏幕大小自适应**（不是在固定画布上算死的坐标）。
 * 每个子控件放进一个「槽位」面板：主轴尺寸取子控件的（伸展 = fill、按内容 = 100%c），交叉轴按对齐方式摆放。
 * STRETCH（缺省）只拉伸交叉方向**没写尺寸**的子控件（同 CSS）：文字拉满宽度后按宽度折行；写了尺寸的图标不变。
 */
export abstract class Flex extends Element {
    readonly type: 'panel' | 'scroll' = 'panel'
    abstract readonly direction: 'row' | 'column'
    /** @internal 主轴按内容决定（Scroll 的内容：高度 = 子控件之和，超出部分滚动） */
    protected contentMain = false
    gap = 0
    justify: Justify = Justify.START
    align: Align = Align.STRETCH
    setGap(n: number): this { this.gap = n; return this }
    setJustify(j: Justify): this { this.justify = j; return this }
    setAlign(a: Align): this { this.align = a; return this }

    /** @internal 展开成 stack_panel + 槽位 + 占位（快照时调用；不改对象树，可以反复调用） */
    _expand(path: string): RNode[] {
        const row = this.direction === 'row'
        const M = row ? 0 : 1, X = 1 - M
        const own = this.props.size as [Size, Size] | undefined
        const byContent = (v: Size | undefined) => typeof v === 'string' && /%c/.test(v)
        const mainContent = this.contentMain || byContent(own?.[M]), crossContent = !this.contentMain && byContent(own?.[X])
        const stackPath = `${path}/flex`
        const pair = (main: Size | undefined, cross: Size | undefined): [Size, Size] => (row ? [main ?? 'default', cross ?? 'default'] : [cross ?? 'default', main ?? 'default'])
        const spacer = (name: string, main: Size): RNode => ({ type: 'panel', name, path: `${stackPath}/${name}`, props: { size: pair(main, crossContent ? 0 : '100%') }, children: [] })
        const anyGrow = this.children.some((c) => c.props.grow)
        const justify = anyGrow ? Justify.START : this.justify      // 有伸展的子控件时剩余空间归它们（同 CSS）
        const items: RNode[] = []
        let n = 0
        if (justify === Justify.END || justify === Justify.CENTER) items.push(spacer(`space${n++}`, 'fill'))
        const fixed = (v: Size | undefined) => v !== undefined && !(typeof v === 'string' && (/%c/.test(v) || v === 'default' || v === 'fill'))
        const crossAnchor: Record<Align, Anchor> = row
            ? { start: 'top_left', center: 'left_middle', end: 'bottom_left', stretch: 'top_left' }
            : { start: 'top_left', center: 'top_middle', end: 'top_right', stretch: 'top_left' }
        this.children.forEach((child, i) => {
            if (i > 0) {
                if (this.gap) items.push(spacer(`gap${i}`, this.gap))
                if (justify === Justify.SPACE_BETWEEN) items.push(spacer(`space${n++}`, 'fill'))
            }
            const slotPath = `${stackPath}/slot${i}`
            const [node] = snapshot([child], slotPath)
            const size = node.props.size as [Size, Size] | undefined
            const main = size?.[M], cross = size?.[X]
            const grow = Boolean(node.props.grow) || main === 'fill'
            delete node.props.grow
            const slotMain: Size = grow ? 'fill' : fixed(main) ? main! : '100%c'
            // 像素尺寸原样保留（FormButton 编译成正方形网格要知道边长）；百分比等改成占满槽位（槽位已经是那个尺寸）
            const childMain: Size | undefined = grow ? '100%' : typeof main === 'number' ? main : fixed(main) ? '100%' : main
            const stretch = this.align === Align.STRETCH && !crossContent && (cross === undefined || cross === 'default')
            const childCross: Size | undefined = stretch ? '100%' : cross
            if (childMain !== undefined || childCross !== undefined) node.props.size = pair(childMain, childCross)
            node.props.anchor = crossAnchor[this.align]
            delete node.props.anchorFrom; delete node.props.anchorTo
            const slotProps: Record<string, unknown> = { size: pair(slotMain, crossContent ? '100%c' : '100%') }
            // 显示条件挂在槽位上（隐藏的子控件不占位置）；上下限也给槽位，主轴才会真的受限
            if (node.props.visible !== undefined) { slotProps.visible = node.props.visible; delete node.props.visible }
            if (node.props.minSize) slotProps.minSize = node.props.minSize
            if (node.props.maxSize) slotProps.maxSize = node.props.maxSize
            items.push({ type: 'panel', name: `slot${i}`, path: slotPath, props: slotProps, children: [node] })
        })
        if (justify === Justify.CENTER) items.push(spacer(`space${n++}`, 'fill'))
        const stackSize = pair(mainContent ? '100%c' : '100%', crossContent ? '100%cm' : '100%')
        return [{ type: 'stack', name: 'flex', path: stackPath, props: { orientation: row ? 'horizontal' : 'vertical', size: stackSize, anchor: 'top_left' }, children: items }]
    }
}

/** 横排的弹性容器 */
export class Row extends Flex { readonly direction = 'row' as const }
/** 竖排的弹性容器 */
export class Column extends Flex { readonly direction = 'column' as const }

/**
 * 滚动区域：子控件竖排（同 Column：间距、拉伸），内容高度按子控件之和，超出部分滚动。
 * 编译成原版 common.scrolling_panel：内容提升为命名空间里的独立元素，用 $scrolling_content 引用；滚动条在区域内侧（宽 8：边距 2 + 条 4 + 边距 2）。
 * 响应式布局里放会变长的内容（说明文字、列表）：屏幕变小时不溢出、不重叠，而是可以滚动。
 */
export class Scroll extends Flex {
    override readonly type = 'scroll' as const
    readonly direction = 'column' as const
    protected override contentMain = true
}

const PREFIX: Record<Intrinsic, string> = {
    panel: 'panel', stack: 'stack', grid: 'grid', image: 'image', label: 'label', button: 'button', toggle: 'toggle', collection_item: 'item', raw: 'raw', scroll: 'scroll',
}

function snapshot(list: Element[], parentPath: string): RNode[] {
    const used = new Map<string, number>()
    return list.map((el) => {
        const prefix = PREFIX[el.type]
        let name = el.name
        if (name === undefined) { name = `${prefix}${used.get(prefix) ?? 0}`; used.set(prefix, (used.get(prefix) ?? 0) + 1) }
        const path = parentPath ? `${parentPath}/${name}` : name
        const { padding, ...props } = el.props
        // 真机（1.4.0 叠放顺序）：文字与图片同层时，游戏不保证文字在上（图前字后、字前图后、字是图的子元素都被盖住），
        // 只有文字层级更高才显示 ⇒ 文字缺省 layer 1（图片仍是 0）；显式写了 layer 的不动
        if (el.type === 'label' && props.layer === undefined) props.layer = 1
        const inner = padding !== undefined ? `${path}/content` : path
        // 自己展开子树的元素（Row / Column / Scroll、Text）：快照时生成原生结构，不改对象树
        const expand = (el as { _expand?: (path: string) => RNode[] })._expand
        let children = typeof expand === 'function' ? expand.call(el, inner) : snapshot(el.children, inner)
        if (padding !== undefined) {
            // 内边距 → 内层内容面板：尺寸 = 100% − 左右 / 上下，偏移 = [左, 上]
            const [l, t, r2, b] = typeof padding === 'number' ? [padding, padding, padding, padding] : padding
            children = [{ type: 'panel', name: 'content', path: `${path}/content`, props: { size: [`100% - ${l + r2}px`, `100% - ${t + b}px`], anchor: 'top_left', offset: [l, t], padded: true }, children }]
        }
        const r: RNode = { type: el.type, name, path, props, children }
        const slots = el.slots()
        if (slots) r.slots = Object.fromEntries(Object.entries(slots).map(([k, p]) => [k, snapshot(p.children, `${path}/${k}`)]))
        return r
    })
}

/**
 * @internal 已弃用的参数对象写法的兼容层：把布局选项并进一个已经构造好的元素（效果与参数对象构造函数相同）。
 * 框架自己的代码一律用 setXxx()；只有仍接受参数对象的公开方法（例如 pages.page(key, options)）经过这里。
 */
export function _applyOptions(el: Element, options: LayoutOptions): void {
    const { children, name, ...rest } = options
    if (name !== undefined) el.name = name
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) el.props[k] = v
    if (children) el.add(...children)
}

/** 对象（沿原型链）有没有名为 key 的属性写入器 */
function hasSetter(obj: object, key: string): boolean {
    for (let p = Object.getPrototypeOf(obj); p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        const d = Object.getOwnPropertyDescriptor(p, key)
        if (d) return typeof d.set === 'function'
    }
    return false
}

/** @internal 给自己展开子树的组件（Text）用 */
export const _snapshot = (list: Element[], parentPath: string): RNode[] => snapshot(list, parentPath)

/** 对象树 → 快照（编译与预览用）。根可以是一个元素或元素数组 */
export function finalize(root: Element | Element[], parentPath = ''): RNode[] {
    const list = Array.isArray(root) ? root : [root]
    for (const el of list) el._beforeFinalize()
    return snapshot(list, parentPath)
}

export type { Expr }
