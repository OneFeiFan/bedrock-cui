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
export function registerGlyphWidth(ch: string, width: number): void { GLYPH_WIDTH.set(ch, width); WIDTH_CACHE.clear() }
export function unregisterGlyph(ch: string): void { GLYPH_WIDTH.delete(ch); WIDTH_CACHE.clear() }
/**
 * 字宽缓存（档案 + 字体 + 字符 → 字距）：查一个字要经过字形图标表、全宽判断、游戏字形表、Unifont 字宽表（三十六进制解析），
 * 软换行择优要把同样的字量上百遍——脚本端在 QuickJS 上跑，不缓存时一次翻页要好几秒（真机 1.29.0）
 */
const WIDTH_CACHE = new Map<string, number>()

/**
 * 字宽档案：游戏在不同平台上用不同的字体。真机：PC 的汉字是 Unifont 点阵（字距 = 墨迹宽 / 2 + 1，汉字 8.5、全角逗号 2）；
 * 安卓（小米 14，1.28.0）是平滑字体，**汉字与全角标点都是 9**，英文与 PC 相近。排版、静态检查、预览都按当前档案量字宽。
 */
export type MetricsProfile = 'pc' | 'android'
let profile: MetricsProfile = 'pc'
export function setMetricsProfile(p: MetricsProfile): void { profile = p }
export function getMetricsProfile(): MetricsProfile { return profile }
/** 按某个档案执行一段计算（结束后恢复） */
export function withMetricsProfile<T>(p: MetricsProfile, fn: () => T): T {
    const old = profile
    profile = p
    try { return fn() } finally { profile = old }
}
/** 全宽字符：汉字、假名、谚文、全角标点与符号（安卓按 9） */
const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/u
export const isWide = (ch: string) => WIDE.test(ch)

/** Unifont 字距（界面像素）；登记过的字形图标按登记的字距；安卓档案下全宽字符按 9 */
export function unifontWidth(ch: string): number {
    const g = GLYPH_WIDTH.get(ch)
    if (g !== undefined) return g
    if (profile === 'android' && WIDE.test(ch)) return 9
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
    const key = profile === 'android' ? 'a' + ch : ch
    let w = WIDTH_CACHE.get(key)
    if (w === undefined) { w = unifontWidth(ch); WIDTH_CACHE.set(key, w) }
    return w
}

/** 粗体多出的宽度：Minecraft 字体 1，Unifont 0.5；安卓 1（真机 1.28.0：「…位置。粗体」后面的粗体「也」按 0.5 算放得下，真机换行了） */
export const boldExtra = (ch: string, unifont = !isAscii(ch)) => (profile === 'android' ? 1 : unifont ? 0.5 : 1)

/** 去掉 § 格式码 */
export const stripFormat = (s: string) => s.replace(/§./g, '')

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

/**
 * 不换行空格（U+00A0）在游戏判断「这一行放不放得下」时按 9 算，画出来却和普通空格一样宽（4）——真机 1.28.0：PC 上 A、C 两段同一行里
 * 「共」与「11」的间隙逐像素相同（都画 4），可 C 段三处换行时都还放得下下一个字（96.5 + 8.5 = 105 ≤ 110 也换行了）；按 9 算，三处全对上。
 * （多半是游戏的字形数据给 U+00A0 画了一个 16 宽的方框字形——零宽空格、发丝空格真机都显示成这种方框——量宽度用了它，画的时候当空格。）
 */
export const NBSP_BREAK_WIDTH = 9

export function measureText(text: string, scale = 1, maxWidth = Infinity): TextMetrics {
    const uni = usesUnifont(text)
    const tw = (s: string) => textWidth(s, scale, false, uni)
    // 判断放不放得下时，不换行空格按 NBSP_BREAK_WIDTH 算
    const nbspExtra = (NBSP_BREAK_WIDTH - textWidth('\u00A0', 1, false, true)) * scale
    /**
     * 一段文字接在粗体状态 bold 后面的宽度（判断用：含不换行空格的加宽）与结束时的粗体状态。逐字累加——先前每加一个字就把整行重算一遍，
     * 一行的计算量随长度平方增长；脚本端软换行要模拟很多次，在 QuickJS 上一次翻页要好几秒（真机 1.29.0）
     */
    const seg = (s: string, bold: boolean): [number, boolean] => {
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
            w += (charWidth(ch, uni) + (bold ? boldExtra(ch, uni) : 0)) * scale
            if (cp === 0xa0) w += nbspExtra
        }
        return [w, bold]
    }
    const lines: string[] = []
    for (const para of text.split('\n')) {
        if (maxWidth === Infinity) { lines.push(para); continue }
        // 当前行：文字、判断宽度、行末的粗体状态（每行从非粗体量起）、有没有实质内容（与 line.trim() 一致：不换行空格也算空白）
        let line = '', w = 0, bold = false, solid = false
        const reset = () => { line = ''; w = 0; bold = false; solid = false }
        const add = (s: string) => { const [dw, b] = seg(s, bold); line += s; w += dw; bold = b; if (/\S/.test(s)) solid = true }
        for (const word of splitWords(para)) {
            if (/^ +$/.test(word)) { if (line) add(word); continue }
            if (w + seg(word, bold)[0] <= maxWidth) { add(word); continue }
            // 单词一整行放得下：整个移到下一行（行尾的空格丢掉）
            if (seg(word, false)[0] <= maxWidth) { if (solid) lines.push(line.trimEnd()); reset(); add(word); continue }
            // 一整行都放不下：从当前行剩下的地方开始逐字往下排（真机 1.23.0：「…出现时，0 层的文字已」/「经出现过了…」）
            for (const ch of word.match(/§.|./gsu) ?? []) {
                if (solid && w + seg(ch, bold)[0] > maxWidth) { lines.push(line.trimEnd()); reset() }
                add(ch)
            }
        }
        lines.push(line.trimEnd())
    }
    const width = Math.max(0, ...lines.map((l) => tw(l)))
    return { lines, width, height: lines.length * LINE_HEIGHT * scale }
}
