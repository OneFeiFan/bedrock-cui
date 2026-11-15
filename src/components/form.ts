/**
 * 服务端表单组件（ActionFormData 驱动的自定义界面），都是 GuideBook 真机验证过的模式：
 *   FormGate   正文（#form_text）包含 tag 时显示
 *   FormButton 绑定到第 index 个表单按钮；按钮文字包含 tag 时显示（tag 后面可带运行期数据，用 buttonPayload(tag) 读）
 */
import { form } from '../core/expr.js'
import { Button, CollectionItem, Panel } from '../core/element.js'
import { Anchor, Size } from '../core/values.js'

/** 表单正文包含 tag 时才显示的面板 */
export class FormGate extends Panel {
    constructor(tag: string) {
        super()
        this.setSize(Size.full())
        this._tag = tag
        this.setVisible(form.text.contains(tag))
    }
    private _tag: string
    /** 表单正文包含这个标记时显示；改了同步更新显示条件 */
    get tag(): string { return this._tag }
    set tag(v: string) { this._tag = v; this.visible = form.text.contains(v) }
    setTag(v: string): this { this.tag = v; return this }
}

/** 表单按钮：子元素加在按钮里；状态面板 default / hover / pressed 直接用 */
export class FormButton extends CollectionItem {
    readonly button: Button
    private _tag: string

    /** 第 index 个表单按钮；按钮文字含 tag 时显示；宽高是像素（编译成正方形网格需要边长） */
    constructor(index: number, tag: string, width: number, height: number) {
        super('form_buttons', index)
        this.setSize(width, height)
        this._tag = tag
        this.button = new Button().setName('button').setSize(width, height).setAnchor(Anchor.CENTER).setVisible(form.buttonText.contains(tag))
        super.add(this.button)
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

    /** 按钮文字的标记（文字含它时显示）；改了同步更新显示条件 */
    get tag(): string { return this._tag }
    set tag(v: string) { this._tag = v; this.button.visible = form.buttonText.contains(v) }
    setTag(v: string): this { this.tag = v; return this }
    /** 默认聚焦优先级（服务端重开表单、鼠标没动时，点击交给默认聚焦的控件） */
    get focusPrecedence(): number | undefined { return this.button.focusPrecedence }
    set focusPrecedence(v: number | undefined) { this.button.focusPrecedence = v }
    setFocusPrecedence(n: number): this { this.focusPrecedence = n; return this }
    /** 仅预览：点击回调 */
    setOnPress(fn: () => void): this { this.button.setOnPress(fn); return this }
    /** 同 setOnPress */
    onPress(fn: () => void): this { return this.setOnPress(fn) }
}

/** FormButton 里：按钮文字去掉 tag 之后的运行期数据 */
export const buttonPayload = (tag: string) => form.buttonText.minus(tag)
