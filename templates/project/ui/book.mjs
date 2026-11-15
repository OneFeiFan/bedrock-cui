import { Anchor, Color, FormButton, Image, Label, Pages, Panel, Paragraph, Size } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

/** 两页的小书：服务端翻页箭头、软换行的正文、关闭按钮（表单按钮 0） */
export function buildBook() {
    const book = new Panel().setSize(240, 150)
    book.add(new Image('textures/cui_example/panel').setSize(Size.full()))

    const pages = new Pages('book').startAt('p1').setSize(Size.full())
    const arrow = (from, to, dir) => pages
        .serverArrow(from, to, dir, (hover) => new Label(`${hover ? '§e' : ''}§l${dir === 'next' ? '>' : '<'}`), 16, 12)
        .setAnchor(dir === 'next' ? Anchor.BOTTOM_RIGHT : Anchor.BOTTOM_LEFT)
        .setOffset(dir === 'next' ? -8 : 8, -6)
    const page = (key, title, text) => pages.page(key).add(
        new Label(title).setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
        new Paragraph(text, 210).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(15, 28),
    )
    page('p1', '第 1 页', '这是用 bedrock-cui 做的一本小书。右下角的箭头翻到下一页；鼠标不动也能连续点击。')
        .add(arrow('p1', 'p2', 'next'))
    page('p2', '第 2 页', '修改 ui/book.mjs 后，浏览器中的预览会自动刷新。npm run build 构建附加包。')
        .add(arrow('p2', 'p1', 'prev'))
    book.add(pages, pages.stayButton())

    const close = new FormButton(0, 'close|', 12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
    close.default.add(new Label('§4x'))
    close.hover.add(new Label('§cx'))
    book.add(close)
    return book
}
