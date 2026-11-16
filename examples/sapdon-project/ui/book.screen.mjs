// 一个界面：数据（props）、逻辑（methods）、视图（view）写在同一个文件里
import { Anchor, Color, Image, Label, Panel, Paragraph, Size, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

export default defineScreen({
    // 界面 id：脚本打开表单时，标题就是它
    id: 'cui_ui:book',

    // ———— 数据：视图显示的 props 与默认值（脚本打开时可以传入别的值） ————
    props: {
        reader: '读者',
    },

    // ———— 逻辑：在游戏中运行 ————
    methods: {
        // 视图中 button('close') 被点击时调用
        close() { this.close() },
    },

    // ———— 视图：返回控件树（构建时运行） ————
    view({ props, button, pages }) {
        const book = new Panel().setSize(240, 150)
        book.add(new Image('textures/cui_example/panel').setSize(Size.full()))

        // 两页内容；翻页由服务端完成，鼠标不动也能连续点击
        const p = pages('book').startAt('p1').setSize(Size.full())
        const arrow = (from, to, dir) => p
            .serverArrow(from, to, dir, (hover) => new Label(`${hover ? '§e' : ''}§l${dir === 'next' ? '>' : '<'}`), 16, 12)
            .setAnchor(dir === 'next' ? Anchor.BOTTOM_RIGHT : Anchor.BOTTOM_LEFT)
            .setOffset(dir === 'next' ? -8 : 8, -6)
        const page = (key, title, text) => p.page(key).add(
            new Label(title).setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
            new Paragraph(text, 210).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(15, 40),
        )
        page('p1', '第 1 页', '这是用 bedrock-cui 做的一本小书。右下角的箭头翻到下一页。')
            .add(new Label(props.reader).setColor(INK).setSize(200, 10).setAnchor(Anchor.TOP_LEFT).setOffset(15, 26))
            .add(arrow('p1', 'p2', 'next'))
        page('p2', '第 2 页', '修改 ui/book.screen.mjs 后，浏览器中的预览会自动刷新。npm run build 构建附加包。')
            .add(arrow('p2', 'p1', 'prev'))

        const close = button('close').setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        close.default.add(new Label('§4x'))
        close.hover.add(new Label('§cx'))

        book.add(p, p.stayButton(), close)
        return book
    },
})
