/**
 * 长文本 / 富文本：
 *   Paragraph  预折行的段落（Label 子类）：宽度确定、高度 default；行首补样式码；避头尾、中英文留空
 *   paginate() 把长文本切成一页一页（见 font/rich.ts），每页用一个 Paragraph
 */
import { Label, isOptions, type LabelOptions } from '../core/element.js'
import type { TextStyle } from '../core/values.js'
import { wrapText, type WrapOptions } from '../font/rich.js'

export interface ParagraphOptions extends Omit<LabelOptions, 'text' | 'size'>, WrapOptions {
    text: string
    /** 段落宽度（像素） */
    width: number
}

export class Paragraph extends Label {
    /** 折好的行 */
    readonly lines: string[]
    /** 按 width 像素预折行（避头尾、中英文留空、行首补样式码）；样式里的缩放参与折行 */
    constructor(text: string, width: number, style?: TextStyle)
    /** @deprecated 用 new Paragraph(文字, 宽度, 样式) */
    constructor(options: ParagraphOptions)
    constructor(a: string | ParagraphOptions, widthArg?: number, style?: TextStyle) {
        const options: ParagraphOptions = isOptions(a) ? a as ParagraphOptions : { text: a as string, width: widthArg!, fontScale: style?.scale }
        const { text, width, kinsoku, autoSpace, hang, ...rest } = options
        const lines = wrapText(text, width, { scale: options.fontScale ?? 1, kinsoku, autoSpace, hang })
        super({ ...rest, text: lines.join('\n'), size: [width, 'default'] })
        this.lines = lines
        if (style) this.setStyle(style)
    }
}
