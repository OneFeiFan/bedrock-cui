/**
 * 预览用像素字体：照游戏的规则画文字（真机字宽标尺校准）——
 *   · 含非 ASCII 字符的整段文字用 **Unifont** 点阵画：每个点阵格 = 半个界面像素，从第一列墨迹开始画，
 *     字距 = 墨迹宽 / 2 + 1；
 *   · 纯 ASCII 文字用 **Minecraft 默认字体**（ascii.png，8×8 点阵，1 格 = 1 界面像素）；没有 ascii.png 时也用 Unifont。
 *   · 阴影：右下各偏 1 界面像素、颜色 ×0.25；粗体：右移 1（Minecraft）/ 0.5（Unifont）再画一遍；斜体：按行斜切；§k：同宽随机字形。
 * 字体文件由 scripts/fetch-fonts.mjs 准备（Unifont：OFL；ascii.png 取自本机的 Java 版客户端，不随源码分发）。
 */
import { boldExtra, charWidth, LINE_HEIGHT } from '../font/metrics.js'
import { BEDROCK_COLORS, PLAIN, parseRich, type TextStyle } from '../font/rich.js'

export interface PixelFonts {
    /** Unifont：码点 → 点阵十六进制（32 位 = 8×16，64 位 = 16×16） */
    unifont?: Map<number, string>
    /** Minecraft 默认字体：ascii.png 的像素（128×128，16×16 格，每格 8×8） */
    ascii?: { data: Uint8ClampedArray, width: number }
}

/** 加载字体（.hex 或 .hex.gz；ascii.png） */
export async function loadPixelFonts(urls: { unifont?: string, ascii?: string }): Promise<PixelFonts> {
    const fonts: PixelFonts = {}
    if (urls.unifont) {
        try {
            const res = await fetch(urls.unifont)
            let text: string
            if (urls.unifont.endsWith('.gz') && 'DecompressionStream' in globalThis) {
                text = await new Response(res.body!.pipeThrough(new DecompressionStream('gzip'))).text()
            } else text = await res.text()
            const map = new Map<number, string>()
            for (const line of text.split('\n')) {
                const i = line.indexOf(':')
                if (i > 0) map.set(parseInt(line.slice(0, i), 16), line.slice(i + 1).trim())
            }
            fonts.unifont = map
        } catch { /* 没有就算了 */ }
    }
    if (urls.ascii) {
        try {
            const img = new Image()
            img.src = urls.ascii
            await img.decode()
            const c = document.createElement('canvas')
            c.width = img.width; c.height = img.height
            const ctx = c.getContext('2d')!
            ctx.drawImage(img, 0, 0)
            fonts.ascii = { data: ctx.getImageData(0, 0, img.width, img.height).data, width: img.width }
        } catch { /* 没有就算了 */ }
    }
    return fonts
}

const glyphCache = new Map<number, { w: number, rows: number[], lo: number, hi: number }>()
function unifontGlyph(fonts: PixelFonts, cp: number) {
    const hit = glyphCache.get(cp)
    if (hit) return hit
    const bits = fonts.unifont?.get(cp)
    if (!bits) return undefined
    const w = bits.length === 64 ? 16 : 8
    const rows: number[] = []
    for (let i = 0; i < bits.length; i += w / 4) rows.push(parseInt(bits.slice(i, i + w / 4), 16))
    let lo = -1, hi = -1
    for (let x = 0; x < w; x++) if (rows.some((r) => (r >> (w - 1 - x)) & 1)) { if (lo < 0) lo = x; hi = x }
    const g = { w, rows, lo, hi }
    glyphCache.set(cp, g)
    return g
}

const hexToRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
const OBF_POOL = 'abcdefghjkmnopqrsuvwxyzABCDEFGHJKLMNOPQRSUVWXYZ0123456789#$%&+=?'

/** 画一个字形（左上角 x, y，界面像素）；返回是否画了 */
function drawGlyph(ctx: CanvasRenderingContext2D, fonts: PixelFonts, ch: string, x: number, y: number, s: number, unifont: boolean, italic: boolean): boolean {
    const cp = ch.codePointAt(0)!
    const skew = (rowGui: number) => (italic ? (GLYPH_TOP_SKEW * (8 - rowGui)) / 8 : 0)
    if (!unifont && fonts.ascii && cp < 256) {
        const { data, width } = fonts.ascii
        const cx = (cp % 16) * 8, cy = Math.floor(cp / 16) * 8
        const w = charWidth(ch, false) - 1
        for (let r = 0; r < 8; r++) for (let c = 0; c < Math.max(w, 1); c++) {
            if (data[((cy + r) * width + cx + c) * 4 + 3] > 0) ctx.fillRect((x + c + skew(r)) * s, (y + r) * s, s, s)
        }
        return true
    }
    const g = unifontGlyph(fonts, cp)
    if (!g || g.lo < 0) return !!g
    const h = s / 2
    for (let r = 0; r < 16; r++) for (let c = g.lo; c <= g.hi; c++) {
        if ((g.rows[r] >> (g.w - 1 - c)) & 1) ctx.fillRect((x + (c - g.lo) / 2 + skew(r / 2)) * s, (y + r / 2) * s, h, h)
    }
    return true
}

/** 斜体：字形顶部相对底部右移的界面像素 */
const GLYPH_TOP_SKEW = 1

export interface DrawTextOptions {
    lines: string[]
    /** 控件的颜色（没有 § 颜色码时用） */
    color: [number, number, number]
    shadow: boolean
    unifont: boolean
    align: 'left' | 'center' | 'right'
    /** 文字框宽度（界面像素，对齐用） */
    width: number
    /** 屏幕像素 / 界面像素 */
    scale: number
    fontScale: number
}

/** 在画布上画多行富文本；返回 false 表示字体不够（调用方退回 DOM 画法） */
export function drawText(canvas: HTMLCanvasElement, fonts: PixelFonts, o: DrawTextOptions): boolean {
    if (!fonts.unifont && !(fonts.ascii && !o.unifont)) return false
    const s = o.scale * o.fontScale
    // 行宽（样式跨行延续，粗体要算进去）
    let st: TextStyle = PLAIN
    const lineWidths = o.lines.map((line) => {
        const { runs, end } = parseRich(line, st)
        st = end
        let w = 0
        for (const r of runs) for (const ch of r.text) w += charWidth(ch, o.unifont) + (r.style.bold ? boldExtra(ch, o.unifont) : 0)
        return w
    })
    const boxW = Math.max(o.width, ...lineWidths) + 2
    canvas.width = Math.ceil(boxW * s)
    canvas.height = Math.ceil((o.lines.length * LINE_HEIGHT + 2) * s)
    const ctx = canvas.getContext('2d')!
    let style: TextStyle = PLAIN
    o.lines.forEach((line, li) => {
        const lw = lineWidths[li]
        let x = o.align === 'center' ? (o.width - lw) / 2 : o.align === 'right' ? o.width - lw : 0
        const y = li * LINE_HEIGHT
        const { runs, end } = parseRich(line, style)
        style = end
        for (const r of runs) {
            const rgb = r.style.color ? hexToRgb(BEDROCK_COLORS[r.style.color]) : o.color.map((v) => Math.round(v * 255)) as [number, number, number]
            for (const ch of r.text) {
                const adv = charWidth(ch, o.unifont) + (r.style.bold ? boldExtra(ch, o.unifont) : 0)
                const shown = r.style.obfuscated && ch !== ' '
                    ? [...OBF_POOL].filter((c) => charWidth(c, o.unifont) === charWidth(ch, o.unifont))[Math.floor(Math.random() * 10)] ?? ch
                    : ch
                const passes: [number, number, string][] = []
                if (o.shadow) passes.push([1, 1, `rgb(${rgb.map((v) => v >> 2).join(',')})`])
                passes.push([0, 0, `rgb(${rgb.join(',')})`])
                for (const [dx, dy, fill] of passes) {
                    ctx.fillStyle = fill
                    drawGlyph(ctx, fonts, shown, x + dx, y + dy, s, o.unifont, r.style.italic)
                    if (r.style.bold) drawGlyph(ctx, fonts, shown, x + dx + boldExtra(ch, o.unifont), y + dy, s, o.unifont, r.style.italic)
                }
                x += adv
            }
        }
    })
    return true
}
