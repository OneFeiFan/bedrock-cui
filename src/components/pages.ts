/**
 * 客户端分页：一组单选开关切换页面，**不经过服务端**——整本书放在一个表单里，翻页不关表单、不重开（没有空档）。
 *
 *   const pages = new Pages('book').startAt('home')
 *   const home = pages.page('home')          // 一页（Panel），往里加内容
 *   const sword = pages.page('sword')
 *   const link = pages.link('sword', {...})  // 一个跳到 sword 页的开关，可以放在树里任何地方（目录行、箭头、书签）
 *   link.unchecked.add(...); link.checkedHover.add(...)
 *
 * 显示条件：每页 visible = 「任意一个指向本页的开关被选中」。单选组任一时刻只有一个开关选中，所以无论引擎会不会把
 * 同序号的开关一起选中，结果都对。每页还有一个零尺寸的锚点开关，承载初始选中（toggle_group_default_selected）。
 * 再开一个 Pages（不同 group）就是相互独立的另一组状态（例如物品详情弹层：关掉后回到原来那页）。
 */
import { form, toggleState, type Expr } from '../core/expr.js'
import { Panel, Toggle, type LayoutOptions, isOptions, _applyOptions } from '../core/element.js'
import { Size } from '../core/values.js'

export interface PagesOptions extends LayoutOptions {
    /** 开关组名：同时用作开关名前缀，要在整个界面里唯一 */
    group: string
    /** 初始页（缺省第一页） */
    start?: string
    /**
     * 服务端页码（混合翻页）：表单重新打开时，按 source 里的 `<prefix><页名>;` 显示那一页。
     * 一个隐藏的「服务端锚点」开关（序号 = 页数）初始选中：此时按服务端页码显示（没有页码 = 初始页；脚本最好总是带页码）；
     * 用户点了任何翻页开关，锚点就不再选中，改由开关接管。
     * 用法：翻页箭头用 FormButton（服务端重开表单 = 鼠标不动也能连续翻，真机 1.4.0），目录 / 书签用开关（即时）。
     */
    server?: { source?: Expr, prefix?: string }
}

interface Entry { index: number, panel: Panel, links: Toggle[] }

export class Pages extends Panel {
    readonly group: string
    private readonly entries = new Map<string, Entry>()
    private start?: string
    /** 服务端分页的策略：title = 标题带页码 + 锚点 + 页码开关（静态界面，真机 1.5.4 验证）；routes = 每页一个路由（路由界面） */
    private serverMode?: { kind: 'title', source: Expr, prefix: string, anchor: Toggle, flags: Map<string, Toggle> } | { kind: 'routes' }

    /** group = 开关组名（同时用作开关名前缀，要在整个界面里唯一） */
    constructor(group: string)
    /** @deprecated 用 new Pages(组名).startAt(...).useServerPages(...) */
    constructor(options: PagesOptions)
    constructor(a: string | PagesOptions) {
        const { group, start, server, ...rest } = isOptions(a) ? a as PagesOptions : { group: a as string } as PagesOptions
        super({ size: ['100%', '100%'], ...rest })
        this.group = group
        this.start = start
        if (server) this.useServerPages(server.source, server.prefix)
    }

    /** 初始页（缺省第一页） */
    startAt(key: string): this { this.start = key; return this }

    /**
     * 服务端页码（混合翻页，**静态界面**用；真机 1.5.4 验证）：脚本把标题写成 `<界面 id>|P:<页名>;`（titleFor），
     * 一个隐藏的「服务端锚点」开关（序号 = 页数）初始选中时，按每页一个「页码开关」（只读标题，stateFrom）显示那一页；
     * 用户点了目录 / 书签这些开关，锚点不再选中，由开关接管。页面显示条件只读开关状态。
     * 翻页箭头用 FormButton 走服务端（新屏幕按默认聚焦：鼠标不动也能连点），目录 / 书签用 link() 开关（即时）。
     */
    useServerPages(source: Expr = form.title, prefix = 'P:'): this {
        if (this.serverMode) return this
        // ⚠️ 锚点序号不能用 -1（= 不强制、自动分配，真机 1.5.0）；finalize 时取「页数」
        const anchor = new Toggle(this.group, 0).setName(`${this.group}__server`).setSize(0, 0)
        this.add(anchor)
        this.serverMode = { kind: 'title', source, prefix, anchor, flags: new Map() }
        return this
    }

    /** 静态界面的服务端分页：表单标题 `<界面 id>|P:<页名>;` */
    titleFor(panelId: string, key: string): string {
        const prefix = this.serverMode?.kind === 'title' ? this.serverMode.prefix : 'P:'
        return `${panelId}|${prefix}${key};`
    }

    /**
     * 服务端分页（**路由界面**用）：每一页一个路由——标题 `<界面 id>/<页名>`（serverTitle）路由到「同一个界面 + 一个变量」，
     * 变量是这组开关的初始选中序号（原版 common.toggle 用 |default 声明，会继承祖先设的值）。配合 serverForm 的 routes: pages.serverRoutes()。
     * ⚠️ 真机 1.10.0 / 1.12.0：路由界面由工厂在表单打开之后才创建，默认聚焦不可靠（翻页箭头鼠标不动连点会乱跳；焦点交接也无效）——要连点翻页请用静态界面 + useServerPages()。
     */
    useRoutePages(): this { if (!this.serverMode) this.serverMode = { kind: 'routes' }; return this }

    /** 服务端路由：基础路由 = 初始页；`页名` 路由 = 那一页（给 serverForm 的 routes） */
    serverRoutes(): { base: Record<string, unknown>, variants: Record<string, Record<string, unknown>> } {
        const startIndex = this.entries.get(this.start ?? [...this.entries.keys()][0])?.index ?? 0
        return {
            base: { '$toggle_group_default_selected|default': startIndex },
            variants: Object.fromEntries([...this.entries].map(([key, e]) => [key, { $toggle_group_default_selected: e.index }])),
        }
    }

    /** 取 / 建一页 */
    page(key: string, options: LayoutOptions = {}): Panel {
        const existing = this.entries.get(key)
        if (existing) return existing.panel
        const index = this.entries.size
        const panel = new Panel().setName(`${this.group}_${key}`).setSize(Size.full())
        _applyOptions(panel, options)
        const anchor = new Toggle(this.group, index).setName(`${this.group}__${key}`).setSize(0, 0)
        this.add(anchor, panel)
        this.entries.set(key, { index, panel, links: [anchor] })
        return panel
    }

    /** 一个跳到 key 页的开关（放在树里任何地方；视觉加在它的状态面板里） */
    link(key: string, options: Omit<LayoutOptions, 'name'> & { name?: string } = {}): Toggle {
        const e = this.entries.get(key) ?? (this.page(key), this.entries.get(key)!)
        const t = new Toggle(this.group, e.index).setName(options.name ?? `${this.group}_${key}_l${e.links.length}`)
        _applyOptions(t, { ...options, name: undefined })
        e.links.push(t)
        return t
    }

    /** 第几页（从 0 起） */
    indexOf(key: string): number {
        return (this.entries.get(key) ?? (this.page(key), this.entries.get(key)!)).index
    }

    /**
     * 把一个自己构造的开关（例如继承 Toggle 的目录行、箭头、书签类）挂到 key 页：设好组名、序号、名字。
     * 继承 Toggle 的类在构造函数里写 `super(pages.group, pages.indexOf(key))`，再 `pages.attach(key, this)`。
     */
    attach(key: string, toggle: Toggle): Toggle {
        const e = this.entries.get(key) ?? (this.page(key), this.entries.get(key)!)
        toggle.props.group = this.group
        toggle.props.index = e.index
        toggle.name ??= `${this.group}_${key}_l${e.links.length}`
        e.links.push(toggle)
        return toggle
    }

    /** @deprecated 构造跳到 key 页的开关所需的参数（给参数对象写法用）。改用 `new Toggle(pages.group, pages.indexOf(key))` + `pages.attach(key, 开关)`，或 `pages.link(key)` */
    toggleOptions(key: string): { group: string, index: number } {
        return { group: this.group, index: this.indexOf(key) }
    }

    /**
     * 透明、无声的拦截层：一个指向 key 页（通常是弹层自己所在的页）的开关。
     * 真机：弹层下面的开关能被点穿；拦截层层级更高、先接住点击，点它不改变任何状态（选中的还是这一页）。
     */
    blocker(key: string, options: Omit<LayoutOptions, 'name'> & { name?: string } = {}): Toggle {
        const t = new Toggle(this.group, this.indexOf(key)).setSize(Size.full()).setRaw('sound_volume', 0)
        _applyOptions(t, { ...options, raw: { sound_volume: 0, ...(options.raw ?? {}) } })
        return this.attach(key, t)
    }

    /** 某页「正在显示」的表达式（例如书签的选中样式用） */
    showing(key: string): Expr {
        const e = this.entries.get(key)
        if (!e) throw new Error(`没有这一页：${key}`)
        return e.links.map((t) => toggleState(t.name!)).reduce((a, b) => a.or(b))
    }

    pageKeys(): string[] { return [...this.entries.keys()] }

    protected override beforeFinalize(): void {
        const startKey = this.start ?? [...this.entries.keys()][0]
        const startIndex = this.entries.get(startKey)?.index ?? 0
        const mode = this.serverMode
        const pagesCount = this.entries.size
        if (mode?.kind === 'title') { mode.anchor.props.index = pagesCount; mode.anchor.props.defaultSelected = pagesCount }
        for (const [key, e] of this.entries) {
            for (const t of e.links) {
                if (mode?.kind === 'routes') {
                    // 不写死：从路由设在祖先上的变量继承（预览按 serverDefault 当初始页）
                    t.props.defaultSelected = undefined
                    t.props.inheritDefaultSelected = true
                    t.props.serverDefault = startIndex
                } else {
                    t.props.defaultSelected = mode?.kind === 'title' ? pagesCount : startIndex
                }
            }
            let visible = this.showing(key)
            if (mode?.kind === 'title') {
                // 服务端锚点选中（刚打开表单）时按标题里的页码；没有页码时显示初始页（写成 (标题 − 前缀) = 标题，不写 not (not …)——真机 1.5.3）。
                // 「标题里是不是这一页」放进一个只读标题的开关（stateFrom）：一条表达式同时读开关状态与全局绑定时，开关变化不会触发重新计算（真机 1.5.2）
                const { source, prefix, anchor, flags } = mode
                let byServer = source.contains(`${prefix}${key};`)
                if (key === startKey) byServer = byServer.or(source.minus(prefix).eq(source))
                let flag = flags.get(key)
                if (!flag) {
                    flag = new Toggle(`${this.group}__srv_${key}`, 0).setName(`${this.group}__srv_${key}`).setRadio(false).setSize(0, 0)
                    flags.set(key, flag)
                    this.add(flag)
                }
                flag.props.stateFrom = byServer
                visible = visible.or(toggleState(anchor.name!).and(toggleState(flag.name!)))
            }
            e.panel.props.visible = visible
        }
    }


}
