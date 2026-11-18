/**
 * 计时显示：ProgressBar（进度条），由计时器（Timer）类型的数据驱动。
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
import { PropRef, type Expr } from '../core/expr.js'
import { Timer } from '../core/timer.js'

/** 参数须是默认值为 Timer 的 prop；返回总时长（秒） */
function timerSeconds(value: unknown, who: string): number {
    if (!(value instanceof PropRef) || !(value.defaultValue instanceof Timer)) {
        throw new Error(`${who} 的参数应是值为计时器的数据，例如 state() { return { cooldown: Timer.idle(10) } } 中的 cooldown`)
    }
    return value.defaultValue.seconds
}

/** 计时器编码中的千分比（去掉状态前缀后乘以 1 转为数字） */
const permilleOf = (p: PropRef): Expr => p.minus('I').minus('R').minus('P').minus('D').times(1)

/** 组件的像素尺寸（构建内部结构时需要） */
function pixelSize(el: Element, who: string): [number, number] {
    const s = el.size?.toJSON() as unknown[] | undefined
    if (!s || typeof s[0] !== 'number' || typeof s[1] !== 'number') throw new Error(`${who} 需要像素尺寸，例如 setSize(160, 8)`)
    return [s[0], s[1]]
}

/**
 * 进度条：随计时器匀速前进；界面重新打开时从当时的进度接着走。
 *
 *   new ProgressBar(cooldown).setSize(160, 8).setFill(Color.hex('#3fa04a'))
 *
 * 结构（「封顶」靠裁剪）：每一层是一个静止的裁剪容器（右边界固定），里面是「已完成部分」（1 像素宽的容器移到进度处）
 * 与「前进部分」（进行中时从进度处匀速增长）。动画的时长在构建时已定，重新打开后它会越过右端——越过的部分被裁剪容器裁掉，
 * 显示在右端处停住。头（setHead）用层的叠放画出：底层画到 x，上一层画到 x − 宽，露出的就是末端的竖条；各层的裁剪边界同样
 * 错开，所以头到达右端后停在那里，不会越过
 */
export class ProgressBar extends Panel {
    private fill = Color.hex('#3fa04a')
    private track: Color | undefined = Color.hex('#cfc3a3')
    private head: { color: Color, width: number, count: number, gap: number } | undefined
    private built: Element[] = []

    constructor(readonly value: PropRef) {
        super()
        this.seconds = timerSeconds(value, 'ProgressBar')
        this.setClip(true)
    }
    /** 总时长（秒，取自数据的初始值） */
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
        const px = permilleOf(this.value).times(W).div(1000)               // 当前进度（像素，整数）
        const running = this.value.contains('R')
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
            this.built.push(new Panel().setName(`layer${i}`).setSize(W - d, H).setAnchor(Anchor.TOP_LEFT).setClip(true).setLayer(i).add(
                // 已完成部分：画到「进度 − d」
                new Panel().setSize(1, H).setAnchor(Anchor.TOP_LEFT).setOffset(px.minus(d + W), 0).add(bar(color).setSize(W, H)),
                // 前进部分：进行中时从「进度 − d」匀速增长（W / T 像素每秒）；越过裁剪边界的部分不显示
                new Panel().setSize(1, H).setAnchor(Anchor.TOP_LEFT).setOffset(px.minus(d), 0).setVisible(running)
                    .add(bar(color).setSize(0, H).setAnims(Anim.size([0, H], [W, H], this.seconds))),
            ))
        })
        this.add(...this.built)
    }
}
