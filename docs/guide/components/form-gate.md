# FormGate

`FormGate(标记)` 是一个容器：表单正文包含该标记时，显示其中的内容。

```js preview=card 200x50 form=data
import { Color, FormGate, Image, Label, Panel, Size } from 'bedrock-cui'

const data = { text: 'vip' }

const card = new Panel().setSize(180, 30).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new FormGate('vip').setSize(Size.full()).add(new Label('§6尊贵的会员')),
)
```

示例见[表达式与绑定](../bindings.md#按正文切换内容)。

## API

<!-- api: FormGate -->
**创建**

- `new FormGate(tag: string)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `tag` | `setTag()` | `string` | 表单正文包含这个标记时显示 |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
