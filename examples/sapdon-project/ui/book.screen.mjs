// 一个界面：数据（props）、逻辑（methods）、视图（pages、layout）写在同一个文件里
import { Anchor, Color, Image, Label, Panel, Paragraph, Size, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

// 翻页箭头的外观：普通时与鼠标悬停时
const arrow = (button, text) => {
    button.setSize(16, 12)
    button.default.add(new Label(`§l${text}`).setColor(INK))
    button.hover.add(new Label(`§e§l${text}`))
    return button
}

// 一页的内容：标题与正文
const page = (title, text) => new Panel().setSize(Size.full()).add(
    new Label(title).setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
    new Paragraph(text, 210).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(15, 40),
)

export default defineScreen({
    // 界面 id：脚本打开表单时，标题就是它
    id: 'cui_ui:book',

    // ———— 数据：行为包脚本打开界面时传入的值，以及没有传入时的默认值 ————
    props: {
        reader: { type: String, default: '读者' },
    },

    // ———— 视图：两页内容；翻页由服务端完成，鼠标不动也能连续点击 ————
    pages: {
        p1: ({ reader, next }) => page('第 1 页', '这是一本用 bedrock-cui 做的小书。点击右下角的箭头，翻到下一页。').add(
            new Label(reader).setColor(INK).setSize(200, 10).setAnchor(Anchor.TOP_LEFT).setOffset(15, 26),
            arrow(next(), '>').setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-8, -6),
        ),
        p2: ({ prev }) => page('第 2 页', '修改 ui/book.screen.mjs 后，浏览器中的预览会自动刷新。npm run build 构建附加包。').add(
            arrow(prev(), '<').setAnchor(Anchor.BOTTOM_LEFT).setOffset(8, -6),
        ),
    },

    // 各页共用的外框：背景与关闭按钮；page 是当前页放置的位置
    layout({ page, button, close }) {
        const x = button().onClick(close).setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        x.default.add(new Label('§4x'))
        x.hover.add(new Label('§cx'))
        return new Panel().setSize(240, 150).add(
            new Image('textures/cui_example/panel').setSize(Size.full()),
            page,
            x,
        )
    },
})
