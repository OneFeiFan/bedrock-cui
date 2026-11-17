/**
 * 静态检查：把真机上踩过的坑变成构建期的规则（出处：sapdon doc/dev/known-pitfalls.md、sapdon-ui.md）。
 */
import { isExpr } from '../core/expr.js'
import { walk, type RNode } from '../core/node.js'
import { parseSize } from '../layout/units.js'
import { measureText, textWidth, usesUnifont, withMetricsProfile, type MetricsProfile } from '../font/metrics.js'
import { Texture } from '../core/values.js'
import { GlyphSheet } from '../core/glyphs.js'
import { InlineIcon } from '../core/inline.js'
import { batchKey, layout, type Box, type TextureInfo } from '../layout/engine.js'

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
    /** 按哪些平台的字宽排版检查（缺省 PC 与安卓） */
    profiles?: MetricsProfile[]
}

/**
 * 按排版结果检查：contain 的元素里，子孙不得越出它的范围（有内边距时是内容面板的范围）。
 * 所有页面都排出来（忽略动态 visible）；overflow: true 的子树跳过（提示框等）。
 */
/**
 * 按排版结果检查。各平台字宽不同（PC 汉字 8.5、全角标点很窄；安卓都是 9），交给游戏折行的文字在安卓上行数可能更多：
 * 按每个字宽档案各排一次（缺省 PC 与安卓），只在某个平台出现的问题注明平台。
 */
export function lintLayout(roots: RNode[], options: LintOptions = {}): LintIssue[] {
    const profiles = options.profiles ?? ['pc', 'android']
    const out: LintIssue[] = []
    const seen = new Set<string>()
    for (const p of profiles) {
        for (const i of withMetricsProfile(p, () => lintLayoutOnce(roots, options))) {
            const key = `${i.rule}@${i.path}`
            if (seen.has(key)) continue
            seen.add(key)
            out.push(p === profiles[0] ? i : { ...i, message: `${i.message}（${p === 'android' ? '安卓' : p}字宽）` })
        }
    }
    return out
}

function lintLayoutOnce(roots: RNode[], options: LintOptions = {}): LintIssue[] {
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
        // 运行期文字（表达式）、高度自动，放在安全区里却没有裁剪：构建时不知道它有多长，排版时按一行算，运行时可能越过安全区
        // （真机 1.27.0：背包说明一长，最后一行压到了翻页箭头上）。放进定高 + setClip() 的面板，或 Scroll
        if (bounds && b.node.type === 'label' && isExpr(b.node.props.text) && !b.clip) {
            const h = b.node.props.size?.[1]
            if (h === undefined || h === 'default') issues.push({
                rule: 'runtime-text-unbounded', level: 'warning', path: b.node.path,
                message: `运行期文字的高度在构建时不知道，放在 ${bounds.path} 的安全区里可能越界（例如压到翻页箭头）：放进定高并 setClip() 的面板，或 Scroll`,
            })
        }
        // 同一个容器里两个文字控件互相重叠（真机 1.20.0：line_padding 让文字控件变高，压住了下面的说明）。
        // 带动态显示条件的跳过（「是 / 否」这种同一位置二选一的写法是有意叠放）
        // 带动画的也跳过（用透明度等动画错开显示时间的文字，例如倒计时的数字，是有意叠放）
        const labels = b.children.filter((c) => c.node.type === 'label' && !isExpr(c.node.props.visible) && !(c.node.props.anims as unknown[] | undefined)?.length)
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
            const a = labels[i].rect, c = labels[j].rect
            const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y)
            if (ox > 0.5 && oy > 0.5) issues.push({ rule: 'text-overlap', level: 'warning', path: labels[j].node.path, message: `与 ${labels[i].node.path.split('/').pop()} 重叠（${Math.round(ox * 10) / 10} × ${Math.round(oy * 10) / 10} 像素）` })
        }
        // 交给游戏折行的静态文字折出过短的行：游戏只在空格处换行（真机 1.23.0），中英混排时「数字 + 空格」后面一长串汉字整个移到下一行，
        // 留下很短的一行（「页首有一张 1」只占一半）。固定宽度的静态文字请用 Paragraph（CUI 预折行：按字断行、避头尾）。
        // CUI 排好的行（Paragraph）每行都以换行符结束，算段落的最后一行，不检查；运行期文字（表达式）也不检查
        if (b.node.type === 'label' && typeof b.node.props.text === 'string' && b.lines && b.rect.w > 0) {
            const fs = b.node.props.fontScale ?? 1, w = b.rect.w
            for (const para of b.node.props.text.split('\n')) {
                const lines = measureText(para, fs, w).lines
                const short = lines.slice(0, -1).find((l) => textWidth(l, fs) < w - 17 * fs)
                if (short !== undefined) {
                    issues.push({
                        rule: 'engine-wrap-short-line', level: 'warning', path: b.node.path,
                        message: `游戏只在空格处换行：这段文字会折出过短的行（「${short.replace(/§./g, '')}」只占 ${Math.round(textWidth(short, fs))}/${Math.round(w)}）——` + (b.node.props.paragraph
                            ? '文字中的英文单词或数字不能拆开，调整措辞（例如把英文单词移到行首附近）或折行宽度'
                            : '静态文字请用 Paragraph（缺省软换行：交给游戏、按各平台的字宽逐字排满），运行期文字用 bedrock-cui/runtime 的 softWrap'),
                    })
                    break
                }
            }
        }
        // 九宫格图片比自己的边框还小：游戏与预览的画法不同（真机 1.23.0：1×1 的紫色九宫格在游戏里画成更大、更深的方块，位置也偏）
        if (b.node.type === 'image' && b.slice) {
            const [l, t, r, bt] = b.slice
            if (b.rect.w + 0.01 < l + r || b.rect.h + 0.01 < t + bt) issues.push({
                rule: 'nineslice-too-small', level: 'warning', path: b.node.path,
                message: `九宫格图片 ${Math.round(b.rect.w * 10) / 10}×${Math.round(b.rect.h * 10) / 10} 比它的边框还小（左右 ${l + r}、上下 ${t + bt}）：游戏里的画法与预览不同，别用这么小的尺寸`,
            })
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
    issues.push(...lintCoveredText(boxes))
    issues.push(...lintFlexOverflow(roots, options))
    return issues
}

/**
 * 文字被图片盖住——游戏的绘制规则（真机 1.3.0 / 1.4.0 / 1.22.0 叠放实验）：先按层级；同一层里按材质分批（文字一批、每种贴图一批），
 * 各批的先后 = 这一批在控件树里（文档顺序）第一次出现的先后。所以：图片层级更高，或同层但这种贴图在这一层第一次出现得比文字晚 → 盖住文字。
 * 「第一次出现」只算会与这段文字同时显示的控件：另一个条件分支里的（例如书的另一页）不算。报关系最近的那张图。
 */
function lintCoveredText(boxes: Box[]): LintIssue[] {
    const issues: LintIssue[] = []
    const entries: { b: Box, chain: Box[], i: number }[] = []
    const collect = (b: Box, chain: Box[]) => {
        const c = [...chain, b]
        entries.push({ b, chain: c, i: entries.length })
        b.children.forEach((x) => collect(x, c))
    }
    boxes.forEach((b) => collect(b, []))
    const hasText = (b: Box) => isExpr(b.node.props.text) || String(b.node.props.text ?? '').replace(/§./g, '').trim() !== ''
    const lca = (a: Box[], b: Box[]) => { let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; return k }
    /** e 是否与 t 同时显示：e 在两者公共祖先之下没有动态显示条件 */
    const together = (t: { chain: Box[] }, e: { chain: Box[] }) => !e.chain.slice(lca(t.chain, e.chain)).some((x) => isExpr(x.node.props.visible))
    const texts = entries.filter((e) => e.b.node.type === 'label' && hasText(e.b))
    const images = entries.filter((e) => e.b.node.type === 'image' && e.b.texture)
    for (const t of texts) {
        const a = t.b.rect
        const world = entries.filter((e) => together(t, e))
        const firstOf = (z: number, key: string) => world.find((e) => e.b.z === z && batchKey(e.b) === key)?.i ?? Infinity
        const textFirst = firstOf(t.b.z, 'text')
        let best: { im: Box, k: number } | undefined
        for (const im of images) {
            if (im.b.z < t.b.z || !together(t, im)) continue
            if (im.b.z === t.b.z && firstOf(im.b.z, batchKey(im.b)!) < textFirst) continue   // 这种贴图在这一层先出现：先画，文字在上面
            const c = im.b.rect
            const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y)
            if (ox <= 0.5 || oy <= 0.5) continue
            const k = lca(t.chain, im.chain)
            if (!best || k > best.k) best = { im: im.b, k }
        }
        if (best) issues.push({
            rule: 'text-covered', level: 'warning', path: t.b.node.path,
            message: best.im.z > t.b.z
                ? `被图片 ${best.im.node.path.split('/').slice(-2).join('/')} 盖住：图片层级 ${best.im.z} 高于文字 ${t.b.z}`
                : `被图片 ${best.im.node.path.split('/').slice(-2).join('/')} 盖住：同在第 ${t.b.z} 层，这种贴图在这一层第一次出现得比文字晚（游戏同层按材质分批画，先出现的批先画）。把文字的 layer 调高一层最稳`,
        })
    }
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
    // 绑定的运算只有整数（真机 1.51.0：1 ÷ 4 得 0、'0.6' × 1 得 0）：运算中出现小数常数时提示
    const decimalIn = (e: unknown): number | undefined => {
        let found: number | undefined
        const visit = (x: unknown): void => {
            if (!x || typeof x !== 'object' || found !== undefined) return
            const o = x as { k?: string, op?: string, a?: unknown, b?: unknown, v?: unknown }
            if (o.k === 'bin' && ['+', '-', '*', '/', '%'].includes(o.op ?? '')) {
                for (const side of [o.a, o.b]) {
                    const s = side as { k?: string, v?: unknown }
                    if (s?.k === 'lit' && typeof s.v === 'number' && !Number.isInteger(s.v)) found = s.v
                }
            }
            visit(o.a); visit(o.b)
        }
        visit(isExpr(e) ? e.node : undefined)
        return found
    }
    walk(roots, (n) => {
        for (const [key, v] of Object.entries(n.props)) {
            const d = decimalIn(v)
            if (d !== undefined) push('decimal-arith', 'warning', n, `${key} 的表达式中有小数常数 ${d}：绑定的运算只有整数（真机），小数会按整数计算——改用整数，例如先乘后除，或让脚本直接传入算好的整数`)
        }
        if (n.props.web) push('web-only', 'error', n, `${n.props.web.tag === 'a' ? 'Link' : 'Html'} 是网页专用的元素（bedrock-cui/dom），不能编译成 JSON UI`)
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
        // 行内图标的记号字符只能用在 Text 里（Text 编译时换成图片控件）；写进普通文字控件，游戏会画成方框
        if (n.type === 'label' && typeof n.props.text === 'string' && InlineIcon.within(n.props.text)) {
            push('inline-icon-in-label', 'error', n, '行内图标（InlineIcon）只能用在 Text 里（编译时换成图片控件）；普通 Label 会把它画成方框。运行期文字请用 emoji 字形图标 + setLineSpacing(6)')
        }
        // 大字形图标（16 高）在多行文字里：以文字行为中心上下各多 4，行距 10 → 压到上下行（真机 1.17.0）
        if (n.type === 'label' && typeof n.props.text === 'string' && [...n.props.text].some((ch) => GlyphSheet.lookup(ch))) {
            const w = typeof n.props.size?.[0] === 'number' ? n.props.size[0] : Infinity
            const lines = measureText(n.props.text, n.props.fontScale ?? 1, w).lines.length
            if (lines > 1 && (n.props.lineSpacing ?? 0) < 6) push('glyph-line-overlap', 'warning', n, '字形图标（16 高、以文字行为中心）放在多行文字里会压到上下行：setLineSpacing(6) 让开；构建时确定的文字请用 Text + InlineIcon')
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
            push('collection-item-size', 'error', n, '显示 props 的控件与 button() 需要像素尺寸，例如 setSize(120, 10)：编译成正方形网格需要知道边长，否则内容不会显示')
        }
    })
    return issues
}
