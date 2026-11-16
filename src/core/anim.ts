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
