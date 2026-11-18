/** 实验性数值帧；边界是协议自己的保守选择，不代表引擎已验证的精度上限。 */
export const LIVE_FRAME_MAX = 0xffffff
export type LiveFrameSchema = Record<string, { min?: number, max: number }>
export interface LiveField {
    readonly key: string
    readonly min: number
    readonly max: number
    readonly radix: number
    readonly stride: number
}

/** 多个有界整数编码成一帧；UI 仅需整数除法、乘法和减法解码。 */
export class LiveFrameCodec {
    readonly fields: readonly LiveField[]
    readonly maxValue: number

    constructor(schema: LiveFrameSchema) {
        if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('Live frame schema must be an object')
        let capacity = 1
        this.fields = Object.freeze(Object.entries(schema).map(([key, spec]) => {
            const min = spec?.min ?? 0, max = spec?.max
            if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
                throw new Error(`Invalid live field: ${key}`)
            }
            const radix = max - min + 1
            if (radix > (LIVE_FRAME_MAX + 1) / capacity) throw new Error('Live frame capacity exceeded')
            const field = Object.freeze({ key, min, max, radix, stride: capacity })
            capacity *= radix
            return field
        }))
        if (!this.fields.length) throw new Error('Live frame needs at least one field')
        this.maxValue = capacity - 1
    }

    /** 先验证整帧，再返回结果；有限数字取整并限制范围，未知/缺失字段报错。 */
    encode(values: Readonly<Record<string, number>>): number {
        if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Live values must be an object')
        if (Object.keys(values).some((key) => !this.fields.some((f) => f.key === key))) throw new Error('Unknown live field')
        let packed = 0
        for (const f of this.fields) {
            const n = values[f.key]
            if (!Object.prototype.hasOwnProperty.call(values, f.key) || !Number.isFinite(n)) throw new Error(`Live field must be finite: ${f.key}`)
            const value = Math.max(f.min, Math.min(f.max, Math.trunc(n)))
            packed += (value - f.min) * f.stride
        }
        return packed
    }

    decode(packed: number): Record<string, number> {
        if (!Number.isSafeInteger(packed) || packed < 0 || packed > this.maxValue) throw new Error('Invalid live frame')
        return Object.fromEntries(this.fields.map((f) => [f.key, Math.trunc(packed / f.stride) % f.radix + f.min]))
    }
}

/** 以实际像素精度采样；不可见的小数变化无需触发发送。 */
export function livePixels(value: number, max: number, width: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || !Number.isSafeInteger(width) || width <= 0) {
        throw new Error('livePixels requires finite values, positive max and positive integer width')
    }
    return Math.floor(Math.max(0, Math.min(1, value / max)) * width)
}
