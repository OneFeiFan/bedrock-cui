import { LiveFrameCodec } from '../core/liveFrame.js'
import type { Expr } from '../core/expr.js'

/**
 * 从同一个数值表达式拆出各字段。避开未验证的取模运算符，余数写成 q - (q / radix) * radix。
 * 依赖 JSON UI 的整数除法；多字段接收仍须真机验证，不表示任意文字都能放入数值帧。
 */
export function liveFrameFields(codec: LiveFrameCodec, packed: Expr): Record<string, Expr> {
    return Object.fromEntries(codec.fields.map((f, i) => {
        const q = f.stride === 1 ? packed : packed.div(f.stride)
        const digit = i === codec.fields.length - 1 ? q : q.minus(q.div(f.radix).times(f.radix))
        return [f.key, f.min === 0 ? digit : digit.plus(f.min)]
    }))
}
