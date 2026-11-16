/**
 * 动画：JSON UI 的 anims，在客户端播放，不需要脚本参与。控件创建时（表单打开时）开始播放。
 *
 *   label.setAnims(
 *       Anim.alpha(0, 0, 2)                  // 保持透明 2 秒
 *           .then(Anim.alpha(1, 1, 1))       // 显示 1 秒
 *           .then(Anim.alpha(0, 0, 0.05)),   // 隐藏
 *   )
 *
 * 编译时每一段动画成为命名空间中的一个定义（anim_type、duration、from、to、easing），用 next 串起来；控件的 anims 引用第一段。
 * 类型：alpha、offset、size、color、wait；clip（裁剪比例）——原版界面没有用到它，但 sapdon 指导书的熔炉火焰与进度箭头用它循环播放，游戏支持。
 */
import { Color } from './values.js'

/** 动画的类型 */
export type AnimType = 'alpha' | 'offset' | 'size' | 'color' | 'clip' | 'wait'
/** 缓动方式（JSON UI 的 easing） */
export type AnimEasing = 'linear' | 'step' | 'in_quad' | 'out_quad' | 'in_out_quad' | 'in_cubic' | 'out_cubic' | 'in_out_cubic'
    | 'in_quart' | 'out_quart' | 'in_out_quart' | 'in_quint' | 'out_quint' | 'in_out_quint' | 'in_sine' | 'out_sine' | 'in_out_sine'
    | 'in_expo' | 'out_expo' | 'in_out_expo' | 'in_circ' | 'out_circ' | 'in_out_circ' | 'in_bounce' | 'out_bounce' | 'in_out_bounce'
    | 'in_back' | 'out_back' | 'in_out_back' | 'in_elastic' | 'out_elastic' | 'in_out_elastic'

type Pair = [number | string, number | string]
type AnimValue = number | Pair | number[]

/** 一段动画；用 then() 串成动画链 */
export class Anim {
    /** 播完这一段之后播放的下一段 */
    next?: Anim
    /** 缓动方式（缺省 linear） */
    easing: AnimEasing = 'linear'

    private constructor(readonly type: AnimType, readonly duration: number, readonly from?: AnimValue, readonly to?: AnimValue) {
        if (!(duration >= 0)) throw new Error(`动画的时长必须是非负数（收到 ${duration}）`)
    }

    /** 透明度从 from 变到 to（0 透明，1 不透明），用时 seconds 秒 */
    static alpha(from: number, to: number, seconds: number): Anim { return new Anim('alpha', seconds, from, to) }
    /** 偏移从 from 变到 to（像素或百分比），用时 seconds 秒 */
    static offset(from: Pair, to: Pair, seconds: number): Anim { return new Anim('offset', seconds, from, to) }
    /** 尺寸从 from 变到 to（像素或百分比），用时 seconds 秒（例如进度条：从 [100, 6] 到 [0, 6]） */
    static size(from: Pair, to: Pair, seconds: number): Anim { return new Anim('size', seconds, from, to) }
    /** 颜色从 from 变到 to，用时 seconds 秒 */
    static color(from: Color, to: Color, seconds: number): Anim { return new Anim('color', seconds, from.toJSON(), to.toJSON()) }
    /**
     * 图片的裁剪比例从 from 变到 to（0 完整显示，1 全部裁掉），用时 seconds 秒。图片要先 setClipRatio(方向, 起始比例)。
     * 例：进度箭头 clip(1, 0, 3)（从左往右填满）；燃尽的火焰 clip(0, 1, 3)（方向 down）
     */
    static clip(from: number, to: number, seconds: number): Anim { return new Anim('clip', seconds, from, to) }
    /** 等待 seconds 秒（保持控件原本的状态），通常接在动画链的开头或中间 */
    static wait(seconds: number): Anim { return new Anim('wait', seconds) }

    /** 设置缓动方式，返回这一段 */
    setEasing(easing: AnimEasing): this { this.easing = easing; return this }

    /** 动画链的最后一段 */
    private last(): Anim {
        const seen = new Set<Anim>()
        let a: Anim = this
        while (a.next && !seen.has(a.next)) { seen.add(a); a = a.next }
        return a
    }

    /** 在动画链的末尾接上 next（它本身也可以是一条链），返回链的第一段，可以继续 then() */
    then(next: Anim): this {
        const tail = this.last()
        if (tail.next) throw new Error('这条动画链已经循环（loop()），不能再接')
        tail.next = next
        return this
    }

    /** 播完最后一段后回到第一段，循环播放；返回链的第一段 */
    loop(): this {
        this.last().next = this
        return this
    }
}

// ───────── 在浏览器预览中播放：按经过的时间取动画的当前值 ─────────

/** 动画在某一时刻改变的属性（与控件属性同名：alpha、offset、size、color、clipRatio） */
export interface AnimSample { alpha?: number, offset?: [number, number], size?: [number, number], color?: number[], clipRatio?: number }

const EASE: Record<string, (p: number) => number> = {
    linear: (p) => p,
    step: (p) => (p < 1 ? 0 : 1),
    in_quad: (p) => p * p, out_quad: (p) => 1 - (1 - p) * (1 - p), in_out_quad: (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
    in_cubic: (p) => p ** 3, out_cubic: (p) => 1 - (1 - p) ** 3, in_out_cubic: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
    in_sine: (p) => 1 - Math.cos((p * Math.PI) / 2), out_sine: (p) => Math.sin((p * Math.PI) / 2), in_out_sine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
    in_expo: (p) => (p === 0 ? 0 : 2 ** (10 * p - 10)), out_expo: (p) => (p === 1 ? 1 : 1 - 2 ** (-10 * p)),
}

const lerp = (a: unknown, b: unknown, p: number): unknown => {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * p
    if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => (typeof x === 'number' && typeof b[i] === 'number' ? x + ((b[i] as number) - x) * p : p < 1 ? x : b[i]))
    return p < 1 ? a : b
}

function applySegment(out: AnimSample, a: Anim, p: number): void {
    const v = lerp(a.from, a.to, (EASE[a.easing] ?? EASE.linear)(Math.max(0, Math.min(1, p))))
    const pair = (x: unknown): [number, number] | undefined => (Array.isArray(x) && typeof x[0] === 'number' && typeof x[1] === 'number' ? [x[0], x[1]] : undefined)
    if (a.type === 'alpha') out.alpha = v as number
    else if (a.type === 'clip') out.clipRatio = v as number
    else if (a.type === 'color') out.color = v as number[]
    else if (a.type === 'offset') { const o = pair(v); if (o) out.offset = o }       // 百分比等非像素值不在预览中插值
    else if (a.type === 'size') { const s = pair(v); if (s) out.size = s }
}

/**
 * 动画链在经过 t 秒时的值：已播完的段取结束值、当前段按缓动插值；loop() 的链在循环部分内取模；
 * wait 保持之前的值；整条链播完后保持最后的状态（真机 1.45.0）。字符串（例如 '@ns.x' 引用的已有定义）在预览中不播放
 */
export function sampleAnims(anims: readonly (Anim | string)[] | undefined, t: number): AnimSample | undefined {
    if (!anims?.length) return undefined
    const out: AnimSample = {}
    for (const head of anims) {
        if (typeof head === 'string') continue
        const seq: Anim[] = [], seen = new Set<Anim>()
        let a: Anim | undefined = head
        while (a && !seen.has(a)) { seen.add(a); seq.push(a); a = a.next }
        const total = seq.reduce((s, x) => s + x.duration, 0)
        let time = Math.max(0, t)
        if (a) {                                            // 循环：a 是链指回的那一段
            const start = seq.indexOf(a)
            const pre = seq.slice(0, start).reduce((s, x) => s + x.duration, 0), cycle = total - pre
            if (cycle > 0 && time > pre) time = pre + ((time - pre) % cycle)
        }
        let acc = 0
        for (const seg of seq) {
            if (time >= acc + seg.duration) { if (seg.type !== 'wait') applySegment(out, seg, 1); acc += seg.duration; continue }
            if (seg.type !== 'wait') applySegment(out, seg, seg.duration > 0 ? (time - acc) / seg.duration : 1)
            break
        }
    }
    return Object.keys(out).length ? out : undefined
}
