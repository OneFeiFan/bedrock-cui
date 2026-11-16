# form.button()

`form.button(n)` 表示当前服务端表单的第 n 个按钮（从 0 开始，对应行为包脚本中第 n 个 `ActionFormData.button()`）。它返回一个容器，在容器内部用 `form.buttonText` 读取这个按钮的文字、用 `form.buttonTexture` 读取它的图标。按钮的用途见[工作原理](../how-it-works.md#按钮在-bedrock-cui-中的用途)。

```js preview=card 200x50 form=data
import { Color, Image, Label, Panel, Size, form } from 'bedrock-cui'

// 模拟脚本中的 .button('').button('item|钻石 ×3')
const data = { buttons: ['', 'item|钻石 ×3'] }

const card = new Panel().setSize(180, 30).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    form.button(1).setSize(160, 10).add(new Label(form.buttonText.minus('item|')).setColor(Color.hex('#3c2814'))),
)
```

- 返回的容器需要设置像素尺寸（`setSize(宽, 高)`）。
- 序号超出脚本实际添加的按钮数时，容器读取不到数据，内容保持空白。
- 容器本身不可点击；需要点击时使用 [`FormButton`](form-button.md)。

更多示例见[表达式与绑定](../bindings.md#读取表单按钮的文字)。

## API

`form.button(n)` 返回一个 `CollectionItem`：

<!-- api: CollectionItem -->
**创建**

- `new CollectionItem(collection: string, index: number)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `collection` | `setCollection()` | `string` | 集合名（例如 form_buttons） |
| `index` | `setIndex()` | `number` | 集合里的第几项 |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
