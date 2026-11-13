/**
 * 纯面向对象的元素：界面就是一棵**真实的对象树**——
 *
 *   const row = new Panel({ size: [116, 18], anchor: 'top_left' })
 *   row.add(new Image({ texture: 'textures/items/book_normal', size: [16, 16] }))
 *   row.add(new Label({ text: '入门', anchor: 'left_middle', offset: [23, 0] }))
 *
 * 参数一律是普通对象；`add()` 加子元素、`set()` 改属性；按钮 / 开关的各个状态是实例上现成的面板（button.hover.add(...)）。
 * 自定义组件 = 继承内置类的子类（class BookRow extends FormButton { … }）。
 *
 * 编译与预览前，`finalize()` 把对象树拍成快照（RNode）：给没写名字的元素分配确定的名字（类型 + 同级序号），
 * 并让需要「全部建完再算」的元素（如 Pages 的页面显示条件）在这时收尾。
 */
import type { Expr } from './expr.js'
import type { Anchor, Dyn, Intrinsic, RGB, RNode, Size } from './node.js'

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
    /** 在 grid 里的格位 [列, 行] */
    gridPos?: [number, number]
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
}
export interface CollectionItemOptions extends LayoutOptions { collection: string, index: number }
export interface RawOptions extends LayoutOptions { json: Record<string, unknown> }

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
            const el = typeof it === 'string' ? new Label({ text: it }) : it
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

    /** 合并属性 */
    set(props: Record<string, unknown>): this {
        Object.assign(this.props, props)
        return this
    }

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

export class Panel extends Element { readonly type = 'panel' as const }
export class Stack extends Element {
    readonly type = 'stack' as const
    constructor(options: StackOptions = {}) { super(options) }
}
export class Grid extends Element {
    readonly type = 'grid' as const
    constructor(options: GridOptions) { super(options) }
}
export class Image extends Element {
    readonly type = 'image' as const
    constructor(options: ImageOptions) { super(options) }
}
export class Label extends Element {
    readonly type = 'label' as const
    constructor(options: LabelOptions) { super(options) }
}
export class Raw extends Element {
    readonly type = 'raw' as const
    constructor(options: RawOptions) { super(options) }
}

const statePanel = () => new Panel({ size: ['100%', '100%'] })

/** 按钮：default / hover / pressed 三个状态面板，加上始终显示的子元素 */
export class Button extends Element {
    readonly type = 'button' as const
    readonly default = statePanel()
    readonly hover = statePanel()
    readonly pressed = statePanel()
    constructor(options: ButtonOptions = {}) { super(options) }
    slots() { return { default: this.default, hover: this.hover, pressed: this.pressed } }
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
    constructor(options: ToggleOptions) { super(options) }
    slots() { return { unchecked: this.unchecked, checked: this.checked, unchecked_hover: this.uncheckedHover, checked_hover: this.checkedHover } }
}

/** 集合项：子树绑定到某个集合（如 form_buttons）的第 index 项 */
export class CollectionItem extends Element {
    readonly type = 'collection_item' as const
    constructor(options: CollectionItemOptions) { super(options) }
}

const PREFIX: Record<Intrinsic, string> = {
    panel: 'panel', stack: 'stack', grid: 'grid', image: 'image', label: 'label', button: 'button', toggle: 'toggle', collection_item: 'item', raw: 'raw',
}

function snapshot(list: Element[], parentPath: string): RNode[] {
    const used = new Map<string, number>()
    return list.map((el) => {
        const prefix = PREFIX[el.type]
        let name = el.name
        if (name === undefined) { name = `${prefix}${used.get(prefix) ?? 0}`; used.set(prefix, (used.get(prefix) ?? 0) + 1) }
        const path = parentPath ? `${parentPath}/${name}` : name
        const r: RNode = { type: el.type, name, path, props: { ...el.props }, children: snapshot(el.children, path) }
        const slots = el.slots()
        if (slots) r.slots = Object.fromEntries(Object.entries(slots).map(([k, p]) => [k, snapshot(p.children, `${path}/${k}`)]))
        return r
    })
}

/** 对象树 → 快照（编译与预览用）。根可以是一个元素或元素数组 */
export function finalize(root: Element | Element[], parentPath = ''): RNode[] {
    const list = Array.isArray(root) ? root : [root]
    for (const el of list) el._beforeFinalize()
    return snapshot(list, parentPath)
}

export type { Expr }
