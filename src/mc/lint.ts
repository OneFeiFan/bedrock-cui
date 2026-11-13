/**
 * 静态检查：把真机上踩过的坑变成构建期的规则（出处：sapdon doc/dev/known-pitfalls.md、sapdon-ui.md）。
 */
import { isExpr } from '../core/expr.js'
import { walk, type RNode } from '../core/node.js'
import { parseSize } from '../layout/units.js'
import type { TextureInfo } from '../layout/engine.js'

export interface LintIssue {
    rule: string
    level: 'error' | 'warning'
    path: string
    message: string
}

export interface LintOptions {
    /** 贴图信息（知道尺寸才能准确判断 keep_ratio 问题） */
    textures?: (path: string) => TextureInfo | undefined
}

const isFixed = (v: unknown) => v !== undefined && v !== 'default'

export function lint(roots: RNode[], options: LintOptions = {}): LintIssue[] {
    const issues: LintIssue[] = []
    const push = (rule: string, level: LintIssue['level'], n: RNode, message: string) => issues.push({ rule, level, path: n.path, message })

    // 同级重名
    const checkSiblings = (list: RNode[]) => {
        const seen = new Map<string, RNode>()
        for (const n of list) {
            if (seen.has(n.name)) push('duplicate-name', 'error', n, `同级已有名为 ${n.name} 的控件`)
            seen.set(n.name, n)
        }
    }
    checkSiblings(roots)

    walk(roots, (n) => {
        checkSiblings(n.children)
        if (n.slots) for (const s of [n.slots.default, n.slots.hover, n.slots.pressed]) checkSiblings(s)

        // keep_ratio 缺省 true：非正方形区域里拉伸贴图会被缩成居中的正方形 / 一个点（known-pitfalls §4.20）
        if (n.type === 'image' && n.props.keepRatio === undefined && n.props.nineslice === undefined) {
            const [w, h] = n.props.size ?? []
            const tex = isExpr(n.props.texture) ? undefined : options.textures?.(n.props.texture)
            if (isFixed(w) && isFixed(h) && !tex?.nineslice) {
                const sw = parseSize(w), sh = parseSize(h)
                const numeric = sw.kind === 'expr' && sh.kind === 'expr' && sw.terms.every((t) => t.unit === 'px') && sh.terms.every((t) => t.unit === 'px')
                const aspect = numeric ? (sw as any).terms.reduce((a: number, t: any) => a + t.value, 0) / Math.max(1e-9, (sh as any).terms.reduce((a: number, t: any) => a + t.value, 0)) : undefined
                const texAspect = tex?.size ? tex.size[0] / tex.size[1] : undefined
                const mismatch = aspect !== undefined && texAspect !== undefined ? Math.abs(aspect / texAspect - 1) > 0.01 : !numeric || texAspect === undefined
                if (mismatch) {
                    push('keep-ratio', 'warning', n, `贴图 ${String(n.props.texture)} 在 ${JSON.stringify(n.props.size)} 里会按原比例缩小居中（JSON UI 的 keep_ratio 缺省为 true）。要拉伸请写 keepRatio={false}，要保持比例请写 keepRatio`)
                }
            }
        }
        // collection_index 不是合法属性（sapdon-ui.md §7.3：Unknown property）
        if (n.props.raw && 'collection_index' in n.props.raw) push('collection-index', 'error', n, 'collection_index 不是合法的 UI 属性（引擎报 Unknown property）；绑定集合项请用 FormButton / collection_item')
        // 尺寸表达式能否解析
        for (const v of [...(n.props.size ?? []), ...(n.props.offset ?? [])]) {
            try { parseSize(v) } catch (e) { push('bad-size', 'error', n, (e as Error).message) }
        }
        // 按钮写百分比尺寸放进集合项：格位面板不设尺寸时会被算成以格高为边长的正方形
        if (n.type === 'collection_item' && (typeof n.props.size?.[0] !== 'number' || typeof n.props.size?.[1] !== 'number')) {
            push('collection-item-size', 'warning', n, '集合项（FormButton）请写像素尺寸：编译成正方形网格需要知道边长')
        }
    })
    return issues
}
