/**
 * 字形图标（emoji 字形页）：把物品图标放进资源包的字形图（font/glyph_XX.png，XX = E2–F8），文字里写对应的字符就显示图标。
 * 用途：**服务端运行期发来的文字**里显示图标（CUI 事先不知道内容、无法排版）——配合 Label.setLineSpacing(6)。
 * 构建时就确定的文字请用行内图标 Text + InlineIcon（图片控件：与文字同高、清晰、颜色正确）。
 *
 *   const ICONS = new GlyphSheet('E2')
 *   const DIAMOND = ICONS.icon('diamond', Texture.of('textures/items/diamond'), { ink: [2, 12] })
 *   new Label(`${DIAMOND} 钻石 ×3\n${SWORD} 钻石剑 ×1`).setLineSpacing(6)
 *
 * 真机规则（1.17.0 字宽标尺逐像素量过）：emoji 字形页按 **1:1** 画——16 像素的格子 = 16 界面像素高，以 8 像素高的文字行为中心（上下各多 4）；
 * **字距 = 墨迹宽 + 1**（左侧透明列被裁掉）；粗体再加 0.5；§ 颜色码不染色。比文字高一倍，放进多行文字会压行（静态检查 glyph-line-overlap；行距 ≥ 6 放行）。
 * 原版只用 E0 / E1 两页，E2–F8 空着（社区文档），用它们不会覆盖原版图标；可能与别的自定义字形包冲突。DDUI（Ore UI）不认任何字形页。
 *
 * 已移除（v0.20）：借用彝文 A0–A4 的「文字页」图标（按一半画、与汉字同高）——真机 1.19.0 颜色错乱（文字页的字形当单色遮罩画），由 Text + InlineIcon 取代。
 * 也试过把图标缩成 8×8 放在 emoji 页（1.18.0）：模糊、失去形状。
 *
 * 字形图是 16×16 格（256×256、每格 16 像素），第 n 格 = U+XX00 + n。墨迹由构建时读贴图算出来（cui/node 的 renderGlyphSheet），与这里写的不符时报出正确值。
 */
import { registerGlyphWidth, unregisterGlyph } from '../font/metrics.js'
import { Texture } from './values.js'

/** 一个字形图标：toString() 就是它的字符，可以直接写进模板字符串 */
export class Glyph {
    constructor(
        readonly char: string,
        readonly name: string,
        readonly texture: Texture,
        /** 在字形图里的格号（0–255） */
        readonly cell: number,
        /** 墨迹：[左边第一列, 宽度]（16×16 里的像素） */
        readonly ink: [number, number],
    ) { }
    /** 字距（界面像素）：墨迹宽 + 1（真机 1.17.0） */
    get advance(): number { return this.ink[1] + 1 }
    /** 画出来的高（界面像素）：16，以文字行为中心 */
    get pixels(): number { return 16 }
    toString(): string { return this.char }
}

export interface GlyphIconOptions {
    /** 墨迹 [左边第一列, 宽度]（16×16 里的像素）；缺省占满。构建时按贴图核对，不符会报出正确值 */
    ink?: [number, number]
}

/** 一页 emoji 字形图（256 个字符：U+XX00–U+XXFF） */
export class GlyphSheet {
    private static readonly byChar = new Map<string, Glyph>()
    readonly page: number
    readonly glyphs: Glyph[] = []

    /** page：'E2'–'F8'（原版只用 E0 / E1） */
    constructor(page: string | number = 'E2', options?: { kind?: string }) {
        if (options?.kind && options.kind !== 'emoji') {
            throw new Error('文字页字形图标（kind: \'text\'）已移除：真机颜色错乱。构建时确定的文字请用 Text + InlineIcon；运行期文字用 emoji 页 + setLineSpacing(6)')
        }
        this.page = typeof page === 'number' ? page : parseInt(page, 16)
        if (!(this.page >= 0xe2 && this.page <= 0xf8)) throw new Error(`字形页请用 E2–F8（原版只用 E0 / E1）：${page}`)
    }

    /** 资源包里的文件名 */
    get fileName(): string { return `font/glyph_${this.page.toString(16).toUpperCase()}.png` }

    /** 加一个图标（16×16 贴图） */
    icon(name: string, texture: Texture | string, options: GlyphIconOptions = {}): Glyph {
        if (this.glyphs.length >= 256) throw new Error('一页字形图最多 256 个图标')
        if (this.glyphs.some((g) => g.name === name)) throw new Error(`图标重名：${name}`)
        const cell = this.glyphs.length
        const char = String.fromCodePoint(this.page * 256 + cell)
        const g = new Glyph(char, name, Texture.from(texture), cell, options.ink ?? [0, 16])
        this.glyphs.push(g)
        GlyphSheet.byChar.set(char, g)
        registerGlyphWidth(char, g.advance)
        return g
    }

    /** @internal 构建时按贴图算出的墨迹改正（同时改字距） */
    _setInk(g: Glyph, ink: [number, number]): void {
        const fixed = new Glyph(g.char, g.name, g.texture, g.cell, ink)
        this.glyphs[g.cell] = fixed
        GlyphSheet.byChar.set(g.char, fixed)
        unregisterGlyph(g.char)
        registerGlyphWidth(g.char, fixed.advance)
    }

    /** 某个字符是不是字形图标（预览画图标用） */
    static lookup(char: string): Glyph | undefined { return GlyphSheet.byChar.get(char) }
}
