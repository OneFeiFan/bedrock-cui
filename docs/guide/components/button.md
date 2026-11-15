# Button

`Button` 是界面内部的按钮，外观由 `default`、`hover`、`pressed` 三个状态面板组成，另可加入始终显示的子控件。点击后需要关闭表单、通知脚本时，使用 [`FormButton`](form-button.md)。

```js preview=card 160x60
import { Button, Color, Image, Label, Panel, Size } from 'bedrock-cui'

const button = new Button().setSize(80, 20)
button.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()))
button.hover.add(new Image('textures/ui/white').setKeepRatio(false).setColor(Color.hex('#6040a0')).setSize(Size.full()))
button.add(new Label('确定'))
const card = new Panel().setSize(120, 40).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), button)
```

## API

<!-- api: Button -->
**创建**

- `new Button()`

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
| `setOnPress(fn: () => void)` | 仅预览：点击回调 |
| `onPress(fn: () => void)` | 同 setOnPress |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
