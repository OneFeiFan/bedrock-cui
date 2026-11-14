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
    set(props: Record<string, unknown>): this {
        Object.assign(this.props, props)
        return this
    }

    // ───────── 有类型的属性（读写） ─────────

    /** 尺寸 */
    get size(): SizeValue | undefined { return this.props.size ? SizeValue.from(this.props.size) : undefined }
    set size(v: SizeValue | undefined) { this.props.size = v?.toJSON() }
    /** 偏移 */
    get offset(): Vec2 | undefined { return this.props.offset ? Vec2.from(this.props.offset) : undefined }
    set offset(v: Vec2 | undefined) { this.props.offset = v?.toJSON() }
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
    set padding(v: Insets | undefined) { this.props.padding = v?.toJSON() }
    get minSize(): SizeValue | undefined { return this.props.minSize ? SizeValue.from(this.props.minSize) : undefined }
    set minSize(v: SizeValue | undefined) { this.props.minSize = v?.toJSON() }
    get maxSize(): SizeValue | undefined { return this.props.maxSize ? SizeValue.from(this.props.maxSize) : undefined }
    set maxSize(v: SizeValue | undefined) { this.props.maxSize = v?.toJSON() }
    /** 在 Row / Column 里沿主轴伸展 */
    get grow(): boolean { return Boolean(this.props.grow) }
    set grow(v: boolean) { this.props.grow = v || undefined }

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
    allowOverflow(on = true): this { this.props.overflow = on || undefined; return this }
    setMinSize(size: SizeValue): this
    setMinSize(width: LengthLike, height: LengthLike): this
    setMinSize(a: SizeValue | LengthLike, b?: LengthLike): this { this.minSize = a instanceof SizeValue ? a : SizeValue.of(a, b ?? a); return this }
    setMaxSize(size: SizeValue): this
    setMaxSize(width: LengthLike, height: LengthLike): this
    setMaxSize(a: SizeValue | LengthLike, b?: LengthLike): this { this.maxSize = a instanceof SizeValue ? a : SizeValue.of(a, b ?? a); return this }
    setGrow(on = true): this { this.grow = on; return this }
    /** 在 grid 里的格位 */
    setGridPosition(col: number, row: number): this { this.props.gridPos = [col, row]; return this }
    /** JSON UI 变量（$name） */
    setVariable(name: string, value: unknown): this { this.props.variables = { ...this.props.variables, [name.startsWith('$') ? name : `$${name}`]: value }; return this }
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
}

/** 网格 */
export class Grid extends Element {
    readonly type = 'grid' as const
    constructor(columns: number, rows: number)
    /** @deprecated 用 new Grid(列, 行) */
    constructor(options: GridOptions)
    constructor(a: number | GridOptions, rows?: number) { super(isOptions(a) ? a as GridOptions : { dims: [a as number, rows ?? 1] } as GridOptions) }
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
    setKeepRatio(on: boolean): this { this.props.keepRatio = on; return this }
    /** 染色 */
    setColor(c: Color): this { this.props.color = c.toJSON(); return this }
    /** 贴图上的取样区域（像素） */
    setUV(u: number, v: number, w: number, h: number): this { this.props.uv = [u, v]; this.props.uvSize = [w, h]; return this }
    /** 按比例裁剪（进度条）：方向 + 比例（数字或表达式） */
    setClipRatio(direction: 'left' | 'right' | 'up' | 'down' | 'center', ratio: number | Expr): this { this.props.clipDirection = direction; this.props.clipRatio = ratio; return this }
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
    setColor(c: Color): this { this.props.color = c.toJSON(); return this }
    setShadow(on = true): this { this.props.shadow = on; return this }
    setFontScale(n: number): this { this.props.fontScale = n; return this }
    setAlign(a: TextAlign): this { this.props.align = a; return this }
    /** 文字是语言键，按玩家语言显示 */
    setLocalize(on = true): this { this.props.localize = on; return this }
    /**
     * 行与行之间额外的间距（line_padding，原版聊天栏用它调行距）。运行期文字里放 emoji 字形图标（16 高、以文字行为中心）时设 ≥ 6，
     * 图标就不会压到上下行
     */
    setLineSpacing(n: number): this { this.props.lineSpacing = n; return this }
    get color(): Color | undefined { return this.props.color ? Color.fromJSON(this.props.color) : undefined }
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
    setPressedName(name: string): this { this.props.pressedName = name; return this }
    /** 继承的原版模板（缺省 common.button） */
    setTemplate(t: string): this { this.props.template = t; return this }
    /** 默认聚焦优先级（服务端重开表单、鼠标没动时，点击交给默认聚焦的控件） */
    setFocusPrecedence(n: number): this { this.props.focusPrecedence = n; return this }
    /** 仅预览：点击回调 */
    onPress(fn: () => void): this { this.props.onPress = fn; return this }
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
    get group(): string { return this.props.group }
    get index(): number { return this.props.index }
    /** 单选（缺省 true）；false = 各自独立的勾选框 */
    setRadio(on: boolean): this { this.props.radio = on; return this }
    /** 单选组初始选中的序号（同组应一致） */
    setDefaultSelected(i: number): this { this.props.defaultSelected = i; return this }
    /** 非单选时的初始状态 */
    setDefaultState(on: boolean): this { this.props.defaultState = on; return this }
    /** 禁用（locked）时是否照常显示 */
    setLockedVisible(on: boolean): this { this.props.lockedVisible = on; return this }
    setFocusPrecedence(n: number): this { this.props.focusPrecedence = n; return this }
    /** 用表达式设定开关状态（只读全局绑定的条件 → 开关状态，别处再按开关名读） */
    setStateFrom(e: Expr): this { this.props.stateFrom = e; return this }
}

/** 集合项：子树绑定到某个集合（如 form_buttons）的第 index 项 */
export class CollectionItem extends Element {
    readonly type = 'collection_item' as const
    constructor(collection: string, index: number)
    /** @deprecated 用 new CollectionItem(集合名, 序号) */
    constructor(options: CollectionItemOptions)
    constructor(a: string | CollectionItemOptions, index?: number) { super(isOptions(a) ? a as CollectionItemOptions : { collection: a, index: index ?? 0 }) }
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

/** @internal 给自己展开子树的组件（Text）用 */
export const _snapshot = (list: Element[], parentPath: string): RNode[] => snapshot(list, parentPath)

/** 对象树 → 快照（编译与预览用）。根可以是一个元素或元素数组 */
export function finalize(root: Element | Element[], parentPath = ''): RNode[] {
    const list = Array.isArray(root) ? root : [root]
    for (const el of list) el._beforeFinalize()
    return snapshot(list, parentPath)
}

export type { Expr }
