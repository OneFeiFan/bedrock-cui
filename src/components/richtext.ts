/**
 * Text：行内排版——文字里可以夹行内图标（InlineIcon），折行、行高、样式延续都由 CUI 负责，编译成原生控件：
 *   · 没有图标的行：合成一个普通文字控件（与 Paragraph 一样，没有额外开销）
 *   · 有图标的行：一行一个横向 stack_panel，文字段用文字控件、图标用图片控件（16×16 贴图画进 8×8 或 16×16）
 *   · 行高自动：有 16 高的图标的行加高到 16，字形与 8 高的图标在行里垂直居中（字形在文字控件里比顶端低 1，真机 1.24.0）
 *   · 样式延续：每一段开头补上当时的样式码（颜色、粗体……）
 *
 *   new Text(`合成需要 ${DIAMOND}×2，再加 ${STICK}`, 110, BODY)
 *
 * 量宽度的细节（与游戏一致）：游戏按**每个文字控件自己的内容**决定字体（含非 ASCII ⇒ Unifont），所以拆开后的每一段分别量；
 * 图标宽 = 边长 + 1。折行：英文按单词、汉字按字；避头尾（行首不放「，。」等，行尾不留「（「」等）。
 */
import { Element, Image, Label, Panel, Stack, _snapshot } from '../core/element.js'
import { InlineIcon } from '../core/inline.js'
import type { RNode } from '../core/node.js'
import type { TextStyle } from '../core/values.js'
import { GLYPH_TOP, LINE_HEIGHT, textWidth, withMetricsProfile } from '../font/metrics.js'
import { NO_LINE_END, NO_LINE_START, parseRich, PLAIN, styleCodes, type RunStyle } from '../font/rich.js'

/** 排版单位：一段文字（单词 / 一个字 / 一个空格，前面可能带格式码）或一个图标 */
type Unit = { text: string } | { icon: InlineIcon }

/** 一行里的一段：文字（开头已补样式码）或图标 */
export type TextPiece = { text: string } | { icon: InlineIcon }

/** 把一段（不含换行）切成排版单位；格式码附着在后一个单位上 */
function tokenize(paragraph: string): Unit[] {
    const units: Unit[] = []
    let codes = ''
    const chars = [...paragraph]
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]
        if (ch === '§' && i + 1 < chars.length) { codes += ch + chars[++i]; continue }
        const icon = InlineIcon.lookup(ch)
        if (icon) { if (codes) { units.push({ text: codes }); codes = '' } units.push({ icon }); continue }
        // 单词：连续的非汉字、非全角标点、非空白字符（「×3」「diamond_sword」「1.22.0」不拆开）；行内图标与 § 码另算
        const isWordChar = (c: string) => !/[\s§\u2E80-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/u.test(c) && !InlineIcon.lookup(c)
        if (isWordChar(ch)) {
            let word = ch
            while (i + 1 < chars.length && isWordChar(chars[i + 1])) word += chars[++i]
            units.push({ text: codes + word }); codes = ''
            continue
        }
        units.push({ text: codes + ch }); codes = ''
    }
    if (codes) units.push({ text: codes })
    return units
}

const isText = (u: Unit | TextPiece): u is { text: string } => 'text' in u
const visible = (s: string) => s.replace(/§./g, '')

/** 一行（排版单位）→ 一段一段（文字段合并、开头补样式码）；返回结束时的样式 */
function piecesOf(units: Unit[], start: RunStyle): { pieces: TextPiece[], end: RunStyle } {
    const pieces: TextPiece[] = []
    let style = start, buf = '', bufStart = start
    const flush = () => { if (visible(buf)) pieces.push({ text: styleCodes(bufStart) + buf }); buf = '' }
    for (const u of units) {
        if (isText(u)) {
            if (!buf) bufStart = style
            buf += u.text
            style = parseRich(u.text, style).end
        } else { flush(); pieces.push({ icon: u.icon }) }
    }
    flush()
    return { pieces, end: style }
}

/** 一行的宽度：每个文字段按它自己的内容决定字体分别量（与游戏一致），图标 = 边长 + 间距 */
export function lineWidth(pieces: TextPiece[], scale = 1): number {
    return pieces.reduce((w, p) => w + (isText(p) ? textWidth(p.text, scale) : p.icon.advance), 0)
}

/**
 * 行内排版：折行（贪心 + 避头尾），返回每一行的段。width 不给 = 不折行（只按 \n 分行）。
 */
export function layoutInline(content: string, width = Infinity, scale = 1): TextPiece[][] {
    const lines: TextPiece[][] = []
    let style: RunStyle = PLAIN
    for (const paragraph of content.split('\n')) {
        const units = tokenize(paragraph)
        let line: Unit[] = []
        const close = (keep: Unit[]) => {
            while (line.length && isText(line[line.length - 1]) && /^(§.)*\s+$/.test((line[line.length - 1] as { text: string }).text)) line.pop()
            const { pieces, end } = piecesOf(line, style)
            lines.push(pieces)
            style = end
            // 新行开头的空格丢掉（只留它前面的格式码）
            while (keep.length && isText(keep[0]) && /^(§.)*\s+$/.test(keep[0].text)) {
                const codes = keep[0].text.replace(/\s+$/, '')
                keep = keep.slice(1)
                if (codes) keep.unshift({ text: codes })
                if (codes) break
            }
            line = keep
        }
        for (const u of units) {
            if (!line.length) { if (isText(u) && /^\s+$/.test(visible(u.text)) && lines.length) continue; line.push(u); continue }
            const trial = piecesOf([...line, u], style).pieces
            if (lineWidth(trial, scale) <= width) { line.push(u); continue }
            // 避头：行首不能放的标点挂在本行末尾
            if (isText(u) && NO_LINE_START.includes(visible(u.text))) { line.push(u); continue }
            // 避尾：本行末尾不能留的标点带到下一行
            const last = line[line.length - 1]
            if (line.length > 1 && isText(last) && NO_LINE_END.includes(visible(last.text))) { line.pop(); close([last, u]); continue }
            close([u])
        }
        close([])
    }
    return lines
}

export interface TextOptions {
    /** 行间额外的间距（像素，缺省 0） */
    lineGap?: number
}

/**
 * 富文本（行内排版）。content 里可以有 § 格式码与行内图标；width = 折行宽度（不给 = 只按 \n 分行）。
 * 只用于构建时就确定的文字；运行期文字（表达式）用 Label + emoji 字形 + setLineSpacing()。
 */
export class Text extends Element {
    readonly type = 'panel' as const
    readonly content: string
    readonly width?: number
    readonly style?: TextStyle
    lineGap = 0
    /** 排好的行（每行一串段） */
    readonly lines: TextPiece[][]

    constructor(content: string, width?: number, style?: TextStyle) {
        super({})
        if (style?.scale !== undefined && style.scale !== 1) throw new Error('Text 暂只支持字号 1（行内图标按 1 倍排）')
        this.content = content
        this.width = width
        this.style = style
        // 换行按最宽的平台（安卓：汉字与全角标点 9）算：每行在 PC 上也放得下。各段的位置交给游戏（横向堆叠、文字段宽度 100%c），
        // 所以按实际字宽排列。真机 1.28.0：按 PC 字宽算的行在安卓上越过书页中缝
        this.lines = withMetricsProfile('android', () => layoutInline(content, width))
        this.props.size = [width ?? '100%cm', '100%c']
    }

    /** 行间额外的间距 */
    setLineGap(n: number): this { this.lineGap = n; return this }

    private label(text: string): Label {
        const l = new Label(text)
        if (this.style) l.setStyle(this.style)
        return l
    }

    /** @internal 展开成原生控件：连续的纯文字行合成一个文字控件；有图标的行一行一个横向 stack_panel */
    _expand(path: string): RNode[] {
        const column = new Stack('vertical').setName('lines')
        column.props.size = ['100%cm', '100%c']
        column.props.anchor = 'top_left'
        let plain: string[] = []
        const flushPlain = () => {
            if (!plain.length) return
            const l = this.label(plain.join('\n'))
            l.props.anchor = 'top_left'
            column.add(l)
            if (this.lineGap) column.add(new Panel().setSize(1, this.lineGap))
            plain = []
        }
        for (const line of this.lines) {
            if (!line.some((p) => !isText(p))) { plain.push(line.map((p) => (p as { text: string }).text).join('')); continue }
            flushPlain()
            // 字形在文字控件里比顶端低 GLYPH_TOP（真机 1.24.0）：8 高的小图标放在 textY + GLYPH_TOP，与字形齐；
            // 有 16 高图标的行，文字控件放在 3——字形在 4–12，中心与大图标（0–16）重合
            const tall = line.some((p) => !isText(p) && p.icon.size === 16)
            const rowH = tall ? 16 : LINE_HEIGHT
            const textY = tall ? 8 - 4 - GLYPH_TOP : 0
            const row = new Stack('horizontal')
            row.props.size = ['100%c', rowH]
            row.props.anchor = 'top_left'
            for (const p of line) {
                if (isText(p)) {
                    const cell = new Panel()
                    cell.props.size = ['100%c', rowH]
                    const l = this.label(p.text)
                    l.props.anchor = 'top_left'; l.props.offset = [0, textY]
                    cell.add(l)
                    row.add(cell)
                } else {
                    const cell = new Panel()
                    cell.props.size = [p.icon.advance, rowH]
                    const img = new Image(p.icon.texture).setSize(p.icon.size, p.icon.size)
                    img.props.anchor = 'top_left'; img.props.offset = [0, p.icon.size === 16 ? 0 : textY + GLYPH_TOP]
                    cell.add(img)
                    row.add(cell)
                }
            }
            column.add(row)
            if (this.lineGap) column.add(new Panel().setSize(1, this.lineGap))
        }
        flushPlain()
        return _snapshot([column], path)
    }
}
