/**
 * 服务端表单组件（ActionFormData 驱动的自定义界面）——都是 GuideBook 真机验证过的模式：
 *   FormGate   正文（#form_text）包含 tag 时显示（页面切换）
 *   FormButton 绑定到第 index 个表单按钮；按钮文字以 tag 开头时显示（前缀门控，tag 后面可带运行期数据，
 *              子树里用 form.buttonText.minus(tag) 读出来）
 */
import { form } from '../core/expr.js'
import { h, type Child, type LayoutProps, type Size } from '../core/node.js'

export interface FormGateProps extends LayoutProps { tag: string }

export function FormGate(props: FormGateProps): Child {
    const { tag, children, ...rest } = props
    return h('panel', { size: ['100%', '100%'], ...rest, visible: form.text.contains(tag) }, children)
}

export interface FormButtonProps extends LayoutProps {
    /** 第几个表单按钮（ActionFormData.button 的顺序，从 0 起） */
    index: number
    /**
     * 按钮文字的标记。门控是「按钮文字**包含** tag」（JSON UI 没有「以……开头」）：
     * tag 不能是其它按钮文字的子串——`l1|` 不会误中 `l10|`，但 `prev|` 会误中 `no_prev|`。不显示的按钮发空文字即可。
     */
    tag: string
    /** 像素尺寸（编译成正方形网格需要边长） */
    size: [number, number]
    default?: Child
    hover?: Child
    pressed?: Child
    /** 仅预览：点击回调 */
    onPress?: () => void
}

export function FormButton(props: FormButtonProps): Child {
    const { index, tag, size, default: dflt, hover, pressed, children, onPress, name, anchor, anchorFrom, anchorTo, offset, layer, gridPos } = props
    return h('collection_item', { name, collection: 'form_buttons', index, size, anchor, anchorFrom, anchorTo, offset, layer, gridPos },
        h('button', { name: 'button', size: size as [Size, Size], anchor: 'center', visible: form.buttonText.contains(tag), default: dflt, hover, pressed, onPress }, children))
}

/** FormButton 里：按钮文字去掉 tag 之后的运行期数据 */
export const buttonPayload = (tag: string) => form.buttonText.minus(tag)
