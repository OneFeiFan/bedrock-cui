import { Anchor, Button, Close, Color, Image, Item, Label, Page, Panel, Size,
    Texture, defineUI } from 'bedrock-cui'

const INK = Color.hex('#404040'), GRAY = Color.hex('#6b6b6b')

// 放在面板中从左上角起 (x, y) 处
const at = (el, x, y) => el.setAnchor(Anchor.TOP_LEFT).setOffset(x, y)

// 一块纯色：w × h，放在 (x, y)
const rect = (color, w, h, x = 0, y = 0) =>
    at(new Image(Texture.SOLID).setColor(Color.hex(color)).setSize(w, h), x, y)

// 斜面：raised 为凸起（按钮，带黑色外框），否则为凹陷（槽位、数值栏）
function bevel(w, h, fill, raised) {
    const [hi, lo] = raised ? ['#a8a8a8', '#3c3c3c'] : ['#373737', '#ffffff']
    const i = raised ? 1 : 0, iw = w - 2 * i, ih = h - 2 * i
    const box = new Panel().setSize(w, h)
    if (raised) box.add(rect('#000000', w, h))
    return box.add(
        rect(fill, iw, ih, i, i),
        rect(hi, iw, 1, i, i), rect(hi, 1, ih, i, i),
        rect(lo, iw, 1, i, h - 1 - i), rect(lo, 1, ih, w - 1 - i, i),
    )
}

// 白字加阴影（游戏中按钮与数值的文字）
const light = (text) => new Label(text).setShadow()

const shop = defineUI({
    id: 'cui_ui:shop',
    // 数据：脚本传入
    props: {
        item: { type: Item, default: { text: '钻石', icon: 'textures/cui_example/gem' } },
    },
    // 逻辑：在游戏中运行
    state() { return { coins: 10 } },
    computed: { coinText() { return `金币：${this.coins}` } },
    methods: { buy() { if (this.coins >= 5) this.coins -= 5 } },
    // 页面：构建时生成 JSON UI
    page: ({ coinText, item, buy }) => {
        const buyButton = new Button().onClick(buy).setSize(48, 18)
            .setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-6, -6)
        buyButton.default.add(bevel(48, 18, '#6f6f6f', true), light('购买'))
        buyButton.hover.add(bevel(48, 18, '#7f7f7f', true), light('§e购买'))
        const close = new Close().setSize(12, 12)
            .setAnchor(Anchor.TOP_RIGHT).setOffset(-5, 5)
        close.default.add(bevel(12, 12, '#8b8b8b', true), light('x'))
        close.hover.add(bevel(12, 12, '#9b9b9b', true), light('§ex'))
        return new Page().setSize(168, 92).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            at(new Label('杂货铺').setColor(INK), 7, 6),
            at(bevel(154, 14, '#8b8b8b'), 7, 20),
            at(light(coinText).setSize(146, 10), 11, 22),
            at(bevel(18, 18, '#8b8b8b'), 7, 40),
            at(new Image(item).setSize(16, 16), 8, 41),
            at(new Label(item).setColor(INK).setSize(80, 10), 30, 40),
            at(new Label('每个 5 金币').setColor(GRAY).setSize(80, 10), 30, 50),
            buyButton,
            close,
        )
    },
})
export default shop
