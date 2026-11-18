/** 数值进度先在脚本中算比例，传给 JSON UI 的是 0 至 1000 的整数。 */
export function progressPermille(value: unknown, max: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`ProgressBar 的 value 必须是有限的数字（收到 ${value}）`)
    if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) throw new Error(`ProgressBar 的 max 必须是有限的正数（收到 ${max}）`)
    return Math.round(Math.min(max, Math.max(0, value)) / max * 1000)
}
