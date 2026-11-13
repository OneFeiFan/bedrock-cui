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
import { LINE_HEIGHT, boldExtra, charWidth, usesUnifont } from './metrics.js'

/** 基岩版颜色（前 16 个与 Java 相同；§g 起为基岩版独有；§v 树脂色为资料值，未在真机核对） */
export const BEDROCK_COLORS: Record<string, string> = {
    '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA', '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
    '8': '#555555', '9': '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF',
    g: '#DDD605', h: '#E3D4D1', i: '#CECACA', j: '#443A3B', m: '#971607', n: '#B4684D', p: '#DEB12D', q: '#47A036',
    s: '#2CBAA8', t: '#21497B', u: '#9A5CC6', v: '#EB7114',
}

export interface TextStyle {
    /** 颜色码（'c'、'g'…）；undefined = 控件本身的颜色 */
    color?: string
    bold: boolean
    italic: boolean
    obfuscated: boolean
}
export const PLAIN: TextStyle = { color: undefined, bold: false, italic: false, obfuscated: false }

export interface Run { text: string, style: TextStyle }

/** 应用一个格式码（基岩版语义：颜色不清掉粗体 / 斜体，§r 全部重置）；不认识的码原样忽略 */
export function applyCode(style: TextStyle, code: string): TextStyle {
    const c = code.toLowerCase()
    if (c === 'r') return { ...PLAIN }
    if (c === 'l') return { ...style, bold: true }
    if (c === 'o') return { ...style, italic: true }
    if (c === 'k') return { ...style, obfuscated: true }
    if (BEDROCK_COLORS[c]) return { ...style, color: c }
    return style
}

/** 拆成样式段 */
export function parseRich(text: string, start: TextStyle = PLAIN): { runs: Run[], end: TextStyle } {
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
export function styleCodes(style: TextStyle): string {
    return (style.color ? `§${style.color}` : '') + (style.bold ? '§l' : '') + (style.italic ? '§o' : '') + (style.obfuscated ? '§k' : '')
}

/** 富文本宽度（像素）：§ 码不占宽度，粗体加 boldExtra；`unifont` 缺省按这段文字的内容决定 */
export function richWidth(text: string, scale = 1, start: TextStyle = PLAIN, unifont = usesUnifont(text)): number {
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
 * 中英文之间留一个空格（已有空格的不重复加；§ 码不影响判断）：
 *   汉字 / 中文标点 → 英文：留空（「；Esc」→「； Esc」）
 *   英文 → 汉字：留空；英文 → 中文标点：不留（「Minecraft、」）
 */
export function autoSpace(text: string): string {
    return text
        .replace(new RegExp(`(${CJK})((?:§.)*)([A-Za-z0-9@#&(\\[])`, 'g'), '$1 $2$3')
        // (?<!§)：格式码的那个字母 / 数字（§9 的 9）不算英文
        .replace(new RegExp(`(?<!§)([A-Za-z0-9%)\\]!?.:;])((?:§.)*)(${HAN})`, 'g'), '$1$2 $3')
}

export interface WrapOptions {
    /** font_scale_factor */
    scale?: number
    /** 避头尾（缺省 true） */
    kinsoku?: boolean
    /** 中英文自动留空（缺省 true） */
    autoSpace?: boolean
    /** 给挂在行尾的标点留的像素（缺省 8：保证引擎不会再折一次） */
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
    const target = width - (options.hang ?? 8) * scale
    const kinsoku = options.kinsoku ?? true
    const src = (options.autoSpace ?? true) ? autoSpace(text) : text
    // 字体由整段内容决定（含汉字 ⇒ 整段 Unifont，英文也按 Unifont 的字距）
    const uni = options.unifont ?? usesUnifont(src)
    const rw = (s: string, st: TextStyle) => richWidth(s, scale, st, uni)
    const out: string[] = []
    let style = PLAIN
    for (const para of src.split('\n')) {
        const startCount = out.length
        starts.add(startCount)
        // 词元：§ 码（零宽，粘在后面的词元上）、英文单词、空白、单个字符
        const tokens = para.match(/§.|[A-Za-z0-9_\-'.]+|\s+|./gu) ?? []
        let line = styleCodes(style)
        let lineStyle = style
        let w = 0
        let empty = true
        const flush = () => { out.push(line.replace(/\s+$/, '')); line = styleCodes(style); lineStyle = style; w = 0; empty = true }
        void lineStyle
        let pendingCodes = ''
        for (const tok of tokens) {
            if (tok.startsWith('§') && tok.length === 2) { pendingCodes += tok; style = applyCode(style, tok[1]); continue }
            const tokStyle = style
            const tw = rw(tok, tokStyle)
            if (!empty && w + tw > target && !/^\s+$/.test(tok)) {
                if (kinsoku && [...tok].length === 1 && NO_LINE_START.includes(tok)) {
                    line += pendingCodes + tok; pendingCodes = ''; flush(); continue
                }
                let carry = ''
                if (kinsoku) {
                    while (line.length && NO_LINE_END.includes(line[line.length - 1]) && !/§.$/.test(line.slice(-2))) { carry = line[line.length - 1] + carry; line = line.slice(0, -1) }
                }
                flush()
                const lead = carry + pendingCodes + tok.replace(/^\s+/, '')
                line += lead
                w = rw(carry, tokStyle) + tw
                pendingCodes = ''
                empty = false
                continue
            }
            // 行首空白丢掉，但前面待输出的格式码要留着
            if (empty && /^\s+$/.test(tok)) continue
            if (tw > target) {
                // 超长的词：逐字断开
                line += pendingCodes; pendingCodes = ''
                for (const ch of tok) {
                    const cw = rw(ch, tokStyle)
                    if (!empty && w + cw > target) flush()
                    line += ch; w += cw; empty = false
                }
                continue
            }
            line += pendingCodes + tok; pendingCodes = ''
            w += tw
            empty = false
        }
        line += pendingCodes
        // 段落末尾只剩样式码（例如最后一个字是挂到上一行末尾的句号）：不另起空行
        if (!(empty && out.length > startCount)) out.push(line.replace(/\s+$/, ''))
    }
    return { lines: out, starts }
}

export interface PaginateOptions extends WrapOptions {
    /** 每页可用高度（像素） */
    height: number
    /** 第一页可用高度（例如第一页有标题） */
    firstHeight?: number
}

/**
 * 长文本分页：预折行后按每页行数切块；每块第一行开头已补样式码。
 * 孤行控制：一页的最后一行若是段落的第一行（例如标题、或段落只有首行留在页底），挪到下一页。
 */
export function paginate(text: string, width: number, options: PaginateOptions): string[] {
    const { lines, starts } = wrapDetailed(text, width, options)
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
