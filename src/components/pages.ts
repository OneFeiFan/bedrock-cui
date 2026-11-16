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
import { Panel, Toggle } from '../core/element.js'
import { Anchor, Size } from '../core/values.js'
import { FormButton } from './form.js'
import { STAY_TAG, arrowTag, type ServerArrowRoute, type ServerPaging } from '../core/serverPagesShared.js'
import type { Element } from '../core/element.js'

interface Entry { index: number, panel: Panel, links: Toggle[] }

export class Pages extends Panel {
    private _group: string
    private readonly entries = new Map<string, Entry>()
    private _start?: string
    /** 服务端分页的策略：title = 标题带页码 + 锚点 + 页码开关（静态界面，真机 1.5.4 验证）；routes = 每页一个路由（路由界面） */
    private serverMode?: { kind: 'title', source: Expr, prefix: string, anchor: Toggle, flags: Map<string, Toggle> } | { kind: 'routes' }

    /** group = 开关组名（同时用作开关名前缀，要在整个界面里唯一） */
    constructor(group: string) {
        super()
        this.setSize(Size.full())
        this._group = group
    }

    /** 开关组名（同时是开关名前缀）。只能在还没有页面时改：页面的开关创建时就带上了组名 */
    get group(): string { return this._group }
    set group(v: string) {
        if (this.entries.size && v !== this._group) throw new Error(`Pages 的组名要在创建页面之前定（已有 ${this.entries.size} 页用了「${this._group}」）`)
        this._group = v
    }
    setGroup(v: string): this { this.group = v; return this }
    /** 初始页（缺省第一页） */
    get start(): string | undefined { return this._start }
    set start(v: string | undefined) { this._start = v }
    setStart(key: string): this { this._start = key; return this }
    /** 同 setStart */
    startAt(key: string): this { return this.setStart(key) }
    /** 服务端页码（useServerPages 的设置）；赋值 = useServerPages(source, prefix) */
    get server(): { source: Expr, prefix: string } | undefined {
        const m = this.serverMode
        return m && m.kind === 'title' ? { source: m.source, prefix: m.prefix } : undefined
    }
    set server(v: { source?: Expr, prefix?: string } | undefined) { if (v) this.useServerPages(v.source, v.prefix) }
    setServer(source: Expr = form.title, prefix = 'P:'): this { return this.useServerPages(source, prefix) }

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

    // ───────── 混合翻页：服务端翻页箭头（真机 1.4.0–1.26.0 验证的做法，脚本端配 cui/runtime/server-pages 的 ServerPagesForm） ─────────

    private arrows: ServerArrowRoute[] = []
    private buttonBase = 10
    private nextButton?: number
    private stayIndex?: number

    /** 服务端翻页按钮从第几个表单按钮开始分配（缺省 10；前面的序号留给界面自己的表单按钮） */
    setButtonBase(n: number): this {
        if (this.nextButton !== undefined) throw new Error('setButtonBase 要在第一个 serverArrow / stayButton 之前调用')
        this.buttonBase = n
        return this
    }
    private allocButton(): number {
        if (this.allocator) return this.allocator()
        const i = this.nextButton ?? this.buttonBase; this.nextButton = i + 1; return i
    }
    private allocator?: () => number
    /** @internal 界面（defineScreen）的翻页按钮与 props、按钮共用一个序号分配器 */
    _useAllocator(f: () => number): this { this.allocator = f; return this }

    /**
     * 翻页箭头（服务端）：点了关掉表单，脚本按新页码重开。由两个**序号相同**的表单按钮组成——普通版（优先级 10）与聚焦版（文字带 F，优先级 100）；
     * 脚本重开时给「刚才点击方向」的箭头加 F，鼠标不动也能连续翻页。art(hover) 每次调用都要返回新的元素（普通 / 悬停 / 按下各用一份）。
     * 需要 useServerPages()；返回的面板自己摆放位置（setAnchor / setOffset）。
     */
    serverArrow(from: string, to: string, dir: 'prev' | 'next', art: (hover: boolean) => Element | Element[], width: number, height: number): Panel {
        if (this.serverMode?.kind !== 'title') this.useServerPages()
        const index = this.allocButton()
        this.arrows.push({ index, from, to, dir })
        const box = new Panel().setSize(width, height)
        const list = (e: Element | Element[]) => (Array.isArray(e) ? e : [e])
        for (const [focused, precedence] of [[false, 10], [true, 100]] as const) {
            const b = new FormButton(index, arrowTag(index, focused), width, height).setFocusPrecedence(precedence)
            b.default.add(...list(art(false))); b.hover.add(...list(art(true))); b.pressed.add(...list(art(true)))
            box.add(b)
        }
        return box
    }

    /**
     * 「原地不动」：透明的表单按钮（1×1，优先级 50——介于聚焦版箭头 100 与普通箭头 10 之间）。当前方向没有箭头时（例如最后一页再点「下一页」），
     * 鼠标没动的点击交给它，脚本原样重开当前页（真机 1.5.3：否则落到反方向的箭头，来回循环）。放在界面里任意位置即可。
     */
    stayButton(): FormButton {
        if (this.stayIndex !== undefined) throw new Error('每组 Pages 只要一个 stayButton')
        this.stayIndex = this.allocButton()
        return new FormButton(this.stayIndex, STAY_TAG, 1, 1).setName(`${this.group}__stay`).setAnchor(Anchor.TOP_LEFT).setFocusPrecedence(50)
    }

    /** 翻页路由表（给脚本端 ServerPagesForm）：界面 id 即表单标题的前缀，例如 'cui_ui:my_book' */
    serverPaging(panelId: string): ServerPaging {
        const prefix = this.serverMode?.kind === 'title' ? this.serverMode.prefix : 'P:'
        return { title: panelId, prefix, start: this._start ?? [...this.entries.keys()][0], arrows: this.arrows.map((a) => ({ ...a })), ...(this.stayIndex !== undefined ? { stay: this.stayIndex } : {}) }
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
        const startIndex = this.entries.get(this._start ?? [...this.entries.keys()][0])?.index ?? 0
        return {
            base: { '$toggle_group_default_selected|default': startIndex },
            variants: Object.fromEntries([...this.entries].map(([key, e]) => [key, { $toggle_group_default_selected: e.index }])),
        }
    }

    /** 取 / 建一页 */
    page(key: string): Panel {
        const existing = this.entries.get(key)
        if (existing) return existing.panel
        const index = this.entries.size
        const panel = new Panel().setName(`${this.group}_${key}`).setSize(Size.full())
        const anchor = new Toggle(this.group, index).setName(`${this.group}__${key}`).setSize(0, 0)
        this.add(anchor, panel)
        this.entries.set(key, { index, panel, links: [anchor] })
        return panel
    }

    /** 一个跳到 key 页的开关（放在树里任何地方；视觉加在它的状态面板里） */
    link(key: string): Toggle {
        const e = this.entries.get(key) ?? (this.page(key), this.entries.get(key)!)
        const t = new Toggle(this.group, e.index).setName(`${this.group}_${key}_l${e.links.length}`)
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

    /**
     * 透明、无声的拦截层：一个指向 key 页（通常是弹层自己所在的页）的开关。
     * 真机：弹层下面的开关能被点穿；拦截层层级更高、先接住点击，点它不改变任何状态（选中的还是这一页）。
     */
    blocker(key: string): Toggle {
        const t = new Toggle(this.group, this.indexOf(key)).setSize(Size.full()).setRaw('sound_volume', 0)
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
        const startKey = this._start ?? [...this.entries.keys()][0]
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
