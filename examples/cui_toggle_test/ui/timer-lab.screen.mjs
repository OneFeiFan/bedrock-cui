// 计时实验（1.58.0）：ProgressBar 与 Countdown——计时期间不刷新，重新打开时从当时的进度接着走
// 1.60.0：静止的一列不用 not（1.59.0 双重否定失效：进行中时背后多一个不动的数字、暂停时整个消失）；计时结束时自动刷新一次；进度条加白色的「头」；右上显示界面收到的数据
import { Anchor, Button, Close, Color, Countdown, defineUI, Image, Label, Panel, ProgressBar, Size, Texture, Timer } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

export default defineUI({
    id: 'cui_ui:timer_lab',
    state() { return { cooldown: Timer.idle(10) } },
    // 1.62.0：结束时不刷新——精度 1 的头越过右端消失，精度 49 稍微越过（真机与预测一致）。
    // 1.63.0：用裁剪「封顶」——头由层的叠放画出，各层的裁剪边界错开，到达右端后停住；倒计时有底色，滚过「1」后露出静止的「0」。
    // 预测：暂停、继续、重新打开之后，两条杠都停在右端，倒计时停在 0，都不需要刷新
    timerEndRefresh: false,
    methods: {
        start() { this.cooldown = this.cooldown.start() },
        pause() { this.cooldown = this.cooldown.isRunning() ? this.cooldown.pause() : this.cooldown.resume() },
        again() { },                                    // 什么也不做：重新打开，看是否接着走
    },
    page({ cooldown, start, pause, again }) {
        const btn = (method, text, x) => {
            const b = new Button().onClick(method).setSize(60, 16).setAnchor(Anchor.BOTTOM_LEFT).setOffset(x, -8)
            b.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label(text))
            b.hover.add(new Image(Texture.SOLID).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label(`§e${text}`))
            return b
        }
        const close = new Close().setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        close.default.add(new Label('§4x'))
        close.hover.add(new Label('§cx'))
        return new Panel().setSize(220, 90).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label('剩余：').setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(12, 12),
            new Countdown(cooldown, (n) => `${n} 秒`).setTextColor(Color.hex('#f0e6c8')).setBackground(Color.hex('#3c2814')).setSize(50, 10).setAnchor(Anchor.TOP_LEFT).setOffset(46, 12),
            new ProgressBar(cooldown).setHead(Color.WHITE, 2, 2, 4).setSize(196, 8).setAnchor(Anchor.TOP_LEFT).setOffset(12, 32),
            // 调试：界面收到的数据（I0 未开始、R<千分比> 进行中、P<千分比> 暂停、D1000 完成）
            new Label(cooldown).setColor(Color.hex('#7a6a50')).setSize(60, 10).setAnchor(Anchor.TOP_RIGHT).setOffset(-24, 12),
            btn(start, '开始', 12), btn(pause, '暂停/继续', 80), btn(again, '重新打开', 148),
            close,
        )
    },
})
