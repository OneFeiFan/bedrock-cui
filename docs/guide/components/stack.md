# Stack

`Stack` 将子控件沿一个方向依次排列：`'vertical'`（默认）或 `'horizontal'`。需要间距、对齐与伸展时，使用 [`Row` 与 `Column`](row-column.md)。

```js preview=card 220x60
import { Color, Image, Label, Panel, Size, Stack } from 'bedrock-cui'

const card = new Panel().setSize(200, 40).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Stack('horizontal').setSize(180, 10).add(
        new Label('第一项').setColor(Color.hex('#3c2814')),
        new Label(' · 第二项').setColor(Color.hex('#3c2814')),
        new Label(' · 第三项').setColor(Color.hex('#3c2814')),
    ),
)
```

## API

<!-- api: Stack -->
**创建**

- `new Stack(orientation?: 'vertical' | 'horizontal')`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `orientation` | `setOrientation()` | `"vertical" \| "horizontal" \| undefined` | 排列方向（缺省 vertical） |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
