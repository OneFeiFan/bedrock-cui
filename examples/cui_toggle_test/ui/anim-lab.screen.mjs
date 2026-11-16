// 动画实验（1.44.0 / 1.45.0）：客户端自己播放的动画（JSON UI anims），不需要脚本刷新
import { Anchor, Anim, Color, Image, Label, Panel, Size, Texture, defineScreen, lit } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

// G：数值 + 匀速动画的进度条（1.46.0）
const W = 160, H = 8, T = 10           // 宽、高（像素），总时长（秒）

/** 第 k 秒到第 k+1 秒之间显示（k 从 0 起）：先透明 k 秒，显示 1 秒，再隐藏 */
const showDuring = (k) => (k === 0 ? Anim.alpha(1, 1, 1) : Anim.alpha(0, 0, k).then(Anim.alpha(1, 1, 1))).then(Anim.alpha(0, 0, 0.05))

export default defineScreen({
    id: 'cui_ui:anim_lab',

    // 进度（千分比）由脚本在每次打开时算出，通过 prop 传进界面。文字带状态前缀：未开始 I0、进行中 R400、完成 D1000
    // （1.46.0 用 >= 判断显示，原版表达式从未用过比较运算符，真机「没动静」——改为只用「包含」与「去掉文字后乘以 1」）
    props: { progress: 'I0' },
    state() { return { startedAt: 0 } },
    computed: {
        progress() {
            if (!this.startedAt) return 'I0'
            const n = Math.min(1000, Math.round((Date.now() - this.startedAt) / (T * 1000) * 1000))
            return n >= 1000 ? 'D1000' : `R${n}`
        },
    },

    methods: {
        start() { this.startedAt = Date.now() },
        again() { },                 // 什么也不做：点击后表单重新打开，观察动画是否从头播放
        close() { this.close() },
    },

    view({ props, button }) {
        const title = (text, y) => new Label(text).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(12, y)

        // A 数字倒计时：6 个文字叠在同一位置
        const digits = new Panel().setSize(80, 12).setAnchor(Anchor.TOP_LEFT).setOffset(120, 24)
        ;['5', '4', '3', '2', '1'].forEach((d, k) => digits.add(new Label(`§l${d}`).setColor(INK).setAnchor(Anchor.TOP_LEFT).setAnims(showDuring(k))))
        digits.add(new Label('§2时间到').setAnchor(Anchor.TOP_LEFT).setAnims(Anim.alpha(0, 0, 5).then(Anim.alpha(1, 1, 0.05))))

        // B 进度条：5 秒内从 120 像素缩到 0
        const track = new Panel().setSize(120, 6).setAnchor(Anchor.TOP_LEFT).setOffset(120, 46).add(
            new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#cfc3a3')).setSize(Size.full()),
            new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#3fa04a')).setSize(120, 6).setAnchor(Anchor.TOP_LEFT)
                .setAnims(Anim.size([120, 6], [0, 6], 5)),
        )

        // B2 进度条（裁剪比例）：5 秒内从满到空，图片不变形
        const track2 = new Panel().setSize(120, 6).setAnchor(Anchor.TOP_LEFT).setOffset(120, 54).add(
            new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#cfc3a3')).setSize(Size.full()),
            new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#c08030')).setSize(Size.full()).setClipRatio('right', 0)
                .setAnims(Anim.clip(0, 1, 5)),
        )

        // E 进度箭头与 F 燃烧的火焰：照 sapdon 指导书的做法（原版贴图，裁剪比例循环）
        const arrow = new Panel().setSize(22, 15).setAnchor(Anchor.TOP_LEFT).setOffset(200, 100).add(
            new Image('textures/ui/arrow_inactive').setSize(22, 15),
            new Image('textures/ui/arrow_active').setSize(22, 15).setClipRatio('left', 1).setLayer(2).setAnims(Anim.clip(1, 0, 3).loop()),
        )
        const flame = new Panel().setSize(14, 14).setAnchor(Anchor.TOP_LEFT).setOffset(230, 100).add(
            new Image('textures/ui/flame_empty_image').setSize(14, 14),
            new Image('textures/ui/flame_full_image').setSize(14, 14).setClipRatio('down', 0).setLayer(2).setAnims(Anim.clip(0, 1, 3).loop()),
        )

        // C 呼吸：透明度在 1 与 0.2 之间循环
        const breathe = new Label('§5呼吸中').setAnchor(Anchor.TOP_LEFT).setOffset(120, 64)
            .setAnims(Anim.alpha(1, 0.2, 1).setEasing('in_out_sine').then(Anim.alpha(0.2, 1, 1).setEasing('in_out_sine')).loop())

        // D 移动：小方块左右往返
        const square = new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#4060c0')).setSize(10, 10)
            .setAnchor(Anchor.TOP_LEFT).setOffset(120, 84)
            .setAnims(Anim.offset([120, 84], [230, 84], 1.5).setEasing('in_out_quad').then(Anim.offset([230, 84], [120, 84], 1.5).setEasing('in_out_quad')).loop())

        // G 进度条：已完成部分按数值裁剪；前进部分放在当前进度处、匀速增长（超出右端的部分被裁掉）
        // 数值：去掉状态前缀后乘以 1；进行中：文字包含 R
        const p = props.progress.minus('I').minus('R').minus('D').times(1)
        const running = props.progress.contains('R')
        const bar = new Panel().setSize(W, H).setAnchor(Anchor.TOP_LEFT).setOffset(12, 132).setClip(true).add(
            new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#cfc3a3')).setSize(W, H).setAnchor(Anchor.TOP_LEFT),
            new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#3fa04a')).setSize(W, H).setAnchor(Anchor.TOP_LEFT)
                .setClipRatio('right', lit(1).minus(p.times(0.001))),
            new Panel().setSize(W, H).setAnchor(Anchor.TOP_LEFT).setOffset(p.times(W / 1000), 0)
                .setVisible(running)
                .add(new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#3fa04a')).setSize(0, H).setAnchor(Anchor.TOP_LEFT)
                    .setAnims(Anim.size([0, H], [W, H], T))),
        )
        // G2 对照：与 G 相同，但前进部分始终显示（不用显示条件）——G 不动而 G2 动，问题在显示条件；都不动，问题在动画或位置绑定
        const bar2 = new Panel().setSize(W, H).setAnchor(Anchor.TOP_LEFT).setOffset(12, 146).setClip(true).add(
            new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#cfc3a3')).setSize(W, H).setAnchor(Anchor.TOP_LEFT),
            new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#3060c0')).setSize(W, H).setAnchor(Anchor.TOP_LEFT)
                .setClipRatio('right', lit(1).minus(p.times(0.001))),
            new Panel().setSize(W, H).setAnchor(Anchor.TOP_LEFT).setOffset(p.times(W / 1000), 0)
                .add(new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#3060c0')).setSize(0, H).setAnchor(Anchor.TOP_LEFT)
                    .setAnims(Anim.size([0, H], [W, H], T))),
        )
        const reading = new Label(props.progress).setColor(INK).setSize(60, 10).setAnchor(Anchor.TOP_LEFT).setOffset(180, 131)
        const start = button('start').setSize(60, 16).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-12, -8)
        start.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label('开始'))
        start.hover.add(new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label('§e开始'))

        const again = button('again').setSize(80, 18).setAnchor(Anchor.BOTTOM_LEFT).setOffset(12, -10)
        again.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label('重新打开'))
        again.hover.add(new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label('§e重新打开'))
        const close = button('close').setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        close.default.add(new Label('§4x'))
        close.hover.add(new Label('§cx'))

        return new Panel().setSize(260, 180).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            title('A 数字倒计时', 26), digits,
            title('B 进度条（尺寸）', 44), track, track2,
            title('C 呼吸', 64), breathe,
            title('D 移动', 84), square,
            title('E 箭头  F 火焰', 102), arrow, flame,
            title('G 进度（10 秒，千分比）：', 120), bar, reading, start,
            bar2,
            again, close,
        )
    },
})
