/**
 * 字形图标：把物品图标放进资源包的字形图（font/glyph_XX.png），文字里写对应的字符就显示图标——图标嵌在文字行里、跟着文字折行。
 *
 *   const SMALL = new GlyphSheet('A0', { kind: 'text' })            // 文字页：与汉字同高（8），16×16 细节完整
 *   const DIAMOND = SMALL.icon('diamond', Texture.of('textures/items/diamond'))
 *   const BIG = new GlyphSheet('E2')                                 // emoji 页：16 高
 *   const BIG_SWORD = BIG.icon('sword', 'textures/items/diamond_sword')
 *   new Paragraph(`合成需要 ${DIAMOND}×2`, 110, BODY)
 *
 * 真机（1.16.x）：JSON UI（聊天栏）显示自定义字形页 E2 ✅；DDUI（Ore UI）不认任何字形页（E0 / E1 / E2 都是方框）——只用于 JSON UI。
 * 原版只用 E0 / E1 两页，E2–F8 空着（社区文档），用它们不会覆盖原版图标；可能与别的自定义字形包冲突。
 *
 * 字形图是 16×16 格（256×256、每格 16 像素），第 n 格 = U+XX00 + n。真机规则（1.17.0 字宽标尺逐像素量过）：
 *   · 自定义字形页按 **1:1** 画：16 像素的格子 = 16 界面像素高，**以 8 像素高的文字行为中心**（上下各多 4）——
 *     与汉字（Unifont，按一半画）不同；
 *   · **字距 = 墨迹宽 + 1**（左侧透明列被裁掉）；粗体再加 0.5；§ 颜色码不染色。
 * 真机 1.18.0：缩成 8×8 的小图标模糊、失去形状。原版日文字形图同样是 256×256、16 像素格，却按一半画（8 高）——
 * **缩放取决于页的类型**：E0–F8 私用区 = emoji 页（1:1、不染色）；普通 Unicode 页 = 文字页（按一半画、乘文字颜色）。所以两种页：
 *   · kind 'emoji'（E2–F8）：16 高，比文字高一倍，字距 = 墨迹宽 + 1；放进多行文字会压行（静态检查提示）——标题 / 单独一行用
 *   · kind 'text'（借用彝文 A0–A4 页，会顶替这几页原有的字）：16×16 的图按一半画成 8 高，与汉字同高、细节完整，
 *     字距 = 墨迹宽 / 2 + 1（汉字的规则）；文字页会被文字颜色相乘，所以字符自动包成 §f…§r（白色 = 原色）——正文用 ⏳ 待真机确认
 * 墨迹由构建时读贴图算出来（cui/node 的 renderGlyphSheet），与这里写的不符时报出正确值。
 */
import { registerGlyphWidth, unregisterGlyph } from '../font/metrics.js'
import { Texture } from './values.js'

/** 一个字形图标：toString() 就是它的字符，可以直接写进模板字符串 */
export type GlyphKind = 'emoji' | 'text'
/** 文字页只许借用这几页（彝文音节 / 部首，游戏里几乎用不到） */
const TEXT_PAGES = [0xa0, 0xa1, 0xa2, 0xa3, 0xa4]

export class Glyph {
    constructor(
        readonly char: string,
        readonly name: string,
        readonly texture: Texture,
        /** 在字形图里的格号（0–255） */
        readonly cell: number,
        /** 墨迹：[左边第一列, 宽度]（16×16 里的像素） */
        readonly ink: [number, number],
        /** emoji = 1:1（16 高）；text = 按一半画（8 高，与汉字同高） */
        readonly kind: GlyphKind = 'emoji',
    ) { }
    /** 字距（界面像素）：emoji 页 = 墨迹宽 + 1；文字页 = 墨迹宽 / 2 + 1（真机 1.17.0 / 汉字的规则） */
    get advance(): number { return this.kind === 'emoji' ? this.ink[1] + 1 : this.ink[1] / 2 + 1 }
    /** 画出来的高（界面像素） */
    get pixels(): number { return this.kind === 'emoji' ? 16 : 8 }
    /** @deprecated 用 kind；emoji 页 = 'large'，文字页 = 'small' */
    get size(): 'small' | 'large' { return this.kind === 'emoji' ? 'large' : 'small' }
    /** 写进文字的写法：文字页包成 §f…§r（文字页乘文字颜色，白色 = 原色）；emoji 页就是字符本身 */
    toString(): string { return this.kind === 'text' ? `§f${this.char}§r` : this.char }
}

export interface GlyphIconOptions {
    /** 墨迹 [左边第一列, 宽度]（16×16 里的像素）；缺省占满。构建时按贴图核对，不符会报出正确值 */
    ink?: [number, number]
}

export interface GlyphSheetOptions {
    /** emoji（E2–F8，缺省）或 text（借用 A0–A4 文字页） */
    kind?: GlyphKind
}

/** 一页字形图（256 个字符：U+XX00–U+XXFF） */
export class GlyphSheet {
    private static readonly byChar = new Map<string, Glyph>()
    readonly page: number
    readonly kind: GlyphKind
    readonly glyphs: Glyph[] = []

    /** page：emoji 页 'E2'–'F8'（原版只用 E0 / E1）；文字页 'A0'–'A4'（{ kind: 'text' }，借用彝文） */
    constructor(page: string | number = 'E2', options: GlyphSheetOptions = {}) {
        this.page = typeof page === 'number' ? page : parseInt(page, 16)
        this.kind = options.kind ?? 'emoji'
        if (this.kind === 'emoji' && !(this.page >= 0xe2 && this.page <= 0xf8)) throw new Error(`emoji 字形页请用 E2–F8（原版只用 E0 / E1）：${page}`)
        if (this.kind === 'text' && !TEXT_PAGES.includes(this.page)) throw new Error(`文字字形页只许借用 A0–A4（彝文，几乎用不到）：${page}`)
    }

    /** 资源包里的文件名 */
    get fileName(): string { return `font/glyph_${this.page.toString(16).toUpperCase()}.png` }

    /** 加一个图标（16×16 贴图） */
    icon(name: string, texture: Texture | string, options: GlyphIconOptions = {}): Glyph {
        if (this.glyphs.length >= 256) throw new Error('一页字形图最多 256 个图标')
        if (this.glyphs.some((g) => g.name === name)) throw new Error(`图标重名：${name}`)
        const ink = options.ink ?? [0, 16]
        const cell = this.glyphs.length
        const char = String.fromCodePoint(this.page * 256 + cell)
        const g = new Glyph(char, name, Texture.from(texture), cell, ink, this.kind)
        this.glyphs.push(g)
        GlyphSheet.byChar.set(char, g)
        registerGlyphWidth(char, g.advance)
        return g
    }

    /** @internal 构建时按贴图算出的墨迹改正（同时改字距） */
    _setInk(g: Glyph, ink: [number, number]): void {
        const fixed = new Glyph(g.char, g.name, g.texture, g.cell, ink, g.kind)
        this.glyphs[g.cell] = fixed
        GlyphSheet.byChar.set(g.char, fixed)
        unregisterGlyph(g.char)
        registerGlyphWidth(g.char, fixed.advance)
    }

    /** 某个字符是不是字形图标（预览画图标用） */
    static lookup(char: string): Glyph | undefined { return GlyphSheet.byChar.get(char) }
}
