/**
 * 富文本（基岩版 § 格式码）与长文本：解析、测宽、确定性预折行、分页。
 *
 * 基岩版格式码（与 Java 版不同）：
 *   颜色 §0–§f；基岩版独有 §g（硬币金）与材料色 §h §i §j §m §n §p §q §s §t §u §v——§m / §n 在基岩版是**颜色**，
 *   没有删除线 / 下划线；格式 §k 乱码、§l 粗体、§o 斜体、§r 重置。
 *   **换颜色不清掉粗体 / 斜体**（Java 版会清），只有 §r 全部重置。
 *
 * 预折行（wrapText）：按字宽表折行，英文单词不拆，避头尾（句读不在行首、左括号不在行尾），可选中英文自动留空；
 * 每一行开头**补上当前样式码**——无论引擎会不会把颜色延续到下一行，显示都对。行宽留出 hang 像素给挂在行尾的标点，
 * 保证引擎不会再折一次。
 */
import { LINE_HEIGHT, boldExtra, charWidth, isWide, measureText, textWidth, usesUnifont, withMetricsProfile, type MetricsProfile } from './metrics.js'

/** 基岩版颜色（前 16 个与 Java 相同；§g 起为基岩版独有；§v 树脂色为资料值，未在真机核对） */
export const BEDROCK_COLORS: Record<string, string> = {
    '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA', '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
    '8': '#555555', '9': '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF',
    g: '#DDD605', h: '#E3D4D1', i: '#CECACA', j: '#443A3B', m: '#971607', n: '#B4684D', p: '#DEB12D', q: '#47A036',
    s: '#2CBAA8', t: '#21497B', u: '#9A5CC6', v: '#EB7114',
}

/** 格式码解析出的一段文字的样式（粗体 / 斜体 / 颜色 / 乱码）。面向用户的文字样式是 values.ts 的 TextStyle */
export interface RunStyle {
    /** 颜色码（'c'、'g'…）；undefined = 控件本身的颜色 */
    color?: string
    bold: boolean
    italic: boolean
    obfuscated: boolean
}
export const PLAIN: RunStyle = { color: undefined, bold: false, italic: false, obfuscated: false }

export interface Run { text: string, style: RunStyle }

/** 应用一个格式码（基岩版语义：颜色不清掉粗体 / 斜体，§r 全部重置）；不认识的码原样忽略 */
export function applyCode(style: RunStyle, code: string): RunStyle {
    const c = code.toLowerCase()
    if (c === 'r') return { ...PLAIN }
    if (c === 'l') return { ...style, bold: true }
    if (c === 'o') return { ...style, italic: true }
    if (c === 'k') return { ...style, obfuscated: true }
    if (BEDROCK_COLORS[c]) return { ...style, color: c }
    return style
}

/** 拆成样式段 */
export function parseRich(text: string, start: RunStyle = PLAIN): { runs: Run[], end: RunStyle } {
    const runs: Run[] = []
    let style = start
    let buf = ''
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '§' && i + 1 < text.length) {
            if (buf) { runs.push({ text: buf, style }); buf = '' }
            style = applyCode(style, text[i + 1])
            i++
            continue
        }
        buf += text[i]
    }
    if (buf) runs.push({ text: buf, style })
    return { runs, end: style }
}

/** 重建样式所需的格式码（行首补码用） */
export function styleCodes(style: RunStyle): string {
    return (style.color ? `§${style.color}` : '') + (style.bold ? '§l' : '') + (style.italic ? '§o' : '') + (style.obfuscated ? '§k' : '')
}

/** 富文本宽度（像素）：§ 码不占宽度，粗体加 boldExtra；`unifont` 缺省按这段文字的内容决定 */
export function richWidth(text: string, scale = 1, start: RunStyle = PLAIN, unifont = usesUnifont(text)): number {
    let w = 0
    for (const r of parseRich(text, start).runs) for (const ch of r.text) w += charWidth(ch, unifont) + (r.style.bold ? boldExtra(ch, unifont) : 0)
    return w * scale
}

/** 避头：不能出现在行首的标点（挂在上一行末尾） */
export const NO_LINE_START = '，。、；：？！）》」』】〕〉”’…—～·%,.;:?!)]}'
/** 避尾：不能留在行尾的标点（带到下一行） */
export const NO_LINE_END = '（《「『【〔〈“‘([{'

/** 汉字与中文标点（标点后面接英文要留空：基岩版的中文标点是窄字形、不带间距——真机反馈「；Esc」） */
const CJK = '[\\u2E80-\\u9FFF\\uF900-\\uFAFF\\u3000-\\u303F\\uFF00-\\uFFEF]'
/** 只有汉字（英文后面接**标点**不留空：「Minecraft、Bedrock」「JSON UI）」） */
const HAN = '[\\u2E80-\\u2FFF\\u3040-\\u9FFF\\uF900-\\uFAFF]'
/**
 * 中英文之间留一个空格（已有空格的不重复加；§ 码不影响判断）：只在**汉字**与英文 / 数字之间留，全角标点前后都不加
 * （通行的中文排版规范：「上：emoji」「×1、diamond」「（1.22.0）」）。先前中文标点后面也加，真机看起来多出一截空隙。
 */
export function autoSpace(text: string): string {
    return text
        .replace(new RegExp(`(${HAN})((?:§.)*)([A-Za-z0-9@#&])`, 'g'), '$1 $2$3')
        // (?<!§)：格式码的那个字母 / 数字（§9 的 9）不算英文
        .replace(new RegExp(`(?<!§)([A-Za-z0-9%])((?:§.)*)(${HAN})`, 'g'), '$1$2 $3')
}

/** 不换行空格 */
export const NBSP = '\u00A0'

export interface SoftWrapOptions {
    /** 中英文自动留空（缺省 true；只决定「哪些交界处要有间隔」，间隔用什么由 spacing 定） */
    autoSpace?: boolean
    /**
     * 全宽字符（汉字、全角标点）与英文 / 数字交界处的间隔：
     *   'auto'（缺省，需要 width）= 每处分别试「不换行空格」与「不留」，按各平台的折行模拟打分择优；
     *   'nbsp' = 一律不换行空格；'none' = 一律去掉
     */
    spacing?: 'auto' | 'nbsp' | 'none'
    /** 文字控件的宽度（像素；'auto' 用它模拟游戏折行） */
    width?: number
    /** font_scale_factor */
    scale?: number
    /** 按哪些平台的字宽择优（缺省 PC 与安卓） */
    profiles?: MetricsProfile[]
    /**
     * 择优的力度：'full'（缺省，构建时用）= 每处交界的每种间隔都试，直到不能再改善；
     * 'fast'（脚本端缺省）= 按规则给初值（挨着英文单词留普通空格、挨着数字不留），只修出问题的地方——QuickJS 上一次折行模拟约 0.65 毫秒，
     * 'full' 一段要模拟几百次（真机 1.29.0：每次打开、翻页界面消失几秒），'fast' 通常十几次
     */
    effort?: 'full' | 'fast'
}

/**
 * 软换行：交给游戏折行，但让它**逐字排满**（真机 1.28.0，PC 与安卓）。游戏只在空格处换行，而且「单词」一整行放得下就整个移到下一行——
 * 中英混排时数字两边的空格后面一长串汉字被整个挪走，留下半行。把全宽字符与英文 / 数字交界处的空格换成不换行空格（U+00A0）或去掉之后，
 * 整段没有可断的空格（英文单词之间的照旧），游戏把它当成一个超长单词，用**当前平台的真实字宽**逐字排满。
 * 不换行空格判断宽度时按 9 算、画 4（metrics.NBSP_BREAK_WIDTH），而且换行落在它上面时它会跑到下一行行首（小缩进）；去掉则可能让标点落到行首
 * （游戏逐字排不处理避头尾）。'auto' 用 PC 与安卓的折行模拟（与两台真机逐字一致）对每处交界择优。
 */
export function softWrapText(text: string, options: SoftWrapOptions = {}): string {
    const src = (options.autoSpace ?? true) ? autoSpace(text) : text
    // 按段落分别处理：段落之间互不影响（每行都从头量起）——搜索的规模与长度都小得多（脚本端在 QuickJS 上跑，真机 1.29.0 整段一起搜要好几秒）
    return src.split('\n').map((para) => softWrapParagraph(para, options)).join('\n')
}

function softWrapParagraph(src: string, options: SoftWrapOptions): string {
    // 往前 / 往后找最近的可见字符（跳过 § 码）
    const before = (s: string, i: number) => { while (i > 0) { if (i >= 2 && s[i - 2] === '§') { i -= 2; continue } return s[i - 1] } return '' }
    const after = (s: string, i: number) => { while (i < s.length) { if (s[i] === '§' && i + 1 < s.length) { i += 2; continue } return s[i] } return '' }
    // 交界处的空格（两边至少有一边是全宽字符）切出来，其余原样
    const parts: string[] = []          // 偶数位 = 原文片段，奇数位 = 交界处
    let last = 0
    for (const m of src.matchAll(/ +/g)) {
        const a = before(src, m.index!), b = after(src, m.index! + m[0].length)
        if (!((a && isWide(a)) || (b && isWide(b)))) continue
        parts.push(src.slice(last, m.index!), ' ')
        last = m.index! + m[0].length
    }
    parts.push(src.slice(last))
    // 每处交界的间隔：0 = 不留，1 = 不换行空格，2 = 普通空格（真正的断点：后面的英文单词放不下时整个换行）
    const GAP = ['', NBSP, ' ']
    const join = (choice: number[]) => parts.map((p, k) => (k % 2 ? GAP[choice[(k - 1) / 2]] : p)).join('')
    const n = (parts.length - 1) / 2
    const spacing = options.spacing ?? (options.width === undefined ? 'nbsp' : 'auto')
    if (spacing !== 'auto' || n === 0 || options.width === undefined) return join(new Array(n).fill(spacing === 'none' ? 0 : 1))
    const width = options.width, scale = options.scale ?? 1, profiles = options.profiles ?? ['pc', 'android']
    // 快速路径：留普通空格时在各平台都只有一行 → 不用搜
    const spaced = new Array(n).fill(2)
    if (profiles.every((p) => withMetricsProfile(p, () => measureText(join(spaced), scale, width).lines.length) <= 1)) return join(spaced)
    // 择优：按各平台的折行模拟打分（越小越好）；同一组合只算一次
    const plain = (s: string) => s.replace(/§./g, '').replace(/\u00A0/g, ' ')
    const memo = new Map<string, number>()
    const score = (choice: number[]) => {
        const key = choice.join('')
        const hit = memo.get(key)
        if (hit !== undefined) return hit
        const t = join(choice), whole = plain(t)
        // 排版效果一样时，偏好留间隔（「英文 Minecraft」比「英文Minecraft」好读）：不留 +2、不换行空格 +1、普通空格 0
        let sc = choice.reduce((a, v) => a + [2, 1, 0][v], 0)
        for (const p of profiles) {
            const lines = withMetricsProfile(p, () => measureText(t, scale, width).lines)
            sc += lines.length * 10
            lines.forEach((l, k) => {
                const v = l.replace(/§./g, '')
                if (k > 0 && NO_LINE_START.includes(v.replace(/^\u00A0+/, '')[0] ?? '')) sc += 100     // 标点落到行首
                if (k > 0 && v.startsWith(NBSP)) sc += 20                                                // 行首缩进
                if (k < lines.length - 1 && withMetricsProfile(p, () => textWidth(l, scale)) < width - 18 * scale) sc += 5   // 没排满
                // 英文单词被从中间断开：上一行以字母数字结尾、这一行以字母数字开头，且原文里这两段是连着的（中间没有空格）
                if (k > 0) {
                    const prev = plain(lines[k - 1]), cur = plain(l)
                    if (/[A-Za-z0-9_]$/.test(prev) && /^[A-Za-z0-9_]/.test(cur) && whole.includes(prev.slice(-4) + cur.slice(0, 4))) sc += 60
                }
            })
        }
        memo.set(key, sc)
        return sc
    }
    if ((options.effort ?? 'full') === 'fast') return join(repair(parts, n, join, score, width, scale, profiles))
    let best: number[] = new Array(n).fill(0), bestScore = score(best)
    for (let round = 0; round < 2 * n; round++) {
        let improved: number[] | undefined, improvedScore = bestScore
        for (let k = 0; k < n; k++) for (const v of [0, 1, 2]) {
            if (v === best[k]) continue
            const c = best.slice(); c[k] = v
            const sc = score(c)
            if (sc < improvedScore) { improved = c; improvedScore = sc }
        }
        if (!improved) break
        best = improved; bestScore = improvedScore
    }
    return join(best)
}

/**
 * 'fast' 择优：按规则给初值（交界另一边是英文单词 → 普通空格，是数字或别的 → 不留），模拟一次，找出两个平台上「行首是标点 / 不换行空格、
 * 英文单词被拆开」的行，只试这一行开头前面最近的两处交界，取能改善的；最多几轮。
 */
function repair(parts: string[], n: number, join: (c: number[]) => string, score: (c: number[]) => number, width: number, scale: number, profiles: MetricsProfile[]): number[] {
    const visible = (s: string) => s.replace(/§./g, '')
    let best: number[] = Array.from({ length: n }, (_, k) => (/^[A-Za-z]/.test(visible(parts[2 * k + 2])) || /[A-Za-z]$/.test(visible(parts[2 * k])) ? 2 : 0))
    let bestScore = score(best)
    // 交界 k 在拼好的文字里的位置
    const positions = (c: number[]) => { const out: number[] = []; let pos = 0; for (let k = 0; k < n; k++) { pos += parts[2 * k].length; out.push(pos); pos += [0, 1, 1][c[k]] } return out }
    // 有问题的行在拼好的文字里的起点
    const problems = (c: number[]) => {
        const t = join(c), out: number[] = []
        for (const p of profiles) {
            const lines = withMetricsProfile(p, () => measureText(t, scale, width).lines)
            let cursor = 0
            lines.forEach((l, k) => {
                const at = t.indexOf(l, cursor)
                if (at >= 0) cursor = at + l.length
                if (k === 0) return
                const v = visible(l), prev = visible(lines[k - 1])
                if (NO_LINE_START.includes(v.replace(/^\u00A0+/, '')[0] ?? '') || v.startsWith(NBSP) || (/[A-Za-z0-9_]$/.test(prev) && /^[A-Za-z0-9_]/.test(v))) out.push(at >= 0 ? at : cursor)
            })
        }
        return out.sort((a, b) => a - b)
    }
    for (let round = 0; round < 4; round++) {
        const probs = problems(best)
        if (!probs.length) break
        const pos = positions(best)
        let k = pos.length - 1
        while (k >= 0 && pos[k] > probs[0]) k--
        let improved: number[] | undefined, improvedScore = bestScore
        for (const kk of [k, k - 1]) {
            if (kk < 0) continue
            for (const v of [0, 1, 2]) {
                if (v === best[kk]) continue
                const c = best.slice(); c[kk] = v
                const sc = score(c)
                if (sc < improvedScore) { improved = c; improvedScore = sc }
            }
        }
        if (!improved) break
        best = improved; bestScore = improvedScore
    }
    void width
    return best
}

export interface WrapOptions {
    /** font_scale_factor */
    scale?: number
    /** 避头尾（缺省 true） */
    kinsoku?: boolean
    /** 中英文自动留空（缺省 true） */
    autoSpace?: boolean
    /**
     * 行尾标点允许超出宽度的像素（缺省 0：每一行都不超宽，游戏不会再折一次）。行首不能放的标点（，。等）放不下时，
     * 把上一个字一起推到下一行（「推出」式避头尾）——每行都用满宽度（先前每行预留 8 像素给标点，平白少放将近一个字）
     */
    hang?: number
    /** 字体（缺省按整段内容决定：含非 ASCII ⇒ Unifont） */
    unifont?: boolean
}

/**
 * 确定性预折行：返回每一行（行首已补上延续的样式码）。段落以 \n 分隔，空行保留。
 */
export function wrapText(text: string, width: number, options: WrapOptions = {}): string[] {
    return wrapDetailed(text, width, options).lines
}

/** 预折行，并标出哪些行是段落的第一行（分页做孤行控制用） */
export function wrapDetailed(text: string, width: number, options: WrapOptions = {}): { lines: string[], starts: Set<number> } {
    const starts = new Set<number>()
    const scale = options.scale ?? 1
    const overhang = (options.hang ?? 0) * scale
    const kinsoku = options.kinsoku ?? true
    const src = (options.autoSpace ?? true) ? autoSpace(text) : text
    // 字体由整段内容决定（含汉字 ⇒ 整段 Unifont，英文也按 Unifont 的字距）
    const uni = options.unifont ?? usesUnifont(src)
    const out: string[] = []
    let style = PLAIN
    /** 词元：前面的格式码 + 文字；before = 格式码生效前的样式（行首补样式码用） */
    type Tok = { codes: string, text: string, w: number, space: boolean, before: RunStyle }
    const single = (t: Tok) => [...t.text].length === 1
    for (const para of src.split('\n')) {
        starts.add(out.length)
        // 切成词元：单词（连续的非汉字、非全角标点、非空白字符——「×3」「diamond_sword」「1.22.0」「(line_padding),」都不拆开）、
        // 空白、单个汉字 / 全角标点；格式码粘在后面的词元上。先前单词只含字母数字，「×3」被拆成「×」/「3」两行
        const toks: Tok[] = []
        let codes = '', before = style
        for (const m of para.match(WORD_TOKENS) ?? []) {
            if (m.length === 2 && m[0] === '§') { if (!codes) before = style; codes += m; style = applyCode(style, m[1]); continue }
            if (!codes) before = style
            toks.push({ codes, text: m, w: richWidth(m, scale, style, uni), space: /^\s+$/.test(m), before })
            codes = ''
        }
        const tail = codes                      // 段末剩下的格式码
        const lines: Tok[][] = []
        let line: Tok[] = [], w = 0
        const sum = (ts: Tok[]) => ts.reduce((a, t) => a + t.w, 0)
        const flush = () => {
            while (line.length && line[line.length - 1].space) line.pop()      // 行尾空白去掉（它的格式码由下一行行首的样式码补上）
            lines.push(line); line = []; w = 0
        }
        const push = (t: Tok) => {
            if (!line.length && t.space) {                                         // 行首空白丢掉，格式码留给下一个词元
                const next = toks[toks.indexOf(t) + 1]
                // 格式码连同「生效前的样式」一起转交（否则行首补的样式码与转来的格式码重复：「§9 你好」→「§9§9你好」）
                if (next && t.codes) { next.codes = t.codes + next.codes; next.before = t.before }
                return
            }
            line.push(t); w += t.w
        }
        for (const t of toks) {
            if (!line.length || t.space || w + t.w <= width) {
                if (line.length || t.w <= width || t.space) { push(t); continue }
            }
            // 放不下
            if (line.length && kinsoku && single(t) && NO_LINE_START.includes(t.text)) {
                if (w + t.w <= width + overhang) { push(t); flush(); continue }    // 允许的悬挂
                // 推出：把本行最后一个词元带到下一行，标点跟在它后面（本行只剩它一个时只好挂着）
                let k = line.length - 1
                while (k > 0 && line[k].space) k--
                if (k > 0) {
                    const moved = line.slice(k).filter((x) => !x.space)
                    line = line.slice(0, k); flush()
                    for (const x of moved) push(x)
                    push(t)
                } else { push(t); flush() }
                continue
            }
            // 避尾：本行末尾的开括号等带到下一行
            let carry: Tok[] = []
            if (line.length && kinsoku) {
                while (line.length > 1 && single(line[line.length - 1]) && NO_LINE_END.includes(line[line.length - 1].text)) carry = [line.pop()!, ...carry]
            }
            if (line.length) flush()
            for (const x of carry) push(x)
            if (t.w > width - w && t.w > width) {
                // 超长的词（一整行都放不下）：逐字断开
                let first = true
                for (const ch of t.text) {
                    const piece: Tok = { codes: first ? t.codes : '', text: ch, w: richWidth(ch, scale, applyCodes(t.before, t.codes), uni), space: false, before: t.before }
                    first = false
                    if (line.length && w + piece.w > width) flush()
                    push(piece)
                }
                continue
            }
            push(t)
        }
        if (line.length || !lines.length) flush()
        // 拼成文字：行首补上这一行开头时的样式码
        lines.forEach((ln, n) => {
            const head = ln.length ? styleCodes(ln[0].before) : styleCodes(style)
            let s = head + ln.map((t) => t.codes + t.text).join('')
            if (n === lines.length - 1) s += tail
            out.push(s)
        })
    }
    return { lines: out, starts }
}

/** 词元：§ 码 | 单词（非汉字、非全角标点、非空白的连续字符）| 空白 | 单个字符 */
const WORD_TOKENS = /§.|[^\s§\u2E80-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]+|\s+|./gsu

/** 依次套用一串格式码 */
function applyCodes(st: RunStyle, codes: string): RunStyle {
    for (let i = 0; i + 1 < codes.length; i += 2) st = applyCode(st, codes[i + 1])
    return st
}

export interface PaginateOptions extends WrapOptions {
    /** 每页可用高度（像素） */
    height: number
    /** 第一页可用高度（例如第一页有标题） */
    firstHeight?: number
    /**
     * 按哪个平台的字宽排行（缺省 'android'——最宽：按它排好的每一行在 PC 上也放得下，两个平台都不会被游戏再折一次、一页装不下。
     * 真机 1.28.0：按 PC 排的分页在安卓上每行超宽，底部越界 31–71 像素）
     */
    profile?: MetricsProfile
}

/**
 * 长文本分页：预折行后按每页行数切块；每块第一行开头已补样式码。
 * 孤行控制：一页的最后一行若是段落的第一行（例如标题、或段落只有首行留在页底），挪到下一页。
 */
export function paginate(text: string, width: number, options: PaginateOptions): string[] {
    const { lines, starts } = withMetricsProfile(options.profile ?? 'android', () => wrapDetailed(text, width, options))
    const lh = LINE_HEIGHT * (options.scale ?? 1)
    const first = Math.max(1, Math.floor((options.firstHeight ?? options.height) / lh))
    const rest = Math.max(1, Math.floor(options.height / lh))
    const pages: string[] = []
    let i = 0
    let cap = first
    while (i < lines.length) {
        // 页首不留空行
        while (i < lines.length && pages.length && lines[i].replace(/§./g, '') === '') i++
        if (i >= lines.length) break
        let end = Math.min(lines.length, i + cap)
        // 孤行控制：页末是段落首行（且后面还有内容）→ 挪到下一页；连续的标题 / 空行一起挪
        while (end < lines.length && end - i > 2 && starts.has(end - 1) && lines[end - 1].replace(/§./g, '') !== '') end--
        while (end - i > 1 && lines[end - 1].replace(/§./g, '') === '') end--
        pages.push(lines.slice(i, end).join('\n'))
        i = end
        cap = rest
    }
    return pages.length ? pages : ['']
}
