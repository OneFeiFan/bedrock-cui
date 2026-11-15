# Row 与 Column

`Row` 横向、`Column` 纵向排列子控件，支持间距（`setGap()`）、主轴方向的分布（`setJustify()`）、交叉轴方向的对齐（`setAlign()`），子控件可以调用 `setGrow()` 占用剩余空间。

```js preview=card 220x80
import { Align, Color, Column, Image, Justify, Label, Panel, Row, Size } from 'bedrock-cui'

const row = (name, count) => new Row().setSize(180, 10).setJustify(Justify.SPACE_BETWEEN).add(
    new Label(name).setColor(Color.hex('#3c2814')),
    new Label(count).setColor(Color.hex('#3c2814')),
)
const card = new Panel().setSize(200, 60).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Column().setGap(4).setAlign(Align.CENTER).add(row('钻石', '× 3'), row('绿宝石', '× 12'), row('金锭', '× 5')),
)
```

各取值的含义见[尺寸与位置](../layout.md#弹性布局)。

## API

<!-- api: Row -->
**创建**

- `new Row()`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `gap` | `setGap()` | `number` | 子控件之间的间距（像素） |
| `justify` | `setJustify()` | `Justify` | 主轴方向的分布方式 |
| `align` | `setAlign()` | `Align` | 交叉轴方向的对齐方式 |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->

<!-- api: Column -->
**创建**

- `new Column()`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `gap` | `setGap()` | `number` | 子控件之间的间距（像素） |
| `justify` | `setJustify()` | `Justify` | 主轴方向的分布方式 |
| `align` | `setAlign()` | `Align` | 交叉轴方向的对齐方式 |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
