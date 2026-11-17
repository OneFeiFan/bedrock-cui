// 界面模型的真机验证：数据（props）、逻辑（state、computed、methods、onClose）与视图写在一个文件里
import { Anchor, Color, Image, Item, Label, Panel, Size, Texture, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

export default defineScreen({
    id: 'cui_ui:props_demo',

    // 脚本传入的数据：手持绿宝石打开时，脚本传入 item
    props: {
        item: { type: Item, default: { text: '钻石', icon: 'textures/items/diamond' } },
    },

    // ———— 逻辑：在游戏中运行 ————
    state() {
        return { n: 0, left: 0, stopTimer: undefined }    // 点了几次「点我」；倒计时剩余秒数
    },
    computed: {
        greeting() { return this.n === 0 ? '欢迎！点「点我」试试' : `点了 ${this.n} 次` },
        vip() { return this.n % 2 === 1 },                 // 奇数次时显示「★ 会员」
        countdown() { return this.left > 0 ? `倒计时：${this.left}` : '倒计时：未开始' },
        goods() { return [{ text: `绿宝石 ×${this.n + 1}`, icon: 'textures/items/emerald' }, { text: '金锭', icon: 'textures/items/gold_ingot' }, '第 3 项（没有图标）'] },
    },
    methods: {
        // 事件总线：和游戏打交道的事交给脚本（脚本中 propsDemo.on('hello', …)）
        hello() { this.n += 1; this.emit('hello', this.n) },
        // this.mc：逻辑中直接使用游戏的脚本 API（@minecraft/server）
        apple() { this.player.getComponent('minecraft:inventory')?.container?.addItem(new this.mc.ItemStack('minecraft:apple', 1)) },
        // 倒计时：定时器每秒修改状态，界面随之更新（阶段 C）；界面关闭时定时器自动取消
        start() {
            this.stopTimer?.()
            this.left = 5
            this.stopTimer = this.setInterval(() => {
                this.left -= 1
                if (this.left <= 0) this.stopTimer()
            }, 20)
        },
    },
    onClose() {
        this.player.sendMessage(`[props 演示] 已关闭，共点了 ${this.n} 次`)
    },

    // ———— 视图：构建时运行 ————

    view({ greeting, item, goods, vip, countdown, hello: helloIt, start: startIt, apple: appleIt, button, close: closeIt }) {
        // 一行：图标 + 文字（同一个 prop 用在两个控件上）
        const row = (p, y) => [
            new Image(p).setSize(16, 16).setAnchor(Anchor.TOP_LEFT).setOffset(12, y),
            new Label(p).setColor(INK).setSize(150, 10).setAnchor(Anchor.TOP_LEFT).setOffset(34, y + 4),
        ]
        const hello = button().onClick(helloIt).setSize(70, 18).setAnchor(Anchor.BOTTOM_LEFT).setOffset(12, -10)
        hello.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label('点我'))
        hello.hover.add(new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label('§e点我'))
        const start = button().onClick(startIt).setSize(70, 18).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-12, -10)
        start.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label('倒计时'))
        start.hover.add(new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label('§e倒计时'))
        // this.mc 的测试：给玩家一个苹果
        const apple = button().onClick(appleIt).setSize(70, 18).setAnchor(Anchor.BOTTOM_CENTER).setOffset(0, -10)
        apple.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label('给我苹果'))
        apple.hover.add(new Image(Texture.SOLID).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label('§e给我苹果'))
        const close = button().onClick(closeIt).setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        close.default.add(new Label('§4x'))
        close.hover.add(new Label('§cx'))

        return new Panel().setSize(240, 170).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label(greeting).setColor(INK).setSize(200, 10).setAnchor(Anchor.TOP_LEFT).setOffset(12, 10),
            new Label('§6★ 会员').setSize(50, 10).setAnchor(Anchor.TOP_RIGHT).setOffset(-24, 10).setVisible(vip),
            ...row(item, 28),
            ...goods.flatMap((g, i) => row(g, 54 + i * 22)),
            new Label(countdown).setColor(INK).setSize(90, 10).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-12, -32),
            hello,
            apple,
            start,
            close,
        )
    },
})
