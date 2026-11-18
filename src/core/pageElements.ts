/**
 * 页面与跳转（第 21 节）：Page、Router（服务端切换的一组子页面）、Tabs（客户端切换的一组子页面），
 * 以及跳转元素 Link、Back、Prev、Next、Close。它们在界面构建（Screen.build）时展开与解析：
 * 页面组调用子页面函数，跳转元素找到所属的页面组，具体化为服务端按钮（Router、Close）或客户端开关（Tabs）。
 */
import { Button, Element, Panel, statePanel } from './element.js'
import { Size } from './values.js'

/** 页面函数：参数是使用者在 props、state、computed、methods 中定义的名字，返回这一页的内容（通常是一个 Page） */
export type PageFunction = (data: any) => Element

/** 一页内容。放在页面组中时缺省铺满页面组 */
export class Page extends Panel {
    constructor() {
        super()
        this.setSize(Size.full())
    }
}

/** 页面组的共同部分 */
abstract class PageGroup extends Panel {
    /** 子页面（按定义的顺序） */
    readonly routes: Record<string, PageFunction>
    /** 一开始显示的子页面（缺省为第一个） */
    start?: string
    constructor(routes: Record<string, PageFunction>, kind: string) {
        super()
        if (!routes || typeof routes !== 'object' || !Object.keys(routes).length) throw new Error(`${kind} 需要至少一个子页面：new ${kind}({ 名称: 页面函数 })`)
        for (const [name, fn] of Object.entries(routes)) {
            if (typeof fn !== 'function') throw new Error(`${kind} 的子页面「${name}」应是页面函数，例如 ${name}: (data) => new Page()`)
            if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error(`${kind} 的子页面名称「${name}」只能由字母、数字、下划线与连字符组成`)
        }
        this.routes = routes
        this.setSize(Size.full())
    }
    /** 一开始显示的子页面 */
    startAt(name: string): this {
        if (!(name in this.routes)) throw new Error(`startAt('${name}')：没有这个子页面（有：${Object.keys(this.routes).join('、')}）`)
        this.start = name
        return this
    }
}

/** 一组子页面，由服务端切换：界面以那一页重新打开，鼠标不动也能连续点击「下一页」。每个界面最多一个 */
export class Router extends PageGroup {
    constructor(routes: Record<string, PageFunction>) { super(routes, 'Router') }
}

/** 一组子页面，由客户端切换：表单不关闭，切换是即时的；界面重新打开后回到 startAt 指定的页 */
export class Tabs extends PageGroup {
    constructor(routes: Record<string, PageFunction>) { super(routes, 'Tabs') }
}

/** 跳转元素的共同部分：按钮的三个状态，另有 selected（目标页正在显示时显示） */
export abstract class NavButton extends Button {
    /** 目标页正在显示时的外观（例如高亮当前的标签） */
    readonly selected = statePanel()
    /** @internal 跳转的种类 */
    abstract readonly nav: 'link' | 'back' | 'next' | 'prev'
    /** @internal 指明的页面组（组名，即页面组元素的 setName） */
    readonly groupName?: string
    constructor(groupName?: string) {
        super()
        this.groupName = groupName
    }
}

/** 跳到子页面：new Link('页名')，或指明页面组 new Link('组名:页名') */
export class Link extends NavButton {
    readonly nav = 'link' as const
    /** 目标页 */
    readonly target: string
    constructor(target: string) {
        const i = target.indexOf(':')
        super(i >= 0 ? target.slice(0, i) : undefined)
        this.target = i >= 0 ? target.slice(i + 1) : target
        if (!this.target) throw new Error(`new Link('${target}')：缺少页名`)
    }
}

/** 返回上一次所在的页（Router）；没有历史时自动隐藏 */
export class Back extends NavButton { readonly nav = 'back' as const }
/** 按定义的顺序到下一页；没有下一页时自动隐藏 */
export class Next extends NavButton { readonly nav = 'next' as const }
/** 按定义的顺序到上一页；没有上一页时自动隐藏 */
export class Prev extends NavButton { readonly nav = 'prev' as const }

/** 关闭界面 */
export class Close extends Button {
    constructor() {
        super()
        this.binding = { method: '__close', args: [] }
    }
}
