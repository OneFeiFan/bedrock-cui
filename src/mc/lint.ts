/**
 * 静态检查：把真机上踩过的坑变成构建期的规则（出处：sapdon doc/dev/known-pitfalls.md、sapdon-ui.md）。
 */
import { isExpr } from '../core/expr.js'
import { walk, type RNode } from '../core/node.js'
import { parseSize } from '../layout/units.js'
import { measureText, usesUnifont } from '../font/metrics.js'
import { Texture } from '../core/values.js'
import { GlyphSheet } from '../core/glyphs.js'
import { layout, type Box, type TextureInfo } from '../layout/engine.js'

export interface LintIssue {
    rule: string
    level: 'error' | 'warning'
    path: string
    message: string
}

export interface LintOptions {
    /** 贴图信息（知道尺寸才能准确判断 keep_ratio 问题） */
    textures?: (path: string) => TextureInfo | undefined
    /** 按排版结果检查越界时用的视口（缺省 [400, 300]） */
    viewport?: [number, number]
    /** 检查弹性布局「内容放不下」时试的屏幕尺寸（缺省 400×300 与极小的 240×135） */
    viewports?: [number, number][]
    /** 只给这些根的绑定加 binding_condition: always（缺省全部） */
    alwaysRoots?: string[]
}

/**
 * 按排版结果检查：contain 的元素里，子孙不得越出它的范围（有内边距时是内容面板的范围）。
 * 所有页面都排出来（忽略动态 visible）；overflow: true 的子树跳过（提示框等）。
 */
export function lintLayout(roots: RNode[], options: LintOptions = {}): LintIssue[] {
    const issues: LintIssue[] = []
    let boxes: Box[]
    // 排不出来（例如尺寸表达式写错——静态检查的 bad-size 已经报了）就跳过
    try { boxes = layout(roots, { viewport: options.viewport ?? [400, 300], textures: options.textures, forceVisible: true }) } catch { return issues }
    const visit = (b: Box, bounds: { rect: Box['rect'], path: string } | undefined) => {
        if (b.node.props.overflow) return
        if (bounds) {
            const r = b.rect, o = bounds.rect
            const out = [o.x - r.x, r.x + r.w - (o.x + o.w), o.y - r.y, r.y + r.h - (o.y + o.h)].map((v) => Math.max(0, Math.round(v * 10) / 10))
            if (out.some((v) => v > 0.01)) {
                const side = ['左', '右', '上', '下'].map((s, i) => (out[i] > 0.01 ? `${s} ${out[i]}` : '')).filter(Boolean).join('、')
                issues.push({ rule: 'out-of-bounds', level: 'warning', path: b.node.path, message: `越出 ${bounds.path} 的安全区（${side} 像素）` })
                return // 只报最外层越界的元素，子孙不再重复报
            }
        }
        // 自己是 contain：子孙的边界 = 自己（有内边距时 = 内容面板）
        let next = bounds
        if (b.node.props.contain) {
            const content = b.children.find((c) => c.node.props.padded)
            next = { rect: (content ?? b).rect, path: b.node.path }
        }
        for (const c of b.children) visit(c, next)
    }
    boxes.forEach((b) => visit(b, undefined))
    issues.push(...lintFlexOverflow(roots, options))
    return issues
}

/**
 * 弹性布局在几种屏幕尺寸下排一遍：Row / Column 里的内容沿主轴放不下 → 警告（屏幕变小时会和后面的内容重叠——真机 1.9.0 响应式演示）。
 * 会变长的内容放进 Scroll，或调大 setMinSize。
 */
function lintFlexOverflow(roots: RNode[], options: LintOptions): LintIssue[] {
    const issues: LintIssue[] = []
    const seen = new Set<string>()
    for (const vp of options.viewports ?? [[400, 300], [240, 135]]) {
        let boxes: Box[]
        try { boxes = layout(roots, { viewport: vp, textures: options.textures, forceVisible: true }) } catch { continue }
        const visit = (b: Box) => {
            if (b.node.type === 'stack' && b.node.name === 'flex' && !seen.has(b.node.path)) {
                const vertical = b.node.props.orientation !== 'horizontal'
                const own = vertical ? b.rect.h : b.rect.w
                const used = b.children.reduce((a, c) => a + (vertical ? c.rect.h : c.rect.w), 0)
                if (used - own > 0.5) {
                    seen.add(b.node.path)
                    const owner = b.node.path.split('/').slice(0, -1).filter((x) => x !== 'content').pop()
                    issues.push({ rule: 'flex-overflow', level: 'warning', path: b.node.path, message: `${owner} 的内容在 ${vp[0]}×${vp[1]} 屏幕上放不下（超出 ${Math.round(used - own)} 像素）：会变长的内容放进 Scroll，或调大 setMinSize` })
                }
            }
            if (b.node.type !== 'scroll') b.children.forEach(visit)
        }
        boxes.forEach(visit)
    }
    return issues
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

    // 开关的名字要全局唯一：别的控件按名字（source_control_name）读它的状态
    const toggles = new Map<string, RNode>()
    walk(roots, (n) => {
        checkSiblings(n.children)
        if (n.slots) for (const s of Object.values(n.slots)) checkSiblings(s)
        if (n.type === 'toggle') {
            if (!Number.isInteger(n.props.index) || n.props.index < 0) push('toggle-index', 'error', n, `开关序号必须是非负整数（现在是 ${n.props.index}）：toggle_group_forced_index 的 -1 表示「不强制、按顺序自动分配」，会和别的开关撞号`)
            if (toggles.has(n.name)) push('toggle-name-unique', 'error', n, `开关名 ${n.name} 与 ${toggles.get(n.name)!.path} 重复：别的控件按名字读开关状态，必须全局唯一`)
            toggles.set(n.name, n)
        }

        // keep_ratio 缺省 true：非正方形区域里拉伸贴图会被缩成居中的正方形 / 一个点（known-pitfalls §4.20）
        if (n.type === 'image' && n.props.keepRatio === undefined && n.props.nineslice === undefined) {
            const [w, h] = n.props.size ?? []
            const tex = isExpr(n.props.texture) ? undefined : options.textures?.(n.props.texture) ?? Texture.info(n.props.texture)
            if (isFixed(w) && isFixed(h) && !tex?.nineslice) {
                const sw = parseSize(w), sh = parseSize(h)
                const numeric = sw.kind === 'expr' && sh.kind === 'expr' && sw.terms.every((t) => t.unit === 'px') && sh.terms.every((t) => t.unit === 'px')
                const aspect = numeric ? (sw as any).terms.reduce((a: number, t: any) => a + t.value, 0) / Math.max(1e-9, (sh as any).terms.reduce((a: number, t: any) => a + t.value, 0)) : undefined
                const texAspect = tex?.size ? tex.size[0] / tex.size[1] : undefined
                // 只在「知道贴图尺寸、比例确实对不上」时报；百分比尺寸的区域比例取决于父控件，贴图是 1×1 才确定会出问题
                const mismatch = texAspect === undefined ? false
                    : aspect !== undefined ? Math.abs(aspect / texAspect - 1) > 0.01
                    : tex!.size![0] === tex!.size![1] && tex!.size![0] <= 2
                if (mismatch) {
                    push('keep-ratio', 'warning', n, `贴图 ${String(n.props.texture)} 在 ${JSON.stringify(n.props.size)} 里会按原比例缩小居中（JSON UI 的 keep_ratio 缺省为 true）。要拉伸请写 keepRatio={false}，要保持比例请写 keepRatio`)
                }
            }
        }
        if (n.props.grow) push('grow-outside-flex', 'warning', n, 'setGrow() 只在 Row / Column 的直接子元素上起作用；这里的父元素不是弹性容器')
        // 大字形图标（16 高）在多行文字里：以文字行为中心上下各多 4，行距 10 → 压到上下行（真机 1.17.0）
        if (n.type === 'label' && typeof n.props.text === 'string' && [...n.props.text].some((ch) => GlyphSheet.lookup(ch)?.kind === 'emoji')) {
            const w = typeof n.props.size?.[0] === 'number' ? n.props.size[0] : Infinity
            const lines = measureText(n.props.text, n.props.fontScale ?? 1, w).lines.length
            if (lines > 1) push('glyph-line-overlap', 'warning', n, 'emoji 页的字形图标（16 高）放在多行文字里会压到上下行：正文里用文字页图标（GlyphSheet(\'A0\', { kind: \'text\' })，与汉字同高），emoji 页图标放标题或单独一行')
        }
        // §k 乱码：含汉字（整段用 Unifont 画）时真机只显示成一串点（1.5.3）
        if (n.type === 'label' && typeof n.props.text === 'string' && /§k/i.test(n.props.text) && usesUnifont(n.props.text)) {
            push('obfuscated-unifont', 'warning', n, '§k 乱码出现在含汉字的文字里：整段用 Unifont 画，真机只显示成一串点；乱码请放在纯 ASCII 的文字框里')
        }
        // 文字溢出：宽高都固定的文字框放不下（静态文字才能在构建期判断）
        if (n.type === 'label' && typeof n.props.text === 'string' && typeof n.props.size?.[0] === 'number' && typeof n.props.size?.[1] === 'number') {
            const m = measureText(n.props.text, n.props.fontScale ?? 1, n.props.size[0])
            if (m.height > n.props.size[1]) push('text-overflow', 'warning', n, `文字折行后约 ${m.lines.length} 行（${m.height} 像素高），放不进 ${n.props.size[1]} 像素高的文字框；高度写 'default' 或用 paginate() 分页`)
        }
        // stack 交叉方向写 %c：真机是子控件之和（提示框比文字宽很多），贴合最宽的子控件要用 %cm
        if (n.type === 'stack') {
            const vertical = (n.props.orientation ?? 'vertical') === 'vertical'
            const cross = n.props.size?.[vertical ? 0 : 1]
            if (typeof cross === 'string' && /%c(?!m)/.test(cross)) push('stack-cross-c', 'warning', n, `${vertical ? '纵向' : '横向'} stack 的${vertical ? '宽' : '高'}写了 ${cross}：交叉方向的 %c 是子控件之和（真机），要贴合最${vertical ? '宽' : '高'}的子控件请用 %cm`)
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
