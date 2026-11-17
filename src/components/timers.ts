/**
 * 计时显示：ProgressBar（进度条）与 Countdown（倒计时数字），由计时器（Timer）类型的 prop 驱动。
 *
 * 做法「数值定起点，动画匀速走」（真机验证，docs/design/screen-api.md 第 16–18 节）：
 *   - 脚本只在打开或重新打开时传入当前进度（Timer 编码为 I0 / R<千分比> / P<千分比> / D1000）；
 *   - 界面按进度摆好起点：位置绑定的单位是控件自身的宽（高），所以移动的容器只有 1 像素宽（高），偏移即像素；
 *   - 之后交给匀速的动画（速度 = 总长度 ÷ 总时长），超出的部分由组件裁掉；计时期间不刷新、不吞点击。
 * 运算只用整数（真机：绑定的运算只有整数）；状态只用「包含」判断（不用比较）。
 */
import { Image, Label, Panel, type Element } from '../core/element.js'
import { Anim } from '../core/anim.js'
import { Anchor, Color, Texture, type TextStyle } from '../core/values.js'
import { PropRef, lit, type Expr } from '../core/expr.js'
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

/**
 * 倒计时：显示剩余的整秒数。进行中时数字匀速向上滚动（里程表式），界面重新打开时从当时的位置接着滚；
 * 未开始、暂停、完成时停在整秒处。组件的高度即一行的高度。
 *
 *   new Countdown(cooldown).setSize(40, 10)
 *   new Countdown(cooldown, (n) => `${n} 秒`).setBackground(Color.hex('#2b2b2b')).setSize(60, 10)
 *
 * 动画的时长在构建时已定，重新打开后它会滚过 0：
 *   - 有底色（setBackground）时：滚动的每一行都有不透明的底，后面放一个静止的「0」——滚过「1」之后露出它，停在 0，不需要刷新；
 *   - 没有底色时：计时结束时由运行时刷新一次（界面选项 timerEndRefresh: false 可关闭）
 */
export class Countdown extends Panel {
    private textColor: Color | undefined
    private textStyle: TextStyle | undefined
    private background: Color | undefined
    private built: Element[] = []
    /** 总时长（秒，取自数据的初始值；按整秒向上取整） */
    readonly seconds: number

    constructor(readonly value: PropRef, private readonly format: (n: number) => string = (n) => String(n)) {
        super()
        this.seconds = Math.ceil(timerSeconds(value, 'Countdown'))
        value._refreshAtEndCount = (value._refreshAtEndCount ?? 0) + 1     // 没有底色时需要结束时刷新（setBackground 取消）
        this.setClip(true)
    }

    /** 数字的颜色 */
    setTextColor(color: Color): this { this.textColor = color; return this }
    /** 数字的样式 */
    setTextStyle(style: TextStyle): this { this.textStyle = style; return this }
    /** 底色（不透明）：有底色时，倒计时在 0 处准确停下，不需要计时结束时刷新 */
    setBackground(color: Color): this {
        if (!this.background) this.value._refreshAtEndCount = Math.max(0, (this.value._refreshAtEndCount ?? 1) - 1)
        this.background = color
        return this
    }

    protected override beforeFinalize(): void {
        for (const e of this.built) this.remove(e)
        const [W, LH] = pixelSize(this, 'Countdown')
        const T = this.seconds
        const p = permilleOf(this.value)
        const bg = this.background
        const label = (n: number, layer?: number) => {
            const l = new Label(this.format(n)).setAnchor(Anchor.TOP_CENTER)
            if (this.textStyle) l.setStyle(this.textStyle)
            if (this.textColor) l.setColor(this.textColor)
            if (layer !== undefined) l.setLayer(layer)
            return l
        }
        // 一列数字。没有底色：T … 0，之后再接 T 个 0（重新打开后动画可能多滚一段，多出的部分仍显示 0）。
        // 有底色：滚动的一列只有 T … 1，每行有不透明的底（第 2 层，数字第 3 层），「0」由后面静止的那个提供
        const strip = (rows: number, opaque: boolean) => {
            const s = new Panel().setSize(W, rows * LH).setAnchor(Anchor.TOP_LEFT)
            for (let k = 0; k < rows; k++) {
                const n = Math.max(T - k, 0)
                if (opaque) {
                    s.add(new Panel().setSize(W, LH).setAnchor(Anchor.TOP_LEFT).setOffset(0, k * LH).add(
                        new Image(Texture.SOLID).setColor(bg!).setSize(W, LH).setLayer(2),
                        label(n, 3),
                    ))
                } else s.add(label(n).setOffset(0, k * LH))
            }
            return s
        }
        const running = this.value.contains('R')
        // 未开始、暂停、完成 = 不包含 R：编译为一个等式 ((x - 'R') = x)，不含 not 与 or
        // （真机 1.59.0 not (not …) 失效；1.60.0「包含 I 或 P 或 D」在暂停时为假）
        const still = this.value.minus('R').eq(this.value)
        this.built = [
            ...(bg ? [
                new Image(Texture.SOLID).setColor(bg).setSize(W, LH).setAnchor(Anchor.TOP_LEFT),
                // 静止的「0」：在滚动的一列后面（第 1 层），滚过「1」之后露出
                new Panel().setName('zero').setSize(W, LH).setAnchor(Anchor.TOP_LEFT).setVisible(running).add(label(0, 1)),
            ] : []),
            // 进行中：从已过去的位置（像素，连续）开始，以每秒一行的速度向上滚动
            new Panel().setName('rolling').setSize(1, 1).setAnchor(Anchor.TOP_LEFT)
                .setOffset(0, lit(0).minus(p.times(T * LH).div(1000))).setVisible(running)
                .add(strip(bg ? T : 2 * T + 1, !!bg).setAnims(Anim.offset([0, 0], [0, -T * LH], T))),
            // 未开始、暂停、完成：停在已过去的整秒处
            new Panel().setName('still').setSize(1, 1).setAnchor(Anchor.TOP_LEFT)
                .setOffset(0, lit(0).minus(p.times(T).div(1000).times(LH))).setVisible(still)
                .add(strip(T + 1, false)),
        ]
        this.add(...this.built)
    }
}
