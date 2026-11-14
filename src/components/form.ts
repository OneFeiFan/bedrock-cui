/**
 * 服务端表单组件（ActionFormData 驱动的自定义界面），都是 GuideBook 真机验证过的模式：
 *   FormGate   正文（#form_text）包含 tag 时显示
 *   FormButton 绑定到第 index 个表单按钮；按钮文字包含 tag 时显示（tag 后面可带运行期数据，用 buttonPayload(tag) 读）
 */
import { form } from '../core/expr.js'
import { Button, CollectionItem, Panel, type LayoutOptions, isOptions, _applyOptions } from '../core/element.js'
import { Anchor, Size } from '../core/values.js'

export interface FormGateOptions extends LayoutOptions { tag: string }

/** 表单正文包含 tag 时才显示的面板 */
export class FormGate extends Panel {
    constructor(tag: string)
    /** @deprecated 用 new FormGate(标记) */
    constructor(options: FormGateOptions)
    constructor(a: string | FormGateOptions) {
        const { tag, ...rest } = isOptions(a) ? a as FormGateOptions : { tag: a as string }
        super()
        this.setSize(Size.full())
        _applyOptions(this, rest)       // 已弃用的参数对象写法带来的布局选项
        this.setVisible(form.text.contains(tag))
    }
}

export interface FormButtonOptions extends Omit<LayoutOptions, 'size' | 'visible'> {
    /** 第几个表单按钮（ActionFormData.button 的顺序，从 0 起） */
    index: number
    /**
     * 按钮文字的标记。门控是「按钮文字**包含** tag」（JSON UI 没有「以……开头」）：
     * tag 不能是其它按钮文字的子串——`l1|` 不会误中 `l10|`，但 `prev|` 会误中 `no_prev|`。不显示的按钮发空文字即可。
     */
    tag: string
    /** 像素尺寸（编译成正方形网格需要边长） */
    size: [number, number]
    /** 仅预览：点击回调 */
    onPress?: () => void
    /** 默认聚焦优先级（服务端重开表单、鼠标没动时，点击交给默认聚焦的控件） */
    focusPrecedence?: number
}

/** 表单按钮：子元素加在按钮里；状态面板 default / hover / pressed 直接用 */
export class FormButton extends CollectionItem {
    readonly button: Button
    readonly tag: string

    /** 第 index 个表单按钮；按钮文字含 tag 时显示；宽高是像素（编译成正方形网格需要边长） */
    constructor(index: number, tag: string, width: number, height: number)
    /** @deprecated 用 new FormButton(序号, 标记, 宽, 高) */
    constructor(options: FormButtonOptions)
    constructor(a: number | FormButtonOptions, tagArg?: string, width?: number, height?: number) {
        const options: FormButtonOptions = isOptions(a) ? a as FormButtonOptions : { index: a as number, tag: tagArg!, size: [width!, height!] }
        const { index, tag, size, onPress, focusPrecedence, children, name, anchor, anchorFrom, anchorTo, offset, layer, gridPos } = options
        super('form_buttons', index)
        // 尺寸是两种写法都有的；其余布局选项只有已弃用的参数对象写法会带来
        _applyOptions(this, { name, size, anchor, anchorFrom, anchorTo, offset, layer, gridPos })
        this.tag = tag
        this.button = new Button().setName('button').setSize(Size.from(size as [number, number])).setAnchor(Anchor.CENTER).setVisible(form.buttonText.contains(tag))
        if (focusPrecedence !== undefined) this.button.setFocusPrecedence(focusPrecedence)
        if (onPress) this.button.onPress(onPress)
        super.add(this.button)
        if (children) this.add(...children)
    }

    get default() { return this.button.default }
    get hover() { return this.button.hover }
    get pressed() { return this.button.pressed }

    /** 子元素加到按钮里（始终显示） */
    override add(...items: Parameters<CollectionItem['add']>): this {
        if (!this.button) return super.add(...items)
        this.button.add(...items)
        return this
    }

    /** 按钮文字去掉 tag 之后的运行期数据 */
    payload() { return form.buttonText.minus(this.tag) }

    /** 默认聚焦优先级（服务端重开表单、鼠标没动时，点击交给默认聚焦的控件） */
    setFocusPrecedence(n: number): this { this.button.setFocusPrecedence(n); return this }
    /** 仅预览：点击回调 */
    onPress(fn: () => void): this { this.button.onPress(fn); return this }
}

/** FormButton 里：按钮文字去掉 tag 之后的运行期数据 */
export const buttonPayload = (tag: string) => form.buttonText.minus(tag)
