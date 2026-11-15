# CollectionItem

`CollectionItem` 读取集合中的一项，例如服务端表单的第几个按钮。在它的内部，`form.buttonText` 即该按钮的文字。

```js preview=card 200x50 form=data
import { CollectionItem, Color, Image, Label, Panel, Size, form } from 'bedrock-cui'

const data = { buttons: ['', 'item|钻石 ×3'] }

const card = new Panel().setSize(180, 30).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new CollectionItem('form_buttons', 1).setSize(160, 10).add(new Label(form.buttonText.minus('item|')).setColor(Color.hex('#3c2814'))),
)
```

`CollectionItem` 需要像素尺寸。按钮序号超出脚本实际发送的按钮数时，读取不到数据，保持空白。示例见[表达式与绑定](../bindings.md#读取表单按钮的文字)。

## API

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
