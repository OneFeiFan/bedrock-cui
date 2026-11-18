// 页面实验（1.59.0 → 1.64.0）：Router 与 Link / Back / Prev / Next——鼠标不动时连续点「下一页」「返回」是否都落在同一个按钮上。
// 1.68.0 起用羽毛打开（或 /scriptevent cui:pages）。1.64.0 改用统一的页面写法：跳转由运行时处理，跳转后新页中动作相同的按钮获得焦点；公共部分的「目录」焦点不变
import { Anchor, Back, Close, Color, Image, Label, Link, Next, Page, Prev, Router, Size, defineUI } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const look = (b, text, w = 60) => { b.setSize(w, 14); b.default.add(new Label(text).setColor(INK)); b.hover.add(new Label(`§e${text}`)); return b }

// 子页面：标题与三个跳转（首页的「上一页」、末页的「下一页」自动隐藏，没有历史时「返回」自动隐藏）
const Chapter = (title) => () => new Page().add(
    new Label(title).setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 12),
    look(new Back(), '< 返回').setAnchor(Anchor.BOTTOM_LEFT).setOffset(8, -8),
    look(new Prev(), '上一页').setAnchor(Anchor.BOTTOM_CENTER).setOffset(-34, -8),
    look(new Next(), '下一页 >').setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-8, -8),
)

function Home() {
    return new Page().add(
        new Label('目录（点任一条进入）').setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 12),
        look(new Link('p1'), '· 第 1 页', 80).setAnchor(Anchor.TOP_LEFT).setOffset(20, 34),
        look(new Link('p3'), '· 第 3 页', 80).setAnchor(Anchor.TOP_LEFT).setOffset(20, 52),
    )
}

function Lab() {
    const x = new Close().setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
    x.default.add(new Label('§4x')); x.hover.add(new Label('§cx'))
    return new Page().setSize(220, 110).add(
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        look(new Link('home'), '目录', 30).setAnchor(Anchor.TOP_LEFT).setOffset(6, 4),        // 公共部分
        x,
        new Router({ home: Home, p1: Chapter('第 1 页'), p2: Chapter('第 2 页'), p3: Chapter('第 3 页') }),
    )
}

export default defineUI({ id: 'cui_ui:pages_lab', page: Lab })
