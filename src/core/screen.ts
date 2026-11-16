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
import type { Size, LengthLike } from './values.js'
import { PropRef } from './expr.js'
import { FormButton } from '../components/form.js'
import { Pages } from '../components/pages.js'
import { pagingButtons, type FormButtonSpec } from './serverPagesShared.js'

/** 一个 prop 的值：文字（数字按文字传递），或文字与图标 */
export type PropItem = string | number | { text: string, icon?: string }
/** props 中的默认值：文字、文字与图标、是否显示（布尔值）、列表（数组，长度为最大项数） */
export type PropDefault = PropItem | boolean | PropItem[]

/** 按钮的一个状态（default / hover / pressed）：add() 加入的控件显示在该状态下 */
export interface ButtonSlot { add(...items: Element[]): ScreenButton }

/**
 * button(名字) 返回的按钮。内部是同一序号的两个表单按钮：普通版（聚焦优先级 10）与聚焦版（100，按钮文字含聚焦标记时显示）。
 * 表单因点击而重新打开时，脚本让刚才点击的按钮显示聚焦版、获得默认焦点：游戏只在鼠标移动时重新判断悬停，
 * 鼠标不动的点击交给默认焦点（真机，与服务端翻页箭头相同），不这样做的话连续点击会落到别的按钮上。
 * default / hover / pressed 与 add() 加入的控件同时放进两个版本（聚焦版放副本）。
 */
export class ScreenButton extends Panel {
    /** @internal */ readonly normal: FormButton
    /** @internal */ readonly focused: FormButton
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

/** 视图函数得到的参数 */
export interface ScreenViewContext {
    /** 界面的 props：props.x 是占位，用在 Label 的文字、Image 的贴图、setVisible() 上；列表用 props.x[i] */
    props: Record<string, any>
    /** 创建可点击的按钮；点击时调用 methods 中的同名方法 */
    button(name: string): ScreenButton
    /** 创建多页内容；其中的服务端翻页由框架处理 */
    pages(group: string): Pages
}

/** 界面的选项 */
export interface ScreenOptions {
    /** 界面 id，以 cui_ui: 开头 */
    id: string
    /** 视图接收的数据与默认值 */
    props?: Record<string, PropDefault>
    /** 初始状态（游戏中运行，每个玩家一份） */
    state?(): Record<string, unknown>
    /** 由状态计算的值；与 props 同名的项决定该 prop 的值 */
    computed?: Record<string, (this: any) => unknown>
    /** 方法；与 button() 同名的方法在按钮被点击时调用 */
    methods?: Record<string, (this: any, ...args: any[]) => unknown>
    /**
     * 第一次打开前。逻辑中可用：this.player、this.close()、this.refresh()、this.emit(事件名, …)（脚本用 screen.on() 接收）、
     * this.setInterval(函数, 刻数) / this.setTimeout(函数, 刻数)（界面关闭时自动取消）。
     * 界面文件在构建时会被 Node 导入，不能在开头导入游戏的脚本模块（@minecraft/*）
     */
    onOpen?(this: any): void
    /** 因状态变化重新打开后 */
    onUpdate?(this: any): void
    /** 玩家关闭表单，或调用 this.close() 后 */
    onClose?(this: any): void
    /** 视图：返回控件树（构建时运行） */
    view(ctx: ScreenViewContext): Element
}

/** 一个 prop 占用的按钮（列表每项一个） */
export interface PropSlot { index: number, tag: string }

/** 构建生成的清单：名字与按钮序号的对应 */
export interface ScreenManifest {
    id: string
    props: { name: string, kind: 'text' | 'item' | 'flag' | 'list', slots: PropSlot[], default: PropDefault }[]
    /** 按钮：tag 为普通版的标记；focusTag 为聚焦版的标记（因点击而重新打开时，刚才点击的按钮发送它） */
    buttons: { name: string, index: number, tag: string, focusTag: string }[]
}

const kindOf = (v: PropDefault): 'text' | 'item' | 'flag' | 'list' =>
    Array.isArray(v) ? 'list' : typeof v === 'boolean' ? 'flag' : typeof v === 'string' || typeof v === 'number' ? 'text' : 'item'

const textOf = (v: PropItem): string => (typeof v === 'object' ? v.text : String(v))
const iconOf = (v: PropItem): string => (typeof v === 'object' ? v.icon ?? '' : '')

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
        if (typeof options.view !== 'function') throw new Error(`${options.id}：缺少 view()`)
    }

    /** 界面 id */
    get id(): string { return this.options.id }

    /** 最近一次 build() 中创建的页面组（previewForm 用来写入起始页的翻页箭头） */
    private lastPages: Pages[] = []

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
        const { id, props = {}, methods = {} } = this.options
        let next = 0
        const alloc = () => next++
        const manifest: ScreenManifest = { id, props: [], buttons: [] }

        // props：按定义的顺序分配按钮
        const refs: Record<string, PropRef | PropRef[]> = {}
        for (const [name, def] of Object.entries(props)) {
            const kind = kindOf(def)
            const count = kind === 'list' ? (def as PropItem[]).length : 1
            const slots: PropSlot[] = []
            const list: PropRef[] = []
            for (let i = 0; i < count; i++) {
                const index = alloc()
                const tag = `@p${index}|`
                slots.push({ index, tag })
                list.push(new PropRef(kind === 'list' ? `${name}[${i}]` : name, index, tag))
            }
            refs[name] = kind === 'list' ? list : list[0]
            manifest.props.push({ name, kind, slots, default: def })
        }
        const propsProxy = new Proxy(refs, {
            get(target, key) {
                if (typeof key === 'symbol' || key === 'then' || key === 'toJSON') return undefined
                if (!(key in target)) throw new Error(`${id}：使用了未定义的 prop「${key}」（在 props 中定义它）`)
                return target[key]
            },
        })

        // button(名字)：必须有同名方法；同一名字只能创建一次
        const buttons = new Set<string>()
        const button = (name: string): ScreenButton => {
            if (typeof methods[name] !== 'function') throw new Error(`${id}：button('${name}') 没有同名的方法（在 methods 中添加 ${name}()）`)
            if (buttons.has(name)) throw new Error(`${id}：button('${name}') 创建了两次`)
            buttons.add(name)
            const index = alloc()
            const tag = `@b${index}|`, focusTag = `@b${index}|F`
            manifest.buttons.push({ name, index, tag, focusTag })
            return new ScreenButton(index, tag, focusTag).setName(name)
        }

        const created: Pages[] = []
        const pages = (group: string): Pages => { const p = new Pages(group)._useAllocator(alloc).useServerPages(); created.push(p); return p }

        const root = this.options.view({ props: propsProxy, button, pages })
        this.lastPages = created
        return { root, manifest }
    }

    /** 预览用的表单内容：props 的默认值按清单写进按钮（文字 = 标记 + 文字，图标），按钮写上标记 */
    previewForm(manifest = this.build().manifest): { buttons: string[], icons: string[] } {
        const buttons: string[] = [], icons: string[] = []
        for (const p of manifest.props) {
            const values: (PropItem | boolean)[] = p.kind === 'list' ? (p.default as PropItem[]) : [p.default as PropItem | boolean]
            p.slots.forEach((s, i) => {
                const v = values[i]
                if (typeof v === 'boolean') { buttons[s.index] = v ? s.tag : ''; icons[s.index] = '' }
                else if (v !== undefined) { buttons[s.index] = s.tag + textOf(v); icons[s.index] = iconOf(v) }
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
