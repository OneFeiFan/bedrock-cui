/**
 * 长文本 / 富文本：
 *   Paragraph  预折行的段落（Label 子类）：宽度确定、高度 default；行首补样式码；避头尾、中英文留空
 *   paginate() 把长文本切成一页一页（见 font/rich.ts），每页用一个 Paragraph
 */
import { Label } from '../core/element.js'
import type { LengthLike, TextStyle } from '../core/values.js'
import { softWrapText, wrapText, type WrapOptions } from '../font/rich.js'
import { measureText } from '../font/metrics.js'

export class Paragraph extends Label {
    private source: string
    private wrapWidth: number
    private wrapOptions: Omit<WrapOptions, 'scale'>
    private wrapped: string[] = []
    private mode: 'soft' | 'hard' = 'soft'

    /** 按 width 像素预折行（避头尾、中英文留空、行首补样式码）；样式里的缩放参与折行 */
    constructor(text: string, width: number, style?: TextStyle) {
        super('')                           // 文字由下面的 rewrap() 写入（折好的行）
        this.source = text
        this.wrapWidth = width
        this.wrapOptions = {}
        if (style) super.setStyle(style)
        this.rewrap()
    }

    /**
     * 重新折行：文字、宽度、字号、模式或折行选项改变时自动调用。
     *   soft（缺省）：交给游戏折行，CUI 只调整汉字与英文 / 数字交界处的间隔（softWrapText）——游戏用当前平台的真实字宽逐字排满，PC 与安卓都对；
     *   hard：CUI 按 PC 字宽排好每一行（避头尾、行首补样式码）——只在 PC 上精确，安卓字宽不同（汉字 9）会超宽、被再折一次。
     */
    private rewrap(): void {
        const scale = this.props.fontScale ?? 1
        if (this.mode === 'soft') {
            const text = softWrapText(this.source, { width: this.wrapWidth, scale, autoSpace: this.wrapOptions.autoSpace })
            this.props.text = text
            this.wrapped = measureText(text, scale, this.wrapWidth).lines
        } else {
            this.wrapped = wrapText(this.source, this.wrapWidth, { scale, ...this.wrapOptions })
            this.props.text = this.wrapped.join('\n')
        }
        this.props.size = [this.wrapWidth, 'default']
    }

    /** 折行模式：'soft'（缺省，交给游戏、跨平台）或 'hard'（CUI 按 PC 字宽排好每一行）；改了会重新折行 */
    get wrap(): 'soft' | 'hard' { return this.mode }
    set wrap(v: 'soft' | 'hard') { this.mode = v; this.rewrap() }
    setWrap(v: 'soft' | 'hard'): this { this.wrap = v; return this }

    /** 折好的行（soft 模式：按当前字宽档案模拟游戏折行的结果） */
    get lines(): string[] { return this.wrapped }
    /** 原文（未折行）；改了会重新折行。Paragraph 只接受字符串（运行期文字请用脚本端预折行） */
    override get text(): string { return this.source }
    override set text(v: string) {
        if (typeof v !== 'string') throw new Error('Paragraph 只接受字符串：运行期文字没法在构建时折行，请用脚本端预折行（cui 的 runtime/wrap）')
        this.source = v; this.rewrap()
    }
    override setText(v: string): this { this.text = v; return this }
    /** 折行宽度（像素）；改了会重新折行 */
    get width(): number { return this.wrapWidth }
    set width(v: number) { this.wrapWidth = v; this.rewrap() }
    override setWidth(w: LengthLike): this {
        if (typeof w !== 'number') throw new Error('Paragraph 的宽度是像素数（按它折行）')
        this.width = w
        return this
    }
    /** 字号倍数；改了会重新折行 */
    override get fontScale(): number | undefined { return this.props.fontScale }
    override set fontScale(v: number | undefined) { this.props.fontScale = v; this.rewrap() }
    override setStyle(st: TextStyle): this { super.setStyle(st); this.rewrap(); return this }
    /** 避头尾（缺省 true） */
    get kinsoku(): boolean | undefined { return this.wrapOptions.kinsoku }
    set kinsoku(v: boolean | undefined) { this.wrapOptions.kinsoku = v; this.rewrap() }
    setKinsoku(on: boolean): this { this.kinsoku = on; return this }
    /** 中英文自动留空（缺省 true；中文标点与英文之间也留——Minecraft 的全角标点画得很窄） */
    get autoSpace(): boolean | undefined { return this.wrapOptions.autoSpace }
    set autoSpace(v: boolean | undefined) { this.wrapOptions.autoSpace = v; this.rewrap() }
    setAutoSpace(on: boolean): this { this.autoSpace = on; return this }
    /** 给挂在行尾的标点留的像素（缺省 8） */
    get hang(): number | undefined { return this.wrapOptions.hang }
    set hang(v: number | undefined) { this.wrapOptions.hang = v; this.rewrap() }
    setHang(px: number): this { this.hang = px; return this }
    /** 字体（缺省按内容：含非 ASCII ⇒ Unifont） */
    get unifont(): boolean | undefined { return this.wrapOptions.unifont }
    set unifont(v: boolean | undefined) { this.wrapOptions.unifont = v; this.rewrap() }
    setUnifont(on: boolean): this { this.unifont = on; return this }
}
