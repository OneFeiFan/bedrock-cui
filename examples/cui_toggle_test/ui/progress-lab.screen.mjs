// 进度实验（1.52.0 / 1.53.0）：按真机测得的规则实现的进度条——运算只有整数；位置绑定的单位是自身宽度，所以移动的控件只有 1 像素宽
// 1.52.0 真机的「黑色缝隙」：原版 textures/ui/white 是 15×15、四周 2 像素黑边的贴图，拉伸后两端各有约 13% 的黑边——改用纯白贴图 cui_test/solid
import { Anchor, Anim, Color, Image, Label, Panel, Size, Texture, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const W = 160, H = 8, T = 10           // 宽、高（像素），总时长（秒）
const SOLID = Texture.SOLID            // 内置纯白贴图

export default defineScreen({
    id: 'cui_ui:progress_lab',

    // 当前进度（整数像素 0–160），文字带状态前缀：未开始 I0、进行中 R64、完成 D160
    state() { return { startedAt: 0 } },
    computed: {
        px() {
            if (!this.startedAt) return 'I0'
            const p = Math.min(W, Math.round((Date.now() - this.startedAt) / (T * 1000) * W))
            return p >= W ? `D${W}` : `R${p}`
        },
    },
    methods: {
        start() { this.startedAt = Date.now() },
        again() { },
    },

    view({ px, start: startIt, again: againIt, button, close: closeIt }) {
        const p = px.minus('I').minus('R').minus('D').times(1)     // 整数像素
        const green = Color.hex('#3fa04a')
        const bar = new Panel().setSize(W, H).setAnchor(Anchor.TOP_LEFT).setOffset(40, 40).setClip(true).add(
            new Image(SOLID).setKeepRatio(false).setColor(Color.hex('#cfc3a3')).setSize(W, H).setAnchor(Anchor.TOP_LEFT),
            // 已完成部分：1 像素宽的容器移到「进度 − 总宽」，里面满宽的条露出已完成的长度
            new Panel().setSize(1, H).setAnchor(Anchor.TOP_LEFT).setOffset(p.minus(W), 0).add(
                new Image(SOLID).setKeepRatio(false).setColor(green).setSize(W, H).setAnchor(Anchor.TOP_LEFT)),
            // 前进部分：1 像素宽的容器移到「进度」，里面的条匀速增长（W / T 像素每秒），超出右端的部分被裁掉
            new Panel().setSize(1, H).setAnchor(Anchor.TOP_LEFT).setOffset(p, 0).setVisible(px.contains('R')).add(
                new Image(SOLID).setKeepRatio(false).setColor(green).setSize(0, H).setAnchor(Anchor.TOP_LEFT)
                    .setAnims(Anim.size([0, H], [W, H], T))),
        )

        const start = button().onClick(startIt).setSize(60, 16).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-12, -8)
        start.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label('开始'))
        start.hover.add(new Image(SOLID).setKeepRatio(false).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label('§e开始'))
        const again = button().onClick(againIt).setSize(80, 16).setAnchor(Anchor.BOTTOM_LEFT).setOffset(12, -8)
        again.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label('重新打开'))
        again.hover.add(new Image(SOLID).setKeepRatio(false).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label('§e重新打开'))
        const close = button().onClick(closeIt).setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        close.default.add(new Label('§4x'))
        close.hover.add(new Label('§cx'))

        return new Panel().setSize(240, 100).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label('进度（10 秒）：').setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(12, 12),
            new Label(px).setColor(INK).setSize(60, 10).setAnchor(Anchor.TOP_LEFT).setOffset(100, 12),
            bar, start, again, close,
        )
    },
})
