import { Anchor, Button, Close, Color, Image, Item, Label, Page, Size, defineUI } from 'bedrock-cui'

const INK = Color.hex('#404040')

const shop = defineUI({
    id: 'cui_ui:shop',
    // 数据：脚本传入
    props: { item: { type: Item, default: { text: '钻石', icon: 'textures/cui_example/gem' } } },
    // 逻辑：在游戏中运行
    state() { return { coins: 10 } },
    computed: { coinText() { return `金币：${this.coins}` } },
    methods: { buy() { if (this.coins >= 5) this.coins -= 5 } },
    // 页面：构建时生成 JSON UI
    page: ({ coinText, item, buy }) => {
        const buyButton = new Button().onClick(buy).setSize(48, 16).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-6, -6)
        buyButton.default.add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), new Label('购买').setColor(INK))
        buyButton.hover.add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), new Label('§e购买'))
        return new Page().setSize(160, 84).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label('杂货铺').setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(7, 7),
            new Label(coinText).setColor(INK).setSize(100, 10).setAnchor(Anchor.TOP_LEFT).setOffset(7, 21),
            new Image(item).setSize(16, 16).setAnchor(Anchor.TOP_LEFT).setOffset(7, 38),
            new Label(item).setColor(INK).setSize(80, 10).setAnchor(Anchor.TOP_LEFT).setOffset(27, 41),
            buyButton,
            new Close().setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-5, 5).add(new Label('§4x')),
        )
    },
})
export default shop
