# Close

`Close` 是关闭界面的按钮，外观的设置与 [`Button`](button.md) 相同。点击后界面关闭，逻辑的 `onClose()` 随之调用（见[逻辑](../logic.md#生命周期)）。

```js preview=panel 200x80
import { Anchor, Close, Color, Image, Label, Page, Size, Texture, defineUI } from 'bedrock-cui'

const panel = defineUI({
    id: 'cui_ui:panel',
    page: () => {
        const close = new Close().setSize(48, 16).setAnchor(Anchor.BOTTOM_CENTER).setOffset(0, -8)
        close.default.add(new Image(Texture.SOLID).setColor(Color.hex('#8b2a2a')).setSize(Size.full()), new Label('关闭'))
        close.hover.add(new Image(Texture.SOLID).setColor(Color.hex('#b03a3a')).setSize(Size.full()), new Label('§e关闭'))
        return new Page().setSize(160, 60).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), close)
    },
})
```

`Close` 需要像素尺寸。逻辑中关闭界面用 `this.close()`。

<!-- api: Close -->
**创建**

- `new Close()`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `default` | 只读 | `Panel` |  |
| `hover` | 只读 | `Panel` |  |
| `pressed` | 只读 | `Panel` |  |
| `pressedName` | `setPressedName()` | `string \| undefined` | 按下时发出的按钮事件（缺省 button.form_button_click） |
| `template` | `setTemplate()` | `string \| undefined` | 继承的原版模板（缺省 common.button） |
| `focusPrecedence` | `setFocusPrecedence()` | `number \| undefined` | 默认聚焦优先级（服务端重开表单、鼠标没动时，点击交给默认聚焦的控件） |

**方法**

| 方法 | 说明 |
|---|---|
| `slots()` | 状态面板（按钮 / 开关覆盖） |
| `onClick(method: { readonly __method: string }, ...args: unknown[])` | 点击时调用界面的方法：onClick(buy) 或带参数 onClick(buy, '钻石')（参数须可写成 JSON） |
| `setOnPress(fn: () => void)` | 仅预览：点击回调 |
| `onPress(fn: () => void)` | 同 setOnPress |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
