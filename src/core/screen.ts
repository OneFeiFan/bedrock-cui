/**
 * 界面（单文件、选项式）：一个文件中写数据（props）、逻辑（state、computed、methods、生命周期）与视图（view）。
 * 设计见 docs/design/screen-api.md。
 *
 *   export default defineScreen({
 *       id: 'cui_ui:shop',
 *       props: { greeting: '欢迎光临', item: { text: '钻石', icon: 'textures/items/diamond' } },
 *       state() { return { coins: 10 } },
 *       methods: { buy() { this.coins -= 1 } },
 *       view({ props, button }) {
 *           return new Panel().setSize(200, 120).add(new Label(props.greeting).setSize(180, 10), button('buy').setSize(60, 18))
 *       },
 *   })
 *
 * 视图在构建时运行一次：props.x 是占位（编译为读取第 n 个表单按钮的绑定），button(名字) 是可点击的按钮。
 * 序号与标记由本模块分配，写进清单（ScreenManifest），脚本端运行时按清单把名字映射回序号。
 */
import { Panel, type Element } from './element.js'
import { Size, type LengthLike } from './values.js'
import { PropRef } from './expr.js'
import { FormButton } from '../components/form.js'
import { Pages } from '../components/pages.js'
import { arrowTag, pagingButtons, type FormButtonSpec, type ServerPaging } from './serverPagesShared.js'
import { Timer } from './timer.js'

/** 一个 prop 的值：文字（数字按文字传递），或文字与图标 */
export type PropItem = string | number | { text: string, icon?: string }

/** props 声明中的类型：文字与图标（{ text, icon }） */
export class Item { private constructor() { } }

/** props 中的一项声明（同 Vue 的 props：{ type, default }） */
export interface PropSpec {
    /** 类型：String、Number（文字）、Boolean（是否显示）、Item（文字与图标）、Array（列表）、Timer（计时器） */
    type: StringConstructor | NumberConstructor | BooleanConstructor | ArrayConstructor | typeof Item | typeof Timer
    /** 默认值；省略时取类型的空值（''、0、false、{ text: '' }、[]）；Timer 必须写 */
    default?: unknown
    /** 列表的每一项：String（缺省）或 Item */
    of?: StringConstructor | typeof Item
    /** 列表最多的项数（Array 必须写） */
    max?: number
}

/** 视图中「方法」的引用：button().onClick(方法, …参数) */
export interface MethodRef { readonly __method: string }

/** 数据的种类：文字、文字与图标、是否显示、列表 */
export type DataKind = 'text' | 'item' | 'flag' | 'list'

/** 按钮的一个状态（default / hover / pressed）：add() 加入的控件显示在该状态下 */
export interface ButtonSlot { add(...items: Element[]): ScreenButton }

/**
 * button() 返回的按钮。内部是同一序号的两个表单按钮：普通版（聚焦优先级 10）与聚焦版（100，按钮文字含聚焦标记时显示）。
 * 表单因点击而重新打开时，脚本让刚才点击的按钮显示聚焦版、获得默认焦点：游戏只在鼠标移动时重新判断悬停，
 * 鼠标不动的点击交给默认焦点（真机，与服务端翻页箭头相同），不这样做的话连续点击会落到别的按钮上。
 * default / hover / pressed 与 add() 加入的控件同时放进两个版本（聚焦版放副本）。
 */
export class ScreenButton extends Panel {
    /** @internal */ readonly normal: FormButton
    /** @internal */ readonly focused: FormButton
    /** @internal onClick() 绑定的方法与参数 */
    binding?: { method: string, args: unknown[] }

    /**
     * 绑定点击时调用的方法：onClick(buy) 或带参数 onClick(buy, '钻石')（参数须可写成 JSON）。
     * 方法从视图的参数中解构得到；close 为内置的「关闭界面」
     */
    onClick(method: MethodRef, ...args: unknown[]): this {
        if (!method || typeof (method as MethodRef).__method !== 'string') throw new Error('onClick() 的第一个参数应是从视图参数中解构得到的方法，例如 view({ buy, button }) 中的 buy')
        // 参数写进清单（JSON）：只允许文字、有限的数字、布尔值、null、数组与普通对象（函数等会被 JSON 悄悄变成 null）
        const jsonable = (v: unknown): boolean => v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))
            || (Array.isArray(v) && v.every(jsonable))
            || (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype && Object.values(v as object).every(jsonable))
        if (!args.every(jsonable)) throw new Error('onClick() 的参数须能写成 JSON（文字、数字、布尔值、null、数组、普通对象）')
        this.binding = { method: method.__method, args }
        return this
    }
    constructor(index: number, tag: string, focusTag: string) {
        super()
        this.normal = new FormButton(index, tag, 1, 1).setName('normal').setFocusPrecedence(10)
        this.focused = new FormButton(index, focusTag, 1, 1).setName('focused').setFocusPrecedence(100)
        super.add(this.normal, this.focused)
    }
    private both(pick: (b: FormButton) => { add(...items: Element[]): unknown }): ButtonSlot {
        return { add: (...items: Element[]) => { pick(this.normal).add(...items); pick(this.focused).add(...items.map((e) => e.clone())); return this } }
    }
    /** 平时的外观 */
    get default(): ButtonSlot { return this.both((b) => b.default) }
    /** 鼠标悬停（或获得焦点）时的外观 */
    get hover(): ButtonSlot { return this.both((b) => b.hover) }
    /** 按下时的外观 */
    get pressed(): ButtonSlot { return this.both((b) => b.pressed) }
    /** 始终显示的内容（加进两个版本） */
    override add(...items: Parameters<Panel['add']>): this {
        if (!this.focused) return super.add(...items)
        const els = items.filter(Boolean).map((e) => (typeof e === 'string' ? e : e as Element))
        this.normal.add(...els)
        this.focused.add(...els.map((e) => (typeof e === 'string' ? e : e.clone())))
        return this
    }
    /** 尺寸（像素）；两个版本同步 */
    override get size(): Size | undefined { return super.size }
    override set size(v: Size | [LengthLike | string, LengthLike | string] | undefined) {
        super.size = v
        if (this.normal) { this.normal.size = v; this.focused.size = v }
    }
}

/**
 * 视图函数得到的参数：props、state、computed 中的值（占位，编译为读取表单按钮的绑定）与 methods 中的方法（供 onClick 引用），
 * 以及工具 button、close（与 pages，翻页用）。视图从中解构需要的名字，例如 view({ greeting, buy, button })
 */
export type ScreenViewContext = Record<string, any> & {
    /** 创建一个按钮，用 onClick(方法, …参数) 绑定点击时调用的方法 */
    button(): ScreenButton
    /** 内置的方法：关闭界面（button().onClick(close)） */
    close: MethodRef
}

/** 界面的选项 */
export interface ScreenOptions {
    /** 界面 id，以 cui_ui: 开头 */
    id: string
    /** 行为包脚本传给界面的数据：{ 名字: { type, default } } */
    props?: Record<string, PropSpec>
    /** 初始状态（游戏中运行，每个玩家一份） */
    state?(): Record<string, unknown>
    /** 由状态计算的值 */
    computed?: Record<string, (this: any) => unknown>
    /** 方法：视图中用 button().onClick(方法) 绑定 */
    methods?: Record<string, (this: any, ...args: any[]) => unknown>
    /**
     * 第一次打开前。逻辑中可用：this.名字（props、state、computed、methods）、this.player、this.mc（@minecraft/server）、this.close()、
     * this.emit(事件名, …)（脚本用 screen.on() 接收）、this.setInterval / this.setTimeout（界面关闭时自动取消）。
     * 界面文件在构建时会被 Node 导入，不能在开头导入游戏的脚本模块（@minecraft/*），用 this.mc
     */
    onOpen?(this: any): void
    /** 点击按钮、方法执行完之后，重新打开之前 */
    onUpdate?(this: any): void
    /** 玩家关闭表单，或调用 this.close() 后 */
    onClose?(this: any): void
    /** 视图：返回控件树（构建时运行一次）。有多页时不写 view，改写 pages */
    view?(ctx: ScreenViewContext): Element
    /**
     * 多页（服务端切换：切换时界面以那一页重新打开，鼠标不动也能连续点击）：{ 页名: (ctx) => 这一页的控件 }。
     * 页内的 ctx 另有 link(页名)、next()、prev()、back()，返回跳转用的按钮
     */
    pages?: Record<string, (ctx: ScreenViewContext & PageTools) => Element>
    /** 打开界面时显示的页（缺省为第一页） */
    start?: string
    /** 计时器结束时刷新一次（只对 Countdown 显示的计时器；缺省 true）：false 时不刷新，倒计时会滚过 0 一段时间 */
    timerEndRefresh?: boolean
    /** 各页共用的外框：ctx.page 是当前页放置的位置（缺省为铺满的容器） */
    layout?(ctx: ScreenViewContext & { page: Element }): Element
}

/** 页内的跳转：返回按钮，像 button() 一样设置外观（default、hover、pressed、add） */
export interface PageTools {
    /** 跳到某一页 */
    link(page: string): ScreenButton
    /** 按定义的顺序到下一页 / 上一页 */
    next(): ScreenButton
    prev(): ScreenButton
    /** 返回上一次所在的页（没有历史时不显示） */
    back(): ScreenButton
}

/** 一项数据占用的按钮（列表每项一个） */
export interface PropSlot { index: number, tag: string }

/** 构建生成的清单：名字与按钮序号的对应 */
export interface ScreenManifest {
    id: string
    /** 视图读取的数据：来源（prop / state / computed）、种类、占用的按钮、默认值（预览用） */
    data: { name: string, source: 'prop' | 'state' | 'computed', kind: DataKind, slots: PropSlot[], default: unknown, refreshAtEnd?: boolean, timerSeconds?: number }[]
    /** 按钮：tag 为普通版的标记，focusTag 为聚焦版的标记；method 与 args 为 onClick 绑定的方法与参数（__close 为关闭） */
    buttons: { index: number, tag: string, focusTag: string, method: string, args: unknown[] }[]
    /** 多页时「返回」按钮（各页共用一个序号；有历史时才显示） */
    back?: { index: number, tag: string, focusTag: string }
}

/** 视图中可用的工具名：不能用作 props、state、computed、methods 的名字 */
const TOOLS = ['button', 'close', 'link', 'back', 'next', 'prev', 'page']

/** 由值推断数据的种类（state 的初始值、computed 的示例值） */
function kindOfValue(v: unknown): DataKind | undefined {
    if (typeof v === 'boolean') return 'flag'
    if (typeof v === 'string' || typeof v === 'number' || v instanceof Timer) return 'text'
    if (Array.isArray(v)) return 'list'
    if (v && typeof v === 'object' && typeof (v as { text?: unknown }).text === 'string') return 'item'
    return undefined
}

/** props 声明 → 种类、默认值、列表长度 */
function readSpec(id: string, name: string, spec: unknown): { kind: DataKind, def: unknown, length: number } {
    const s = spec as PropSpec
    if (!s || typeof s !== 'object' || !('type' in s)) {
        throw new Error(`${id}：props.${name} 应写成声明，例如 { type: String, default: ${JSON.stringify(spec ?? '')} }`)
    }
    if (s.type === String || s.type === Number) return { kind: 'text', def: s.default ?? (s.type === Number ? 0 : ''), length: 1 }
    if (s.type === Boolean) return { kind: 'flag', def: s.default ?? false, length: 1 }
    if (s.type === Item) return { kind: 'item', def: s.default ?? { text: '' }, length: 1 }
    if (s.type === Timer) {
        if (!(s.default instanceof Timer)) throw new Error(`${id}：props.${name} 的类型是 Timer，须写默认值，例如 default: Timer.idle(10)`)
        return { kind: 'text', def: s.default, length: 1 }
    }
    if (s.type === Array) {
        if (!Number.isInteger(s.max) || (s.max as number) < 1) throw new Error(`${id}：props.${name} 是列表，须写最多的项数 max`)
        return { kind: 'list', def: s.default ?? [], length: s.max as number }
    }
    throw new Error(`${id}：props.${name} 的 type 应是 String、Number、Boolean、Item、Array 或 Timer`)
}

/** @internal props 声明的默认值（运行时：脚本没有传入时取它） */
export function _propDefault(id: string, name: string, spec: unknown): unknown { return readSpec(id, name, spec).def }

const textOf = (v: unknown): string => (v instanceof Timer ? v.toJSON() : v && typeof v === 'object' ? String((v as { text?: unknown }).text ?? '') : String(v))
const iconOf = (v: unknown): string => (v && typeof v === 'object' && !(v instanceof Timer) ? String((v as { icon?: unknown }).icon ?? '') : '')

/** 脚本端运行时（bedrock-cui/runtime/screens 注册；核心模块不依赖游戏的脚本 API） */
interface ScreenRuntimeHook {
    open(screen: Screen, player: { readonly id: string }, props?: Record<string, unknown>): void
    close(screen: Screen, player: { readonly id: string }): void
    isOpen(screen: Screen, player: { readonly id: string }): boolean
}
let runtimeHook: ScreenRuntimeHook | undefined
/** @internal 由 bedrock-cui/runtime/screens 注册 */
export function _setScreenRuntime(r: ScreenRuntimeHook): void { runtimeHook = r }
const hook = (): ScreenRuntimeHook => {
    if (!runtimeHook) throw new Error('界面的 open() / close() 只能在行为包脚本中使用：在脚本入口导入构建生成的 ./cui.generated.js')
    return runtimeHook
}

/** 一个界面 */
export class Screen {
    constructor(readonly options: ScreenOptions) {
        if (!options.id?.startsWith('cui_ui:')) throw new Error(`界面 id 必须以 cui_ui: 开头（收到 ${JSON.stringify(options.id)}）`)
        if (typeof options.view !== 'function' && !options.pages) throw new Error(`${options.id}：缺少 view()（只有一页时）或 pages（多页时）`)
        if (options.view && options.pages) throw new Error(`${options.id}：view 与 pages 只能写一个（多页时各页的内容写在 pages 中，共用的外框写在 layout 中）`)
        if (options.pages && options.start && !(options.start in options.pages)) throw new Error(`${options.id}：start 指定的页「${options.start}」不在 pages 中`)
    }

    /** 界面 id */
    get id(): string { return this.options.id }

    /** 最近一次 build() 中创建的页面组（previewForm 用来写入起始页的翻页箭头） */
    private lastPages: Pages[] = []

    /** 多页时的路由表（build() 之后可用；浏览器预览用） */
    paging(): ServerPaging | undefined {
        const p = this.lastPages[0]?.serverPaging(this.id)
        return p && (p.arrows.length || p.stay !== undefined) ? p : undefined
    }

    /** 为玩家打开界面（行为包脚本中）；props 为传给界面的数据，未传的取 computed 或默认值。已打开时更新 props 并重新显示 */
    open(player: { readonly id: string }, props?: Record<string, unknown>): void { hook().open(this, player, props) }
    /** 关闭玩家的这个界面（之后调用 onClose） */
    close(player: { readonly id: string }): void { hook().close(this, player) }
    /** 玩家是否打开着这个界面 */
    isOpen(player: { readonly id: string }): boolean { return hook().isOpen(this, player) }

    private listeners = new Map<string, Set<(player: any, ...args: any[]) => unknown>>()
    /**
     * 接收界面逻辑中 this.emit(事件名, …) 发出的事件（行为包脚本中登记）：处理和游戏打交道的事，例如给物品、扣金币。
     * 处理函数得到玩家与 emit 的参数；可以是异步的。界面在事件处理完之后才重新打开，处理中对界面的更新（open() 传入新数据、修改状态）合并为一次。
     */
    on(event: string, handler: (player: any, ...args: any[]) => unknown): this {
        let set = this.listeners.get(event)
        if (!set) this.listeners.set(event, (set = new Set()))
        set.add(handler)
        return this
    }
    /** 取消 on() 登记的处理函数 */
    off(event: string, handler: (player: any, ...args: any[]) => unknown): this {
        this.listeners.get(event)?.delete(handler)
        return this
    }
    /** @internal 运行时取事件的处理函数 */
    _listeners(event: string): ((player: any, ...args: any[]) => unknown)[] { return [...(this.listeners.get(event) ?? [])] }

    /** 构建视图：返回控件树与清单（构建时调用） */
    build(): { root: Element, manifest: ScreenManifest } {
        const { id, props = {}, methods = {}, computed = {} } = this.options
        // 名字不能重复，也不能是工具名
        const owner = new Map<string, string>()
        const stateInit: Record<string, unknown> = this.options.state ? this.options.state.call({}) ?? {} : {}
        for (const [group, names] of [['props', Object.keys(props)], ['state', Object.keys(stateInit)], ['computed', Object.keys(computed)], ['methods', Object.keys(methods)]] as const) {
            for (const n of names) {
                if (TOOLS.includes(n)) throw new Error(`${id}：${group}.${n} 与视图的工具名重名（${TOOLS.join('、')} 不能用作名字）`)
                if (owner.has(n)) throw new Error(`${id}：名字「${n}」同时出现在 ${owner.get(n)} 与 ${group} 中，名字不能重复`)
                owner.set(n, group)
            }
        }
        // computed 的示例值：用初始状态与 props 的默认值算一次（出错则为空文字），只用于推断种类与预览
        const sample: Record<string, unknown> = {}
        for (const [n, spec] of Object.entries(props)) sample[n] = readSpec(id, n, spec).def
        Object.assign(sample, stateInit)
        const sampleCtx: Record<string, unknown> = new Proxy(sample, { get: (t, k) => (typeof k === 'string' && k in computed ? (() => { try { return computed[k].call(sampleCtx) } catch { return '' } })() : t[k as string]) })

        let next = 0
        const alloc = () => next++
        const manifest: ScreenManifest = { id, data: [], buttons: [] }
        // 数据通道：视图第一次用到某个名字时分配按钮
        const channels = new Map<string, PropRef | PropRef[]>()
        const channel = (name: string): PropRef | PropRef[] => {
            const hit = channels.get(name)
            if (hit) return hit
            const source = owner.get(name) === 'props' ? 'prop' : owner.get(name) as 'state' | 'computed'
            let kind: DataKind, def: unknown, length = 1
            if (source === 'prop') ({ kind, def, length } = readSpec(id, name, props[name]))
            else {
                def = source === 'state' ? stateInit[name] : sampleCtx[name]
                const k = kindOfValue(def)
                if (!k) throw new Error(`${id}：${source}.${name} 的值不是文字、数字、布尔值、{ text, icon }、列表或计时器，视图不能直接显示（用 computed 转为文字）`)
                kind = k
                if (kind === 'list') length = Math.max(1, (def as unknown[]).length)
            }
            const slots: PropSlot[] = [], refs: PropRef[] = []
            for (let i = 0; i < length; i++) {
                const index = alloc(), tag = `@p${index}|`
                slots.push({ index, tag })
                const ref = new PropRef(kind === 'list' ? `${name}[${i}]` : name, index, tag)
                ref.defaultValue = kind === 'list' ? (def as unknown[])[i] : def
                refs.push(ref)
            }
            // 计时器：组件的速度按构建时的总时长决定，运行时据此检查传入的计时器
            manifest.data.push({ name, source, kind, slots, default: def, ...(def instanceof Timer ? { timerSeconds: def.seconds } : {}) })
            const out = kind === 'list' ? refs : refs[0]
            channels.set(name, out)
            return out
        }

        const buttons: ScreenButton[] = []
        const button = (): ScreenButton => {
            const index = alloc()
            const b = new ScreenButton(index, `@b${index}|`, `@b${index}|F`)
            buttons.push(b)
            return b
        }
        const created: Pages[] = []
        const tools: Record<string, unknown> = { button, close: { __method: '__close' } }

        const ctx = new Proxy({}, {
            get(_, key) {
                if (typeof key === 'symbol' || key === 'then' || key === 'toJSON') return undefined
                if (key in tools) return tools[key]
                if (owner.get(key) === 'methods') return { __method: key } satisfies MethodRef
                if (owner.has(key)) return channel(key)
                throw new Error(`${id}：视图中使用了未定义的名字「${key}」（在 props、state、computed 或 methods 中定义它）`)
            },
        }) as ScreenViewContext

        // 带工具的视图参数：页内的跳转、外框的 page
        const withTools = (extra: Record<string, unknown>) => new Proxy({}, { get: (_, key) => (typeof key === 'string' && key in extra ? extra[key] : (ctx as Record<string | symbol, unknown>)[key]) }) as ScreenViewContext

        let root: Element
        if (this.options.pages) {
            // 多页：内部用一组服务端翻页（标题带页名），页内的 link / next / prev 登记路由；back 各页共用一个序号
            const order = Object.keys(this.options.pages)
            const router = new Pages('page')._useAllocator(alloc).useServerPages().startAt(this.options.start ?? order[0]).setSize(Size.full())
            created.push(router)
            for (const name of order) {
                const at = order.indexOf(name)
                const link = (to: string): ScreenButton => {
                    if (!order.includes(to)) throw new Error(`${id}：link('${to}') 跳到的页不存在（页：${order.join('、')}）`)
                    const index = router._link(name, to, order.indexOf(to) > at ? 'next' : 'prev')
                    return new ScreenButton(index, arrowTag(index), arrowTag(index, true))
                }
                const tools: PageTools = {
                    link,
                    next: () => { if (at + 1 >= order.length) throw new Error(`${id}：「${name}」是最后一页，没有 next()`); return link(order[at + 1]) },
                    prev: () => { if (at === 0) throw new Error(`${id}：「${name}」是第一页，没有 prev()`); return link(order[at - 1]) },
                    back: () => {
                        if (!manifest.back) { const index = alloc(); manifest.back = { index, tag: `@back${index}|`, focusTag: `@back${index}|F` } }
                        return new ScreenButton(manifest.back.index, manifest.back.tag, manifest.back.focusTag)
                    },
                }
                router.page(name).add(this.options.pages[name](withTools(tools as unknown as Record<string, unknown>) as ScreenViewContext & PageTools))
            }
            root = this.options.layout ? this.options.layout(withTools({ page: router }) as ScreenViewContext & { page: Element }) : new Panel().setSize(Size.full()).add(router)
            root.add(router.stayButton())
        } else {
            root = this.options.view!(ctx)
        }
        // 计时器需要结束时刷新（Countdown 标记的数据通道）
        if (this.options.timerEndRefresh !== false) {
            for (const d of manifest.data) {
                const refs = channels.get(d.name)
                if ((Array.isArray(refs) ? refs : [refs]).some((r) => (r?._refreshAtEndCount ?? 0) > 0)) d.refreshAtEnd = true
            }
        }
        for (const b of buttons) {
            if (!b.binding) throw new Error(`${id}：有一个 button() 没有绑定方法：用 button().onClick(方法) 绑定`)
            manifest.buttons.push({ index: b.normal.index, tag: b.normal.tag, focusTag: b.focused.tag, method: b.binding.method, args: b.binding.args })
        }
        this.lastPages = created
        return { root, manifest }
    }

    /** 预览用的表单内容：数据的默认值按清单写进按钮（文字 = 标记 + 文字，图标），按钮写上标记 */
    previewForm(manifest = this.build().manifest): { buttons: string[], icons: string[] } {
        const buttons: string[] = [], icons: string[] = []
        for (const d of manifest.data) {
            const values: unknown[] = d.kind === 'list' ? (d.default as unknown[]) : [d.default]
            d.slots.forEach((s, i) => {
                const v = values[i]
                if (v === undefined || v === null || v === false || v === '') return
                if (v === true) { buttons[s.index] = s.tag; icons[s.index] = ''; return }
                buttons[s.index] = s.tag + textOf(v); icons[s.index] = iconOf(v)
            })
        }
        for (const b of manifest.buttons) { buttons[b.index] = b.tag; icons[b.index] = '' }
        // 翻页箭头：起始页的箭头与「原地不动」按钮
        for (const p of this.lastPages) {
            const paging = p.serverPaging(this.id)
            if (!paging.arrows.length && paging.stay === undefined) continue
            const own: Record<number, FormButtonSpec> = {}
            buttons.forEach((t, i) => { if (t !== undefined) own[i] = t })
            pagingButtons(paging, paging.start, 'next', own).forEach((t, i) => { if (t) buttons[i] = t })
        }
        return { buttons: Array.from(buttons, (x) => x ?? ''), icons: Array.from(icons, (x) => x ?? '') }
    }
}

/** 定义一个界面 */
export function defineScreen(options: ScreenOptions): Screen {
    return new Screen(options)
}
