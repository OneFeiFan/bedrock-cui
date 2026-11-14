/**
 * 字形图标：把物品图标放进资源包的字形图（font/glyph_XX.png），文字里写对应的字符就显示图标——图标嵌在文字行里、跟着文字折行。
 *
 *   const ICONS = new GlyphSheet('E2')
 *   const DIAMOND = ICONS.icon('diamond', Texture.of('textures/items/diamond'))                    // 小图标：与文字同高
 *   const BIG_SWORD = ICONS.icon('sword_big', 'textures/items/diamond_sword', { size: 'large' })   // 大图标：16 高
 *   new Paragraph(`合成需要 ${DIAMOND}×2`, 110, BODY)
 *
 * 真机（1.16.x）：JSON UI（聊天栏）显示自定义字形页 E2 ✅；DDUI（Ore UI）不认任何字形页（E0 / E1 / E2 都是方框）——只用于 JSON UI。
 * 原版只用 E0 / E1 两页，E2–F8 空着（社区文档），用它们不会覆盖原版图标；可能与别的自定义字形包冲突。
 *
 * 字形图是 16×16 格（256×256、每格 16 像素），第 n 格 = U+XX00 + n。真机规则（1.17.0 字宽标尺逐像素量过）：
 *   · 自定义字形页按 **1:1** 画：16 像素的格子 = 16 界面像素高，**以 8 像素高的文字行为中心**（上下各多 4）——
 *     与汉字（Unifont，按一半画）不同；
 *   · **字距 = 墨迹宽 + 1**（左侧透明列被裁掉）；粗体再加 0.5；§ 颜色码不染色。
 * 所以两种尺寸：small（缺省）= 构建时缩成 8×8、放在格子中间 8 行，与文字同高（字距 ≤ 9）；large = 16×16，比文字高一倍，
 * 放进多行文字会压到上下行（静态检查提示）。墨迹由构建时读贴图算出来（cui/node 的 renderGlyphSheet），与这里写的不符时报出正确值。
 */
import { registerGlyphWidth, unregisterGlyph } from '../font/metrics.js'
import { Texture } from './values.js'

/** 一个字形图标：toString() 就是它的字符，可以直接写进模板字符串 */
export type GlyphSize = 'small' | 'large'

export class Glyph {
    constructor(
        readonly char: string,
        readonly name: string,
        readonly texture: Texture,
        /** 在字形图里的格号（0–255） */
        readonly cell: number,
        /** 墨迹：[左边第一列, 宽度]（画出来的像素：small 是 8×8 里的，large 是 16×16 里的） */
        readonly ink: [number, number],
        /** small = 8×8，与文字同高；large = 16×16 */
        readonly size: GlyphSize = 'small',
    ) { }
    /** 字距（界面像素）：墨迹宽 + 1（真机 1.17.0） */
    get advance(): number { return this.ink[1] + 1 }
    /** 画出来的边长（界面像素） */
    get pixels(): number { return this.size === 'large' ? 16 : 8 }
    toString(): string { return this.char }
}

export interface GlyphIconOptions {
    /** small（缺省，8×8，与文字同高）或 large（16×16） */
    size?: GlyphSize
    /** 墨迹 [左边第一列, 宽度]（画出来的像素）；缺省占满。构建时按贴图核对，不符会报出正确值 */
    ink?: [number, number]
}

/** 一页字形图（256 个字符：U+XX00–U+XXFF） */
export class GlyphSheet {
    private static readonly byChar = new Map<string, Glyph>()
    readonly page: number
    readonly glyphs: Glyph[] = []

    /** page：字形页，'E2'–'F8'（原版不用）；E0 / E1 是原版的页，不要用 */
    constructor(page: string | number = 'E2') {
        this.page = typeof page === 'number' ? page : parseInt(page, 16)
        if (!(this.page >= 0xe2 && this.page <= 0xf8)) throw new Error(`字形页请用 E2–F8（原版只用 E0 / E1）：${page}`)
    }

    /** 资源包里的文件名 */
    get fileName(): string { return `font/glyph_${this.page.toString(16).toUpperCase()}.png` }

    /** 加一个图标（16×16 贴图）。缺省小图标（8×8，与文字同高）；{ size: 'large' } = 16×16 */
    icon(name: string, texture: Texture | string, options: GlyphIconOptions = {}): Glyph {
        if (this.glyphs.length >= 256) throw new Error('一页字形图最多 256 个图标')
        if (this.glyphs.some((g) => g.name === name)) throw new Error(`图标重名：${name}`)
        const size = options.size ?? 'small'
        const ink = options.ink ?? [0, size === 'large' ? 16 : 8]
        const cell = this.glyphs.length
        const char = String.fromCodePoint(this.page * 256 + cell)
        const g = new Glyph(char, name, Texture.from(texture), cell, ink, size)
        this.glyphs.push(g)
        GlyphSheet.byChar.set(char, g)
        registerGlyphWidth(char, g.advance)
        return g
    }

    /** @internal 构建时按贴图算出的墨迹改正（同时改字宽） */
    _setInk(g: Glyph, ink: [number, number]): void {
        const fixed = new Glyph(g.char, g.name, g.texture, g.cell, ink, g.size)
        this.glyphs[g.cell] = fixed
        GlyphSheet.byChar.set(g.char, fixed)
        unregisterGlyph(g.char)
        registerGlyphWidth(g.char, fixed.advance)
    }

    /** 某个字符是不是字形图标（预览画图标用） */
    static lookup(char: string): Glyph | undefined { return GlyphSheet.byChar.get(char) }
}
