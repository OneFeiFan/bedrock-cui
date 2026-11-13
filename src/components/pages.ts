/**
 * 客户端分页：一组单选开关切换页面，**不经过服务端**——整本书放在一个表单里，翻页不关表单、不重开（没有空档）。
 *
 *   const pages = new Pages({ group: 'book', start: 'home' })
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
import { Panel, Toggle, type LayoutOptions } from '../core/element.js'

export interface PagesOptions extends LayoutOptions {
    /** 开关组名：同时用作开关名前缀，要在整个界面里唯一 */
    group: string
    /** 初始页（缺省第一页） */
    start?: string
    /**
     * 服务端页码（混合翻页）：表单重新打开时，按 source 里的 `<prefix><页名>;` 显示那一页。
     * 一个隐藏的「服务端锚点」开关（序号 = 页数）初始选中：此时按服务端页码显示（没有页码 = 初始页）；
     * 用户点了任何翻页开关，锚点就不再选中，改由开关接管。
     * 用法：翻页箭头用 FormButton（服务端重开表单 = 鼠标不动也能连续翻，真机 1.4.0），目录 / 书签用开关（即时）。
     */
    server?: { source?: Expr, prefix?: string }
}

interface Entry { index: number, panel: Panel, links: Toggle[] }

export class Pages extends Panel {
    readonly group: string
    private readonly entries = new Map<string, Entry>()
    private readonly start?: string
    private readonly server?: { source: Expr, prefix: string, anchor: Toggle, flags: Map<string, Toggle> }

    constructor(options: PagesOptions) {
        const { group, start, server, ...rest } = options
        super({ size: ['100%', '100%'], ...rest })
        this.group = group
        this.start = start
        if (server) {
            // 服务端锚点：初始选中。序号在 finalize 时取「页数」（不与任何页冲突）——
            // ⚠️ 不能用 -1：toggle_group_forced_index 缺省就是 -1，意思是「不强制、按顺序自动分配」（真机 1.5.0：单选组乱掉、进不了子页面）
            const anchor = new Toggle({ name: `${group}__server`, group, index: 0, size: [0, 0] })
            this.add(anchor)
            this.server = { source: server.source ?? form.title, prefix: server.prefix ?? 'P:', anchor, flags: new Map() }
        }
    }

    /** 服务端打开到某页时，source 里要带的标记（例如 'P:sword;'，脚本拼进表单标题） */
    serverTag(key: string): string {
        return `${this.server?.prefix ?? 'P:'}${key};`
    }

    /** 取 / 建一页 */
    page(key: string, options: LayoutOptions = {}): Panel {
        const existing = this.entries.get(key)
        if (existing) return existing.panel
        const index = this.entries.size
        const panel = new Panel({ size: ['100%', '100%'], name: `${this.group}_${key}`, ...options })
        const anchor = new Toggle({ name: `${this.group}__${key}`, group: this.group, index, size: [0, 0] })
        this.add(anchor, panel)
        this.entries.set(key, { index, panel, links: [anchor] })
        return panel
    }

    /** 一个跳到 key 页的开关（放在树里任何地方；视觉加在它的状态面板里） */
    link(key: string, options: Omit<LayoutOptions, 'name'> & { name?: string } = {}): Toggle {
        const e = this.entries.get(key) ?? (this.page(key), this.entries.get(key)!)
        const t = new Toggle({ name: options.name ?? `${this.group}_${key}_l${e.links.length}`, group: this.group, index: e.index, ...options })
        e.links.push(t)
        return t
    }

    /** 第几页（从 0 起） */
    indexOf(key: string): number {
        return (this.entries.get(key) ?? (this.page(key), this.entries.get(key)!)).index
    }

    /**
     * 把一个自己构造的开关（例如继承 Toggle 的目录行、箭头、书签类）挂到 key 页：设好组名、序号、名字。
     * 构造时用 `pages.toggleOptions(key)` 拿到这些参数也可以。
     */
    attach(key: string, toggle: Toggle): Toggle {
        const e = this.entries.get(key) ?? (this.page(key), this.entries.get(key)!)
        toggle.props.group = this.group
        toggle.props.index = e.index
        toggle.name ??= `${this.group}_${key}_l${e.links.length}`
        e.links.push(toggle)
        return toggle
    }

    /** 构造跳到 key 页的开关所需的参数 */
    toggleOptions(key: string): { group: string, index: number } {
        return { group: this.group, index: this.indexOf(key) }
    }

    /**
     * 透明、无声的拦截层：一个指向 key 页（通常是弹层自己所在的页）的开关。
     * 真机：弹层下面的开关能被点穿；拦截层层级更高、先接住点击，点它不改变任何状态（选中的还是这一页）。
     */
    blocker(key: string, options: Omit<LayoutOptions, 'name'> & { name?: string } = {}): Toggle {
        const t = new Toggle({ ...this.toggleOptions(key), size: ['100%', '100%'], ...options, raw: { sound_volume: 0, ...(options.raw ?? {}) } })
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
        const serverIndex = this.entries.size
        const start = this.server ? serverIndex : this.entries.get(startKey)?.index ?? 0
        if (this.server) { this.server.anchor.props.index = serverIndex; this.server.anchor.props.defaultSelected = serverIndex }
        for (const [key, e] of this.entries) {
            for (const t of e.links) t.props.defaultSelected = start
            let visible = this.showing(key)
            if (this.server) {
                // 服务端锚点选中（刚打开表单）时：按 source 里的页码；没有页码时显示初始页。
                // 真机 1.5.2：一条表达式同时读开关状态与全局绑定时，开关变化不会触发重新计算 ⇒
                // 「标题里是不是这一页」放进一个只读标题的开关（stateFrom），页面显示条件只读开关状态
                const { source, prefix, anchor, flags } = this.server
                let byServer = source.contains(this.serverTag(key))
                if (key === startKey) byServer = byServer.or(source.contains(prefix).not())
                let flag = flags.get(key)
                if (!flag) {
                    flag = new Toggle({ name: `${this.group}__srv_${key}`, group: `${this.group}__srv_${key}`, radio: false, index: 0, size: [0, 0] })
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
