// 界面模型的真机验证：数据（props）、逻辑（state、computed、methods、onClose）与视图写在一个文件里
import { Anchor, Color, Image, Label, Panel, Size, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

export default defineScreen({
    id: 'cui_ui:props_demo',

    props: {
        greeting: '默认的问候（没有收到脚本的数据）',
        item: { text: '钻石', icon: 'textures/items/diamond' },
        goods: [{ text: '苹果', icon: 'textures/items/apple' }, { text: '面包', icon: 'textures/items/bread' }, '第 3 项（没有图标）'],
        vip: false,
    },

    // ———— 逻辑：在游戏中运行 ————
    state() {
        return { n: 0 }                                    // 点了几次「点我」
    },
    computed: {
        greeting() { return this.n === 0 ? '欢迎！点「点我」试试' : `点了 ${this.n} 次` },
        vip() { return this.n % 2 === 1 },                 // 奇数次时显示「★ 会员」
        goods() { return [{ text: `绿宝石 ×${this.n + 1}`, icon: 'textures/items/emerald' }, { text: '金锭', icon: 'textures/items/gold_ingot' }] },
    },
    methods: {
        hello() { this.n += 1 },
        close() { this.close() },
    },
    onClose() {
        this.player.sendMessage(`[props 演示] 已关闭，共点了 ${this.n} 次`)
    },

    // ———— 视图：构建时运行 ————

    view({ props, button }) {
        // 一行：图标 + 文字（同一个 prop 用在两个控件上）
        const row = (p, y) => [
            new Image(p).setSize(16, 16).setAnchor(Anchor.TOP_LEFT).setOffset(12, y),
            new Label(p).setColor(INK).setSize(150, 10).setAnchor(Anchor.TOP_LEFT).setOffset(34, y + 4),
        ]
        const hello = button('hello').setSize(70, 18).setAnchor(Anchor.BOTTOM_LEFT).setOffset(12, -10)
        hello.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label('点我'))
        hello.hover.add(new Image('textures/ui/white').setKeepRatio(false).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label('§e点我'))
        const close = button('close').setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        close.default.add(new Label('§4x'))
        close.hover.add(new Label('§cx'))

        return new Panel().setSize(240, 170).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label(props.greeting).setColor(INK).setSize(200, 10).setAnchor(Anchor.TOP_LEFT).setOffset(12, 10),
            new Label('§6★ 会员').setSize(50, 10).setAnchor(Anchor.TOP_RIGHT).setOffset(-24, 10).setVisible(props.vip),
            ...row(props.item, 28),
            ...props.goods.flatMap((g, i) => row(g, 54 + i * 22)),
            hello,
            close,
        )
    },
})
