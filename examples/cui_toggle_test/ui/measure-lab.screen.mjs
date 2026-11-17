// 测量实验（1.49.0 / 1.50.0）：位置绑定与裁剪比例绑定的单位与运算
// 1.49.0 真机：绑定纯常数不合法（Must define a source property name），O2、O3、C1、C3 作废；O4（prop 40）看不见，C2（prop 0.6）满格——1.50.0 全部改用 prop
// 1.48.0 真机：偏移为 0 的控件都正常，偏移不为 0 的都看不见——怀疑 #anchored_offset_value_x 的单位不是像素
import { Anchor, Color, Image, Label, Panel, Size, Texture, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const W = 160, H = 8

export default defineScreen({
    id: 'cui_ui:measure_lab',
    // 1.50.0 真机：O4（40）看不见、O5 / O6（0.25）在 0、C2 / C4（0.6）满格，C1 固定 0.5 右半边可见（clip_direction 'right' = 可见部分靠右）。
    // 怀疑小数转换后变成 0，位置单位不是像素——1.51.0 全部用整数
    props: { one: { type: String, default: '1' }, two: { type: String, default: '2' }, twentyfive: { type: String, default: '25' } },   // 默认值即可

    view({ one, two, twentyfive, button, close: closeIt }) {
        const X0 = 70
        /** 一条轨道：背景 + 0、¼、½、¾、满五个刻度 */
        const track = (y) => {
            const t = new Panel().setSize(W, H).setAnchor(Anchor.TOP_LEFT).setOffset(X0, y)
            t.add(new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#cfc3a3')).setSize(W, H).setAnchor(Anchor.TOP_LEFT))
            for (const q of [0, 1, 2, 3, 4]) t.add(new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#7a6a4a')).setSize(1, H + 4).setAnchor(Anchor.TOP_LEFT).setOffset(Math.min(q * 40, W - 1), -2))
            return t
        }
        // 位置：40 像素宽的蓝条（轨道的 ¼），它的偏移由 prop 决定
        const bar = () => new Panel().setSize(40, 8).setAnchor(Anchor.TOP_LEFT).add(new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#3060c0')).setSize(40, 8))
        // 裁剪：可见部分靠左（clip_direction 'left'，与原版进度箭头相同）
        const green = () => new Image(Texture.SOLID).setKeepRatio(false).setColor(Color.hex('#3fa04a')).setSize(W, H).setAnchor(Anchor.TOP_LEFT)
        const row = (name, y, child) => [new Label(name).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(10, y), track(y).add(child)]

        const close = button().onClick(closeIt).setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        close.default.add(new Label('§4x'))
        close.hover.add(new Label('§cx'))

        return new Panel().setSize(250, 180).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label('刻度：0  ¼  ½  ¾  满').setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(X0, 6),
            ...row('P0 固定40', 22, bar().setOffset(40, 0)),
            ...row('P1 1', 40, bar().setOffset(one.number, 0)),
            ...row('P2 2', 58, bar().setOffset(two.number, 0)),
            ...row('P3 1÷4', 76, bar().setOffset(one.number.div(4), 0)),
            ...row('K1 固定¼', 100, green().setClipRatio('left', 0.25)),
            ...row('K2 1', 118, green().setClipRatio('left', one.number)),
            ...row('K3 1÷4', 136, green().setClipRatio('left', one.number.div(4))),
            ...row('K4 25÷100', 154, green().setClipRatio('left', twentyfive.number.div(100))),
            close,
        )
    },
})
