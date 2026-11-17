// 页面实验（1.59.0）：pages 与 link / next / prev / back——鼠标不动时连续点「下一页」「返回」是否都落在同一个按钮上
import { Anchor, Color, Image, Label, Panel, Size, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const look = (b, text, w = 60) => { b.setSize(w, 14); b.default.add(new Label(text).setColor(INK)); b.hover.add(new Label(`§e${text}`)); return b }
const body = (title) => new Panel().setSize(Size.full()).add(new Label(title).setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 12))
const nav = ({ back, prev, next }, hasPrev, hasNext) => [
    look(back(), '< 返回').setAnchor(Anchor.BOTTOM_LEFT).setOffset(8, -8),
    ...(hasPrev ? [look(prev(), '上一页').setAnchor(Anchor.BOTTOM_CENTER).setOffset(-34, -8)] : []),
    ...(hasNext ? [look(next(), '下一页 >').setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-8, -8)] : []),
]

export default defineScreen({
    id: 'cui_ui:pages_lab',
    pages: {
        home: ({ link }) => body('目录（点任一条进入）').add(
            look(link('p1'), '· 第 1 页', 80).setAnchor(Anchor.TOP_LEFT).setOffset(20, 34),
            look(link('p3'), '· 第 3 页', 80).setAnchor(Anchor.TOP_LEFT).setOffset(20, 52),
        ),
        p1: (t) => body('第 1 页').add(...nav(t, false, true)),
        p2: (t) => body('第 2 页').add(...nav(t, true, true)),
        p3: (t) => body('第 3 页').add(...nav(t, true, false)),
    },
    layout: ({ page, button, close }) => {
        const x = button().onClick(close).setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        x.default.add(new Label('§4x')); x.hover.add(new Label('§cx'))
        return new Panel().setSize(220, 110).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), page, x)
    },
})
