/**
 * 实验：**路由界面**上的服务端翻页 + 默认聚焦（与静态的测试书对照）。
 *
 * 真机 1.10.0：测试书改成路由界面后，翻页能显示，但鼠标不动连点「下一页」会乱跳（点击落到「上一页」或右上角 ×）——
 * 怀疑路由界面由工厂在表单打开之后才创建，游戏决定默认聚焦时箭头还不存在。测试书已改回静态界面；这里留一个小的路由版，
 * 箭头 / 聚焦写法与测试书完全相同（普通版 + 聚焦版两个同序号的表单按钮、「原地不动」），只差在「路由界面」。
 */
import { Anchor, Color, FormButton, Image, Label, Length, Pages, Panel, Size, Texture, TextStyle } from 'cui'

/** 两个对照：指南针 = 路由界面（无焦点交接）；时钟 = 路由界面 + 焦点交接（静态部分的透明缓冲按钮） */
export const FOCUS_ROUTED = { title: 'cui_ui:focus_routed', group: 'frt', heading: '§l路由版翻页（无交接）', handoff: false }
export const FOCUS_SINK = { title: 'cui_ui:sink_routed', group: 'frs', heading: '§l路由版翻页 + 焦点交接', handoff: true }

const BOOK = Texture.of('textures/cui_test/book').withSize(272, 180)
const ARROW = {
    left: Texture.of('textures/cui_test/arrow_left').withSize(20, 12),
    leftHover: Texture.of('textures/cui_test/arrow_left_hover').withSize(20, 12),
    right: Texture.of('textures/cui_test/arrow_right').withSize(20, 12),
    rightHover: Texture.of('textures/cui_test/arrow_right_hover').withSize(20, 12),
}
const BIG = TextStyle.of(Color.hex('#3d2108')).withScale(4)
const BODY = TextStyle.of(Color.hex('#45301c'))

/** 「原地不动」按钮的序号 */
export const FOCUS_STAY = 20

/** 一个翻页箭头 = 两个同序号的表单按钮：普通版（聚焦优先级 10）+ 聚焦版（文字带 F 才显示，优先级 100） */
class Arrow extends Panel {
    constructor(routes, from, target, dir) {
        super()
        this.setSize(28, 18).setAnchor(Anchor.TOP_LEFT).setOffset(dir === 'left' ? 10 : 234, 156)
        const index = routes.length
        routes.push({ index, from, target, dir })
        const art = (hover) => new Image(dir === 'left' ? (hover ? ARROW.leftHover : ARROW.left) : (hover ? ARROW.rightHover : ARROW.right)).setSize(20, 12)
        for (const [tag, precedence] of [[`go${index}|`, 10], [`go${index}|F`, 100]]) {
            const b = new FormButton(index, tag, 28, 18).setFocusPrecedence(precedence)
            b.default.add(art(false)); b.hover.add(art(true)); b.pressed.add(art(true))
            this.add(b)
        }
    }
}

/** 生成一个路由版翻页界面；返回 { content, pages, routes }（routes：箭头序号 → { 所在页, 目标页, 方向 }） */
export function buildFocusRouted(config) {
    const routes = []
    const root = new Panel().setSize(272, 180)
    root.add(new Image(BOOK).setSize(Size.full()))
    const pages = new Pages(config.group).startAt('p1').useRoutePages()
    const keys = ['p1', 'p2', 'p3']
    keys.forEach((key, i) => {
        const page = pages.page(key)
        page.add(new Label(config.heading, BODY).setAnchor(Anchor.TOP_CENTER).setOffset(0, 16))
        page.add(new Label(`${i + 1}`, BIG).setAnchor(Anchor.CENTER).setOffset(0, -6))
        page.add(new Label('鼠标停在右下箭头上不动，连点；看聊天栏收到的按钮是否乱跳', BODY).setSize(Length.pct(80), Length.auto()).setAlign('center').setAnchor(Anchor.BOTTOM_CENTER).setOffset(0, -32))
        if (i > 0) page.add(new Arrow(routes, key, keys[i - 1], 'left'))
        if (i < keys.length - 1) page.add(new Arrow(routes, key, keys[i + 1], 'right'))
    })
    root.add(pages)
    root.add(new FormButton(FOCUS_STAY, 'stay|', 1, 1).setAnchor(Anchor.TOP_LEFT).setFocusPrecedence(50))
    return { content: root, pages, routes }
}
