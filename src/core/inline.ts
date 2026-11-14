/**
 * 行内图标：写进 Text 的文字里（模板字符串），编译时换成真正的图片控件——16×16 的贴图画进 8×8（或 16×16）界面像素，
 * 清晰、颜色正确、与文字同高；折行、行高由 CUI 的行内排版负责。
 *
 *   const DIAMOND = InlineIcon.of(Textures.DIAMOND)          // 8×8，与文字同高
 *   const BIG = InlineIcon.of(Textures.DIAMOND, 16)          // 16×16，所在行自动加高
 *   new Text(`合成需要 ${DIAMOND}×2`, 110, BODY)
 *
 * 为什么不用字形（真机 1.17.0–1.19.0）：emoji 字形页按 1:1 画——16 高（比文字高一倍）或缩成 8×8（模糊）；文字字形页按一半画、
 * 清晰，但颜色错乱（文字页的字形当单色遮罩画）。字形只适合服务端运行期发来的文字（CUI 事先不知道内容，无法排版）。
 *
 * 在文字里的写法是一个「记号字符」（补充私用区 U+F0000 起，游戏永远看不到）：它的字距登记进字体度量，折行时当作一个固定宽度的单位。
 */
import { registerGlyphWidth } from '../font/metrics.js'
import { Texture } from './values.js'

export type InlineIconSize = 8 | 16

export class InlineIcon {
    private static next = 0
    private static readonly byMarker = new Map<string, InlineIcon>()
    /** 写进文字里的记号字符 */
    readonly marker: string

    private constructor(
        readonly texture: Texture,
        /** 画出来的边长（界面像素）：8 = 与文字同高；16 = 所在行加高到 16 */
        readonly size: InlineIconSize,
        /** 图标后面的间距（与字符一样 1 像素） */
        readonly gap: number,
    ) {
        this.marker = String.fromCodePoint(0xf0000 + InlineIcon.next++)
        InlineIcon.byMarker.set(this.marker, this)
        registerGlyphWidth(this.marker, this.advance)
    }

    /** 一个行内图标：texture 通常是 16×16 的物品贴图 */
    static of(texture: Texture | string, size: InlineIconSize = 8, gap = 1): InlineIcon {
        return new InlineIcon(Texture.from(texture), size, gap)
    }

    /** 占的宽度（界面像素）= 边长 + 间距 */
    get advance(): number { return this.size + this.gap }
    toString(): string { return this.marker }

    /** 某个字符是不是行内图标的记号 */
    static lookup(ch: string): InlineIcon | undefined { return InlineIcon.byMarker.get(ch) }
    /** 文字里有没有行内图标 */
    static within(text: string): boolean { for (const ch of text) if (InlineIcon.byMarker.has(ch)) return true; return false }
}
