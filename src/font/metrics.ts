/**
 * 字体度量（基岩版，真机字宽标尺校准，2026-11）：
 *   **整段文字的字体由内容决定**：只要含非 ASCII 字符（例如汉字），整段（连同其中的英文、数字、空格）都用 Unifont 画；
 *   纯 ASCII 的文字才用 Minecraft 默认字体（真机：「Esc 关闭」里 E s c 的字距是 4；纯英文行里是 6）。
 *   Minecraft 默认字体：! ' , . : ; i | 2，l ` 3，I t [ ] 空格 4，f k < > ( ) { } " * 5，~ 7，其余 6（含 @）
 *   Unifont：字距 = 点阵墨迹宽 / 2 + 1（半像素精度）——绝大多数汉字 8.5，「中」6.5，中文逗号 2、句号 3，空格 4（表见 unifontWidths.ts）
 *   粗体：Minecraft 字体每字 +1，Unifont 每字 +0.5（实测「中」粗体 7.0）
 * 行高 10（字形 8 + 行距 2）。`§x` 格式码不占宽度。
 */
import { gameGlyphInk } from './gameGlyphs.js'
import { UNIFONT_HALF } from './unifontWidths.js'

export const LINE_HEIGHT = 10
/** 字形（8 高）在一行（10 高）里的上缘：居中，比文字控件的顶端低 1（真机 1.24.0：同一行里放在行顶的图标比汉字高 1 像素） */
export const GLYPH_TOP = 1
export const GLYPH_HEIGHT = 8

const ASCII: Record<string, number> = {}
for (const ch of "!',.:;i|") ASCII[ch] = 2
for (const ch of 'l`') ASCII[ch] = 3
for (const ch of 'It[] ') ASCII[ch] = 4
// 真机（字宽标尺 1.2.0）：( ) { } " * 的字距是 5（Java 版是 4）
for (const ch of 'fk<>(){}"*') ASCII[ch] = 5
for (const ch of '~') ASCII[ch] = 7

/** 是否 ASCII 可见字符 */
export const isAscii = (ch: string) => { const c = ch.codePointAt(0)!; return c >= 0x20 && c <= 0x7e }

/** 一段文字会不会用 Unifont 画（含任何非 ASCII 可见字符；§ 码与换行不算） */
export const usesUnifont = (text: string) => /[^\x20-\x7e\n]/.test(text.replace(/§./g, ''))

/** 字形图标（资源包 font/glyph_XX.png）的字距：GlyphSheet.icon() 登记 */
const GLYPH_WIDTH = new Map<string, number>()
export function registerGlyphWidth(ch: string, width: number): void { GLYPH_WIDTH.set(ch, width) }
export function unregisterGlyph(ch: string): void { GLYPH_WIDTH.delete(ch) }

/** Unifont 字距（界面像素）；登记过的字形图标按登记的字距 */
export function unifontWidth(ch: string): number {
    const g = GLYPH_WIDTH.get(ch)
    if (g !== undefined) return g
    const cp = ch.codePointAt(0)!
    // 游戏与 Unifont 不同的字形（真机采样还原，见 gameGlyphs.ts）：字距 = 墨迹宽 / 2 + 1
    const ink = gameGlyphInk(cp)
    if (ink !== undefined) return ink / 2 + 1
    if (cp >= 0x20 && cp < 0x10000) {
        const half = parseInt(UNIFONT_HALF[cp - 0x20], 36)
        if (half) return half / 2
    }
    return 8.5
}

/**
 * 字距（界面像素，可为 .5）。`unifont` = 这段文字是否用 Unifont 画（缺省按这个字本身判断——
 * 量整段文字请用 textWidth，它会按整段的内容决定字体）。
 */
export function charWidth(ch: string, unifont = !isAscii(ch)): number {
    if (!unifont) return ASCII[ch] ?? 6
    return unifontWidth(ch)
}

/** 粗体多出的宽度：Minecraft 字体 1，Unifont 0.5 */
export const boldExtra = (ch: string, unifont = !isAscii(ch)) => (unifont ? 0.5 : 1)

/** 去掉 § 格式码 */
export const stripFormat = (s: string) => s.replace(/§./g, '')

/** @deprecated 用 boldExtra(ch)（ASCII 1、Unifont 字形 0.5） */
export const BOLD_EXTRA = 1

/**
 * 宽度（像素）：§ 码不占宽度；粗体（§l 起、§r 止——基岩版换颜色不清粗体）加 boldExtra。
 * `bold` = 进入这段文字时是否已是粗体；`unifont` = 字体（缺省按这段文字的内容决定）。
 */
export function textWidth(s: string, scale = 1, bold = false, unifont = usesUnifont(s)): number {
    let w = 0
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '§' && i + 1 < s.length) {
            const c = s[i + 1].toLowerCase()
            if (c === 'l') bold = true
            else if (c === 'r') bold = false
            i++
            continue
        }
        const cp = s.codePointAt(i)!
        const ch = String.fromCodePoint(cp)
        if (cp > 0xffff) i++
        w += charWidth(ch, unifont) + (bold ? boldExtra(ch, unifont) : 0)
    }
    return w * scale
}

export interface TextMetrics {
    lines: string[]
    width: number
    height: number
}

/**
 * 测量 / 折行：按 \n 分段；给了 maxWidth 时贪心折行（英文单词不拆，中文任意处可断）。
 * 这是对引擎的近似，用于预览与布局估算。
 */
/**
 * 一段文字 → 单词（游戏只在空格处换行，真机 1.20.1 / 1.23.0）：「页首有一张 1 层紫色小图抢先出现（1.22.0 的 G 没有它，被盖住）。」
 * 折成「页首有一张 1」/「层紫色小图抢先出现（1.22.0 的」/「G 没有它，被盖住）。」——第一行明明还放得下，「层紫色…1.22.0」整串没有空格，
 * 当成一个单词整个移到下一行。只有一个单词一整行都放不下时才在字与字之间断开（纯中文段落因此能在任意位置折行）。
 * （先前按 Unicode 断行规则在汉字之间也断——与游戏不符。）
 */
function splitWords(para: string): string[] {
    return para.match(/ +|[^ ]+/g) ?? []
}

export function measureText(text: string, scale = 1, maxWidth = Infinity): TextMetrics {
    const uni = usesUnifont(text)
    const tw = (s: string) => textWidth(s, scale, false, uni)
    const lines: string[] = []
    for (const para of text.split('\n')) {
        if (maxWidth === Infinity) { lines.push(para); continue }
        let line = ''
        for (const word of splitWords(para)) {
            if (/^ +$/.test(word)) { if (line) line += word; continue }
            if (tw(line + word) <= maxWidth) { line += word; continue }
            // 单词一整行放得下：整个移到下一行（行尾的空格丢掉）
            if (tw(word) <= maxWidth) { if (line.trim()) lines.push(line.trimEnd()); line = word; continue }
            // 一整行都放不下：从当前行剩下的地方开始逐字往下排（真机 1.23.0：「…出现时，0 层的文字已」/「经出现过了…」）
            for (const ch of word.match(/§.|./gsu) ?? []) {
                if (line.trim() && tw(line + ch) > maxWidth) { lines.push(line.trimEnd()); line = '' }
                line += ch
            }
        }
        lines.push(line.trimEnd())
    }
    const width = Math.max(0, ...lines.map((l) => tw(l)))
    return { lines, width, height: lines.length * LINE_HEIGHT * scale }
}
