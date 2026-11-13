/**
 * 元素树（参考 React）：元素是不可变的纯对象 `{ type, props, key }`；函数组件 `(props) => 子元素`；
 * Fragment；Context（Provider / useContext）。
 *
 * `resolve()` 把组件展开成只含内置控件的树（RNode），并给每个节点一个**确定的名字**
 * （显式 name，或「类型 + 同级序号」）——同样的输入每次生成同样的 JSON，可以做快照测试。
 */
import type { Expr } from './expr.js'

/** 尺寸 / 偏移：像素数字，或 JSON UI 的尺寸表达式（'100%'、'100%c + 8px'、'default'、'fill'…） */
export type Size = number | string
export type Anchor = 'top_left' | 'top_middle' | 'top_right' | 'left_middle' | 'center' | 'right_middle' | 'bottom_left' | 'bottom_middle' | 'bottom_right'
/** 静态值，或绑定表达式（运行期由游戏计算） */
export type Dyn<T> = T | Expr
export type RGB = [number, number, number]

export interface LayoutProps {
    /** 控件名（同级唯一；缺省 = 类型 + 序号） */
    name?: string
    key?: string | number
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
    children?: Child
}

export interface PanelProps extends LayoutProps { }
export interface StackProps extends LayoutProps { orientation?: 'vertical' | 'horizontal' }
export interface GridProps extends LayoutProps { dims: [number, number] }
export interface ImageProps extends LayoutProps {
    texture: Dyn<string>
    /**
     * 保持贴图宽高比。**JSON UI 缺省为 true**：1×1 的纯色贴图拉伸成非正方形会被画成居中的正方形。
     * 预览按同样规则画；lint 会提示。
     */
    keepRatio?: boolean
    nineslice?: number | [number, number, number, number]
    uv?: [number, number]
    uvSize?: [number, number]
    color?: RGB
    clipDirection?: 'left' | 'right' | 'up' | 'down' | 'center'
    clipRatio?: Dyn<number>
    /** 引用的动画（`@namespace.anim`） */
    anims?: string[]
}
export interface LabelProps extends LayoutProps {
    text: Dyn<string>
    color?: RGB
    shadow?: boolean
    fontScale?: number
    align?: 'left' | 'center' | 'right'
    /** 文字是语言键，按玩家语言显示 */
    localize?: boolean
}
export interface ButtonProps extends LayoutProps {
    /** 默认态 / 悬停态 / 按下态的内容（各自独立的子树） */
    default?: Child
    hover?: Child
    pressed?: Child
    /** 继承的原版模板（缺省 common.button） */
    template?: string
    /** 按下时发出的按钮事件（缺省 button.form_button_click） */
    pressedName?: string
    /** 仅预览：点击回调 */
    onPress?: () => void
}
/**
 * 集合项：让子树绑定到某个集合（如 form_buttons）的第 index 项。
 * 编译成 sapdon 真机验证过的「grid + grid_position + 内层负偏移」写法；预览里直接按 index 取数据。
 */
export interface CollectionItemProps extends LayoutProps { collection: string, index: number }

export type Intrinsic = 'panel' | 'stack' | 'grid' | 'image' | 'label' | 'button' | 'collection_item' | 'raw'

export interface IntrinsicProps {
    panel: PanelProps
    stack: StackProps
    grid: GridProps
    image: ImageProps
    label: LabelProps
    button: ButtonProps
    collection_item: CollectionItemProps
    /** 原样输出一个控件（{ type, ...props }），预览按 panel 处理 */
    raw: LayoutProps & { json: Record<string, unknown> }
}

export const Fragment = Symbol.for('cui.fragment')
const PROVIDER = Symbol.for('cui.provider')

export type Component<P = any> = (props: P) => Child
export interface CNode {
    type: Intrinsic | Component | typeof Fragment | typeof PROVIDER
    props: Record<string, any>
    key?: string | number
}
export type Child = CNode | string | number | boolean | null | undefined | Child[]

export function h<T extends Intrinsic>(type: T, props?: IntrinsicProps[T] | null, ...children: Child[]): CNode
export function h<P>(type: Component<P>, props?: P | null, ...children: Child[]): CNode
export function h(type: typeof Fragment, props?: null, ...children: Child[]): CNode
export function h(type: any, props?: any, ...children: Child[]): CNode {
    const p = { ...(props ?? {}) }
    if (children.length) p.children = children.length === 1 ? children[0] : children
    return { type, props: p, key: p.key }
}

// ───────────────────────────── Context ─────────────────────────────

export interface Context<T> {
    readonly id: symbol
    readonly defaultValue: T
    Provider: Component<{ value: T, children?: Child }>
}

const contextStack: Map<symbol, unknown>[] = [new Map()]

export function createContext<T>(defaultValue: T): Context<T> {
    const id = Symbol('cui.context')
    const ctx: Context<T> = {
        id, defaultValue,
        Provider: (props) => ({ type: PROVIDER, props: { ...props, ctx: id } }),
    }
    return ctx
}

/** 在组件函数里读当前的 Context 值（展开期间有效） */
export function useContext<T>(ctx: Context<T>): T {
    for (let i = contextStack.length - 1; i >= 0; i--) if (contextStack[i].has(ctx.id)) return contextStack[i].get(ctx.id) as T
    return ctx.defaultValue
}

// ───────────────────────────── 展开 ─────────────────────────────

/** 展开后的节点：只有内置控件，名字确定 */
export interface RNode {
    type: Intrinsic
    name: string
    /** 从根开始的路径（a/b/c），用于报错与预览里的交互状态 */
    path: string
    props: Record<string, any>
    children: RNode[]
    /** 按钮的三种状态子树 */
    slots?: { default: RNode[], hover: RNode[], pressed: RNode[] }
}

const PREFIX: Record<Intrinsic, string> = {
    panel: 'panel', stack: 'stack', grid: 'grid', image: 'image', label: 'label', button: 'button', collection_item: 'item', raw: 'raw',
}

function flatten(child: Child, out: (CNode | string)[] = []): (CNode | string)[] {
    if (child === null || child === undefined || child === false || child === true) return out
    if (Array.isArray(child)) { for (const c of child) flatten(c, out); return out }
    if (typeof child === 'string' || typeof child === 'number') { out.push(String(child)); return out }
    out.push(child)
    return out
}

/** 把组件、Fragment、Provider 展开成内置控件列表；裸字符串 = label */
function expand(child: Child): CNode[] {
    const out: CNode[] = []
    for (const c of flatten(child)) {
        if (typeof c === 'string') { out.push({ type: 'label', props: { text: c } }); continue }
        if (c.type === Fragment) { out.push(...expand(c.props.children)); continue }
        if (c.type === PROVIDER) {
            contextStack.push(new Map([[c.props.ctx, c.props.value]]))
            try { out.push(...expand(c.props.children)) } finally { contextStack.pop() }
            continue
        }
        if (typeof c.type === 'function') {
            // 组件里读到的 Context 要在它的子树展开完之前保持：先展开结果，再离开
            out.push(...expand((c.type as Component)(c.props)))
            continue
        }
        out.push(c)
    }
    return out
}

/** 展开整棵树（根可以是组件、片段或控件） */
export function resolve(root: Child, parentPath = ''): RNode[] {
    const list = expand(root)
    const used = new Map<string, number>()
    return list.map((c) => {
        const type = c.type as Intrinsic
        let name: string = c.props.name ?? `${PREFIX[type]}${used.get(PREFIX[type]) ?? 0}`
        if (c.props.name === undefined) used.set(PREFIX[type], (used.get(PREFIX[type]) ?? 0) + 1)
        const path = parentPath ? `${parentPath}/${name}` : name
        const { children, default: dflt, hover, pressed, ...props } = c.props
        const r: RNode = { type, name, path, props: type === 'button' ? props : { ...props, ...(dflt !== undefined ? { default: dflt } : {}) }, children: resolve(children, path) }
        if (type === 'button') {
            r.slots = { default: resolve(dflt, `${path}/default`), hover: resolve(hover, `${path}/hover`), pressed: resolve(pressed, `${path}/pressed`) }
        }
        return r
    })
}

/** 深度优先遍历 */
export function walk(nodes: RNode[], fn: (n: RNode, parent: RNode | undefined) => void, parent?: RNode): void {
    for (const n of nodes) {
        fn(n, parent)
        if (n.slots) for (const s of [n.slots.default, n.slots.hover, n.slots.pressed]) walk(s, fn, n)
        walk(n.children, fn, n)
    }
}
