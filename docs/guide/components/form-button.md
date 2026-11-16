# FormButton

`FormButton(序号, 标记, 宽, 高)` 对应服务端表单的第几个按钮。按钮的文字包含该标记时显示；点击后表单关闭，脚本得知按钮的序号。外观由 `default`、`hover`、`pressed` 三个状态面板组成。

```js preview=card 160x60 form=data
import { Color, FormButton, Image, Label, Panel, Size } from 'bedrock-cui'

// 脚本：.button('buy|')
const data = { buttons: ['buy|'] }

const buy = new FormButton(0, 'buy|', 80, 20)
buy.default.add(new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()), new Label('购买'))
buy.hover.add(new Image('textures/ui/white').setKeepRatio(false).setColor(Color.hex('#6040a0')).setSize(Size.full()), new Label('§e购买'))
const card = new Panel().setSize(120, 40).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), buy)
```

```js
// 行为包脚本
new ActionFormData().title('cui_ui:shop').body('').button('buy|').show(player).then((r) => {
    if (r.selection === 0) player.sendMessage('购买成功')
})
```

标记按「包含」判断，不应是另一个按钮文字的一部分。详见[服务端表单](../server-form.md#表单按钮)。

## API

<!-- api: FormButton -->
**创建**

- `new FormButton(index: number, tag: string, width: number, height: number)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `button` | 只读 | `Button` |  |
| `default` | — | `Panel` |  |
| `hover` | — | `Panel` |  |
| `pressed` | — | `Panel` |  |
| `size` | — | `Size \| undefined` | 尺寸（像素） |
| `tag` | `setTag()` | `string` | 按钮文字的标记（文字含它时显示） |
| `focusPrecedence` | `setFocusPrecedence()` | `number \| undefined` | 默认聚焦优先级（服务端重开表单、鼠标没动时，点击交给默认聚焦的控件） |
| `collection` | `setCollection()` | `string` | 集合名（例如 form_buttons） |
| `index` | `setIndex()` | `number` | 集合里的第几项 |

**方法**

| 方法 | 说明 |
|---|---|
| `add(...items: Parameters<CollectionItem['add']>)` | 子元素加到按钮里（始终显示） |
| `payload()` | 按钮文字去掉 tag 之后的运行期数据 |
| `setOnPress(fn: () => void)` | 仅预览：点击回调 |
| `onPress(fn: () => void)` | 同 setOnPress |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
