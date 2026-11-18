// 一个界面：数据（props）、逻辑（methods 等）、页面（page）写在同一个文件里
import { Anchor, Close, Color, Image, Label, Next, Page, Paragraph, Prev, Router, Size, defineUI } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

// 翻页按钮的外观：平时与鼠标悬停时
function Arrow(button, text) {
    button.setSize(16, 12)
    button.default.add(new Label(`§l${text}`).setColor(INK))
    button.hover.add(new Label(`§e§l${text}`))
    return button
}

// 页面：标题与正文
function Chapter(title, text) {
    return new Page().add(
        new Label(title).setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
        new Paragraph(text, 210).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(15, 40),
        Arrow(new Prev(), '<').setAnchor(Anchor.BOTTOM_LEFT).setOffset(8, -6),       // 第一页自动隐藏
        Arrow(new Next(), '>').setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-8, -6),     // 最后一页自动隐藏
    )
}

// 根页面：背景、关闭按钮（公共部分），以及两页内容（服务端切换）
function BookPage({ reader }) {
    const close = new Close().setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
    close.default.add(new Label('§4x'))
    close.hover.add(new Label('§cx'))
    return new Page().setSize(240, 150).add(
        new Image('textures/cui_example/panel').setSize(Size.full()),
        new Router({
            p1: () => Chapter('第 1 页', '这是一本用 bedrock-cui 做的小书。点击右下角的箭头，翻到下一页。').add(
                new Label(reader).setColor(INK).setSize(200, 10).setAnchor(Anchor.TOP_LEFT).setOffset(15, 26),
            ),
            p2: () => Chapter('第 2 页', '修改 ui/book.screen.mjs 后，浏览器中的预览会自动刷新。npm run build 构建附加包。'),
        }),
        close,
    )
}

export default defineUI({
    // 界面 id：脚本打开表单时，标题就是它
    id: 'cui_ui:book',

    // 数据：行为包脚本打开界面时传入的值，以及没有传入时的默认值
    props: {
        reader: { type: String, default: '读者' },
    },

    // 根页面
    page: BookPage,
})
