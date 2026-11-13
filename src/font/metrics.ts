/**
 * 字体度量（基岩版默认像素字体）：与 sapdon GuideBook 同一套，按真机截图校准——
 * 中文 8 像素；基岩版把中文的，：；、！？画成窄字形（3）；ASCII 按 Minecraft 默认字体字宽表。
 * 行高 10（字形 8 + 行距 2）。`§x` 格式码不占宽度。
 */
export const LINE_HEIGHT = 10
export const GLYPH_HEIGHT = 8

export function charWidth(ch: string): number {
    if ('，：；、！？'.includes(ch)) return 3
    if (/[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/.test(ch)) return 8
    if ("!',.:;i|".includes(ch)) return 2
    if ('l`'.includes(ch)) return 3
    if ('It[](){}"* '.includes(ch)) return 4
    if ('fk<>'.includes(ch)) return 5
    if ('@~'.includes(ch)) return 7
    return 6
}

/** 去掉 § 格式码 */
export const stripFormat = (s: string) => s.replace(/§./g, '')

/** 粗体每个字多出的宽度（Java 版为 1；基岩版待字宽标尺校准） */
export const BOLD_EXTRA = 1

/**
 * 宽度（像素）：§ 码不占宽度；粗体（§l 起、§r 止——基岩版换颜色不清粗体）每字加 BOLD_EXTRA。
 * `bold` = 进入这段文字时是否已是粗体。
 */
export function textWidth(s: string, scale = 1, bold = false): number {
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
        w += charWidth(ch) + (bold ? BOLD_EXTRA : 0)
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
export function measureText(text: string, scale = 1, maxWidth = Infinity): TextMetrics {
    const lines: string[] = []
    for (const para of text.split('\n')) {
        if (maxWidth === Infinity) { lines.push(para); continue }
        const tokens = para.match(/§.|[A-Za-z0-9_\-'.]+|\s+|./gu) ?? []
        let line = ''
        for (const tok of tokens) {
            if (line !== '' && textWidth(line + tok, scale) > maxWidth && !/^\s+$/.test(tok)) {
                lines.push(line.trimEnd())
                line = tok.trimStart()
            } else line += tok
        }
        lines.push(line.trimEnd())
    }
    const width = Math.max(0, ...lines.map((l) => textWidth(l, scale)))
    return { lines, width, height: lines.length * LINE_HEIGHT * scale }
}
