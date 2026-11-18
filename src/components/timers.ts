/**
 * ProgressBar 支持计时器和普通数值。
 *
 * 做法「数值定起点，动画匀速走」（真机验证，docs/design/screen-api.md 第 16–18 节）：
 *   - 脚本只在打开或重新打开时传入当前进度（Timer 编码为 I0 / R<千分比> / P<千分比> / D1000）；
 *   - 界面按进度摆好起点：位置绑定的单位是控件自身的宽（高），所以移动的容器只有 1 像素宽（高），偏移即像素；
 *   - 之后交给匀速的动画（速度 = 总长度 ÷ 总时长），超出的部分由组件裁掉；计时期间不刷新、不吞点击。
 * 运算只用整数（真机：绑定的运算只有整数）；状态只用「包含」判断（不用比较）。
 */
import { Image, Panel, type Element } from '../core/element.js'
import { Anim } from '../core/anim.js'
import { Anchor, Color, Texture } from '../core/values.js'
import { lit, PropRef, type Expr } from '../core/expr.js'
import { progressPermille } from '../core/progress.js'
import { Timer } from '../core/timer.js'

/** 计时器编码中的千分比（去掉状态前缀后乘以 1 转为数字） */
const permilleOf = (p: PropRef): Expr => p.minus('I').minus('R').minus('P').minus('D').times(1)

/** 组件的像素尺寸（构建内部结构时需要） */
function pixelSize(el: Element, who: string): [number, number] {
    const s = el.size?.toJSON() as unknown[] | undefined
    if (!s || typeof s[0] !== 'number' || typeof s[1] !== 'number') throw new Error(`${who} 需要像素尺寸，例如 setSize(160, 8)`)
    return [s[0], s[1]]
}

/**
 * 进度条：接受计时器，或用 value 和 max 显示普通数值。
 *
 *   new ProgressBar(cooldown).setSize(160, 8).setFill(Color.hex('#3fa04a'))
 *   new ProgressBar(2.5, 4).setSize(160, 8)
 *
 * 结构（「封顶」靠裁剪）：每一层是一个静止的裁剪容器（右边界固定），里面是「已完成部分」（1 像素宽的容器移到进度处）
 * 与「前进部分」（进行中时从进度处匀速增长）。动画的时长在构建时已定，重新打开后它会越过右端——越过的部分被裁剪容器裁掉，
 * 显示在右端处停住。头（setHead）用层的叠放画出：底层画到 x，上一层画到 x − 宽，露出的就是末端的竖条；各层的裁剪边界同样
 * 错开，所以头到达右端后停在那里，不会越过
 */
export class ProgressBar<T extends number | PropRef = PropRef> extends Panel {
    private fill = Color.hex('#3fa04a')
    private track: Color | undefined = Color.hex('#cfc3a3')
    private head: { color: Color, width: number, count: number, gap: number } | undefined
    private built: Element[] = []
    private readonly progress: number | Expr
    private readonly running?: Expr

    constructor(readonly value: T, max?: number | PropRef) {
        super()
        if (max === undefined) {
            if (!(value instanceof PropRef) || !(value.defaultValue instanceof Timer)) {
                throw new Error('ProgressBar 的单个参数应是值为计时器的数据；数值进度需要传入 value 和 max')
            }
            this.seconds = value.defaultValue.seconds
            this.progress = permilleOf(value)
            this.running = value.contains('R')
        } else {
            this.seconds = 0
            const ref = value instanceof PropRef ? value : max instanceof PropRef ? max : undefined
            if (ref) {
                if (!ref._bindProgress) throw new Error('ProgressBar 的数值参数应是数字或当前页面的数据')
                this.progress = ref._bindProgress(value, max).number
            } else {
                this.progress = progressPermille(value, max)
            }
        }
        this.setClip(true)
    }
    /** 动画总时长（秒，取自计时器的初始值）；数值模式为 0。 */
    readonly seconds: number

    /** 已完成部分的颜色 */
    setFill(color: Color): this { this.fill = color; return this }
    /** 底色；undefined 表示不画底色 */
    setTrack(color: Color | undefined): this { this.track = color; return this }
    /** 末端的竖条（「头」）：count 条，宽 width、间隔 gap 像素；随末端移动，到达右端后停在那里（暂停时停在当前进度处） */
    setHead(color: Color, width = 2, count = 1, gap = 3): this { this.head = { color, width, count, gap }; return this }

    protected override beforeFinalize(): void {
        for (const e of this.built) this.remove(e)
        const [W, H] = pixelSize(this, 'ProgressBar')
        const width = this.running ? W : Math.floor(W)
        const px = typeof this.progress === 'number'
            ? lit(Math.floor(this.progress * width / 1000))
            : this.progress.times(width).div(1000)
        // 自下而上的层：[颜色, 比末端靠左多少像素]。没有头时只有一层（填充）
        const layers: [Color, number][] = []
        if (this.head) {
            const { color, width, count, gap } = this.head
            for (let i = 0; i < count; i++) { const lead = i * (width + gap); layers.push([color, lead], [this.fill, lead + width]) }
        } else layers.push([this.fill, 0])
        const bar = (color: Color) => new Image(Texture.SOLID).setColor(color).setAnchor(Anchor.TOP_LEFT)
        this.built = this.track ? [new Image(Texture.SOLID).setColor(this.track).setSize(W, H).setAnchor(Anchor.TOP_LEFT)] : []
        layers.forEach(([color, d], i) => {
            if (d >= W) return
            const layer = new Panel().setName(`layer${i}`).setSize(W - d, H).setAnchor(Anchor.TOP_LEFT).setClip(true).setLayer(i).add(
                // 已完成部分：画到「进度 − d」
                new Panel().setSize(1, H).setAnchor(Anchor.TOP_LEFT).setOffset(px.minus(d + W), 0).add(bar(color).setSize(W, H)),
            )
            // 计时模式的增长部分从「进度 − d」开始，越过裁剪边界的部分不显示。
            if (this.running) layer.add(new Panel().setSize(1, H).setAnchor(Anchor.TOP_LEFT).setOffset(px.minus(d), 0).setVisible(this.running)
                .add(bar(color).setSize(0, H).setAnims(Anim.size([0, H], [W, H], this.seconds))))
            this.built.push(layer)
        })
        this.add(...this.built)
    }
}
