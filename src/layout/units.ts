/**
 * JSON UI 尺寸 / 偏移表达式（Bedrock Wiki · JSON UI Documentation）：
 *   数字 / 'Npx'      像素
 *   'N%'              父控件对应轴的百分比
 *   'N%c'             子控件总尺寸（stack 沿排列方向求和，其余取最大）
 *   'N%cm'            最大的可见子控件
 *   'N%sm'            兄弟控件（近似为父控件剩余空间，罕用）
 *   'N%x' / 'N%y'     自身宽 / 高的百分比
 *   'fill'            stack 里填满剩余空间（其它场合 = 100%）
 *   'default'         label = 文字尺寸，其它 = 100%
 * 可混合加减：'100% - 2px'、'100%c + 8px'、'50%-68px'、'100.0%c+-7.0px'。
 */
export type Unit = 'px' | '%' | '%c' | '%cm' | '%sm' | '%x' | '%y'
export interface Term { unit: Unit, value: number }
export type SizeSpec = { kind: 'default' } | { kind: 'fill' } | { kind: 'expr', terms: Term[] }

const TERM = /([+-])?\s*([+-])?\s*(\d+(?:\.\d+)?)\s*(px|%cm|%sm|%c|%x|%y|%)?/y

export function parseSize(v: number | string | undefined): SizeSpec {
    if (v === undefined || v === 'default') return { kind: 'default' }
    if (typeof v === 'number') return { kind: 'expr', terms: [{ unit: 'px', value: v }] }
    const s = v.trim()
    if (s === 'fill') return { kind: 'fill' }
    const terms: Term[] = []
    let i = 0
    while (i < s.length) {
        if (/\s/.test(s[i])) { i++; continue }
        TERM.lastIndex = i
        const m = TERM.exec(s)
        if (!m || m[0] === '') throw new Error(`无法解析尺寸表达式：${JSON.stringify(v)}（在第 ${i} 个字符）`)
        const sign = (m[1] === '-' ? -1 : 1) * (m[2] === '-' ? -1 : 1)
        terms.push({ unit: (m[4] ?? 'px') as Unit, value: sign * Number(m[3]) })
        i = TERM.lastIndex
    }
    if (!terms.length) throw new Error(`空的尺寸表达式：${JSON.stringify(v)}`)
    return { kind: 'expr', terms }
}

export interface UnitContext {
    parent: number
    children: number
    childrenMax: number
    sibling: number
    selfX: number
    selfY: number
}

export function evalTerms(terms: Term[], c: UnitContext): number {
    let total = 0
    for (const t of terms) {
        switch (t.unit) {
            case 'px': total += t.value; break
            case '%': total += (t.value / 100) * c.parent; break
            case '%c': total += (t.value / 100) * c.children; break
            case '%cm': total += (t.value / 100) * c.childrenMax; break
            case '%sm': total += (t.value / 100) * c.sibling; break
            case '%x': total += (t.value / 100) * c.selfX; break
            case '%y': total += (t.value / 100) * c.selfY; break
        }
    }
    return total
}

export const usesChildren = (s: SizeSpec) => s.kind === 'expr' && s.terms.some((t) => t.unit === '%c' || t.unit === '%cm')
export const usesSelf = (s: SizeSpec, unit: '%x' | '%y') => s.kind === 'expr' && s.terms.some((t) => t.unit === unit)

/** 偏移：像素或父控件百分比（也可写表达式） */
export function evalOffset(v: number | string | undefined, parent: number): number {
    if (v === undefined) return 0
    const spec = parseSize(v)
    if (spec.kind !== 'expr') return 0
    return evalTerms(spec.terms, { parent, children: 0, childrenMax: 0, sibling: parent, selfX: 0, selfY: 0 })
}
