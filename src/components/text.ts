/**
 * 长文本 / 富文本：
 *   Paragraph  预折行的段落（Label 子类）：宽度确定、高度 default；行首补样式码；避头尾、中英文留空
 *   paginate() 把长文本切成一页一页（见 font/rich.ts），每页用一个 Paragraph
 */
import { Label, type LabelOptions } from '../core/element.js'
import { wrapText, type WrapOptions } from '../font/rich.js'

export interface ParagraphOptions extends Omit<LabelOptions, 'text' | 'size'>, WrapOptions {
    text: string
    /** 段落宽度（像素） */
    width: number
}

export class Paragraph extends Label {
    /** 折好的行 */
    readonly lines: string[]
    constructor(options: ParagraphOptions) {
        const { text, width, kinsoku, autoSpace, hang, ...rest } = options
        const lines = wrapText(text, width, { scale: options.fontScale ?? 1, kinsoku, autoSpace, hang })
        super({ ...rest, text: lines.join('\n'), size: [width, 'default'] })
        this.lines = lines
    }
}
