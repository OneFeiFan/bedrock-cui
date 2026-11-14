/**
 * 预览用像素字体：照游戏的规则画文字（真机字宽标尺校准）——
 *   · 含非 ASCII 字符的整段文字用 **Unifont** 点阵画：每个点阵格 = 半个界面像素，从第一列墨迹开始画，
 *     字距 = 墨迹宽 / 2 + 1；
 *   · 纯 ASCII 文字用 **Minecraft 默认字体**（ascii.png，8×8 点阵，1 格 = 1 界面像素）；没有 ascii.png 时也用 Unifont。
 *   · 阴影：右下各偏 1 界面像素、颜色 ×0.25；粗体：右移 1（Minecraft）/ 0.5（Unifont）再画一遍；斜体：按行斜切；§k：同宽随机字形。
 * 字体文件由 scripts/fetch-fonts.mjs 准备（Unifont：OFL；ascii.png 取自本机的 Java 版客户端，不随源码分发）。
 */
import { GAME_GLYPHS, GAME_GLYPH_THRESHOLD } from '../font/gameGlyphs.js'
import { boldExtra, charWidth, GLYPH_TOP, LINE_HEIGHT } from '../font/metrics.js'
import { BEDROCK_COLORS, PLAIN, parseRich, type RunStyle } from '../font/rich.js'

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
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            // 按文件头判断是否 gzip（1F 8B），不看扩展名：有的开发服务器（Vite 8）给 .gz 加了 Content-Encoding: gzip，
            // 浏览器已经解压过一次，再解压就失败
            const bytes = new Uint8Array(await res.arrayBuffer())
            let text: string
            if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
                if (!('DecompressionStream' in globalThis)) throw new Error('浏览器不支持 DecompressionStream，无法解压 gzip')
                text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
            } else text = new TextDecoder().decode(bytes)
            const map = new Map<number, string>()
            for (const line of text.split('\n')) {
                const i = line.indexOf(':')
                if (i > 0) map.set(parseInt(line.slice(0, i), 16), line.slice(i + 1).trim())
            }
            fonts.unifont = map
        } catch (e) { console.warn('[cui] Unifont 像素字体加载失败，含汉字的文字改用系统字体：', e) }
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
    // 游戏改过的字形优先（从真机截图反推，见 gameGlyphs.ts）
    const bits = GAME_GLYPHS[cp] ?? fonts.unifont?.get(cp)
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

/**
 * 画一个对齐到屏幕像素的方块（x, y, w, h 为屏幕像素，可以是小数），与游戏同样的光栅化：**起点向下取整、终点向上取整**，不做抗锯齿。
 * 真机 1.20.1（缩放 5）：一个半像素本应 2.5 屏幕像素，游戏画成 3–4（笔画均匀、偏实）；字形就是 GNU Unifont（「；」逐格吻合）。
 * 先前预览用四舍五入：3 倍缩放下半像素交替画成 1 / 2 像素，同一个字形里点有粗有细——「，」「。」这种几个点的标点看起来像另一套字体；
 * 更早还有抗锯齿（边缘发灰）。向外取整后每个半像素在 3 倍缩放下都是 2 像素。
 */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const x0 = Math.floor(x + 1e-6), y0 = Math.floor(y + 1e-6), x1 = Math.ceil(x + w - 1e-6), y1 = Math.ceil(y + h - 1e-6)
    if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
}

/** 画一个字形（左上角 x, y，界面像素）；返回是否画了 */
function drawGlyph(ctx: CanvasRenderingContext2D, fonts: PixelFonts, ch: string, x: number, y: number, s: number, unifont: boolean, italic: boolean): boolean {
    const cp = ch.codePointAt(0)!
    const skew = (rowGui: number) => (italic ? (GLYPH_TOP_SKEW * (8 - rowGui)) / 8 : 0)
    if (!unifont && fonts.ascii && cp < 256) {
        const { data, width } = fonts.ascii
        const cx = (cp % 16) * 8, cy = Math.floor(cp / 16) * 8
        const w = charWidth(ch, false) - 1
        for (let r = 0; r < 8; r++) for (let c = 0; c < Math.max(w, 1); c++) {
            if (data[((cy + r) * width + cx + c) * 4 + 3] > 0) px(ctx, (x + c + skew(r)) * s, (y + r) * s, s, s)
        }
        return true
    }
    const g = unifontGlyph(fonts, cp)
    if (!g || g.lo < 0) return !!g
    // 与游戏同样的画法（真机 1.20.1 逐像素验证）：点阵按双线性插值放大，透明度 > 0.35 的屏幕像素上色——
    // 所以「。」是圆环、「，」是圆点，笔画也比半像素略粗。T = 一个点阵格子（半个界面像素）占的屏幕像素
    const T = s / 2
    const bit = (c: number, r: number) => (c >= g.lo && c <= g.hi && r >= 0 && r < 16 ? (g.rows[r] >> (g.w - 1 - c)) & 1 : 0)
    // 字形原点偏半个屏幕像素（像素中心对齐）：真机 1.20.1 的「，」「。」只有在相位 (0.5, 0.5) 时尺寸与游戏一致（6×11、11×11）
    const ox = x * s + 0.5, oy = y * s + 0.5
    const X0 = Math.floor(ox - T), X1 = Math.ceil(ox + (g.hi - g.lo + 2) * T + (italic ? s : 0)), Y0 = Math.floor(oy - T), Y1 = Math.ceil(oy + 17 * T)
    for (let Y = Y0; Y < Y1; Y++) {
        const v = (Y + 0.5 - oy) / T - 0.5
        const sk = italic ? skew(Math.max(0, Math.min(8, v / 2))) * s : 0
        for (let X = X0; X < X1; X++) {
            const u = (X + 0.5 - ox - sk) / T - 0.5 + g.lo
            const c0 = Math.floor(u), r0 = Math.floor(v), fu = u - c0, fv = v - r0
            const val = bit(c0, r0) * (1 - fu) * (1 - fv) + bit(c0 + 1, r0) * fu * (1 - fv) + bit(c0, r0 + 1) * (1 - fu) * fv + bit(c0 + 1, r0 + 1) * fu * fv
            if (val > GAME_GLYPH_THRESHOLD) ctx.fillRect(X, Y, 1, 1)
        }
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
    /** 行与行之间额外的间距（line_padding） */
    lineSpacing?: number
    /** 字形图标的图片（字符 → 已加载的图片；没有 / 没加载完就跳过） */
    glyphImage?: (ch: string) => { img: CanvasImageSource, ink: [number, number] } | undefined
}

/** 在画布上画多行富文本；返回 false 表示字体不够（调用方退回 DOM 画法），否则返回画布上方的余量（界面像素，大字形图标用） */
export function drawText(canvas: HTMLCanvasElement, fonts: PixelFonts, o: DrawTextOptions): false | { padTop: number } {
    if (!fonts.unifont && !(fonts.ascii && !o.unifont)) return false
    const s = o.scale * o.fontScale
    // 行宽（样式跨行延续，粗体要算进去）
    let st: RunStyle = PLAIN
    const lineWidths = o.lines.map((line) => {
        const { runs, end } = parseRich(line, st)
        st = end
        let w = 0
        for (const r of runs) for (const ch of r.text) w += charWidth(ch, o.unifont) + (r.style.bold ? boldExtra(ch, o.unifont) : 0)
        return w
    })
    const boxW = Math.max(o.width, ...lineWidths) + 2
    // 大字形图标（16 高、以文字行为中心）上下各超出 4：画布上下留余量，返回 padTop 让调用方把画布往上挪
    const padTop = o.lines.some((l) => [...l].some((ch) => o.glyphImage?.(ch))) ? 4 : 0
    canvas.width = Math.ceil(boxW * s)
    const pitch = LINE_HEIGHT + (o.lineSpacing ?? 0)
    canvas.height = Math.ceil((o.lines.length * pitch + 2 + padTop * 2) * s)
    // （pitch 已含 line_padding：每行 10 + n）
    const ctx = canvas.getContext('2d')!
    let style: RunStyle = PLAIN
    o.lines.forEach((line, li) => {
        const lw = lineWidths[li]
        let x = o.align === 'center' ? (o.width - lw) / 2 : o.align === 'right' ? o.width - lw : 0
        // line_padding：每行多占 n、文字在行里居中（第一行也下移 n/2，真机 1.20.0）；
        // 字形（8 高）在 10 高的行里居中：比文字控件的顶端低 1（真机 1.24.0：行内图标在行顶、汉字墨迹低 1 像素）
        const y = li * pitch + padTop + (o.lineSpacing ?? 0) / 2 + GLYPH_TOP
        const { runs, end } = parseRich(line, style)
        style = end
        for (const r of runs) {
            const rgb = r.style.color ? hexToRgb(BEDROCK_COLORS[r.style.color]) : o.color.map((v) => Math.round(v * 255)) as [number, number, number]
            for (const ch of r.text) {
                const adv = charWidth(ch, o.unifont) + (r.style.bold ? boldExtra(ch, o.unifont) : 0)
                // 字形图标（emoji 字形页，真机 1.17.0）：裁掉左侧透明列；1:1、16 高、以 8 高的文字行为中心（上下各多 4）；不染色
                const gi = o.glyphImage?.(ch)
                if (gi) {
                    const [left, w] = gi.ink
                    const R = Math.round
                    ctx.imageSmoothingEnabled = false
                    ctx.drawImage(gi.img, left, 0, w, 16, R(x * s), R((y - 4) * s), R(w * s), R(16 * s))
                    x += adv
                    continue
                }
                // §k：Minecraft 字体换成同宽的随机字形；Unifont 文字里真机只显示成点（1.5.3）
                const shown = r.style.obfuscated && ch !== ' '
                    ? (o.unifont ? '.' : [...OBF_POOL].filter((c) => charWidth(c, false) === charWidth(ch, false))[Math.floor(Math.random() * 10)] ?? ch)
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
    return { padTop }
}
