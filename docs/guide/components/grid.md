# Grid

`Grid` 是一个网格，由列数与行数创建。子控件用 `setGridPos(列, 行)` 指定所在的格子，格子的大小为网格尺寸均分。其他布局方式见[尺寸与位置](../layout.md)。

```js preview=card 160x80
import { Grid, Image, Panel, Size } from 'bedrock-cui'

const grid = new Grid(3, 2).setSize(108, 48)
for (let i = 0; i < 6; i++) {
    grid.add(new Image('textures/items/diamond').setSize(16, 16).setGridPos(i % 3, Math.floor(i / 3)))
}
const card = new Panel().setSize(130, 60).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), grid)
```

## API

<!-- api: Grid -->
**创建**

- `new Grid(columns: number, rows: number)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `dims` | `setDims()` | `[number, number]` | [列, 行] |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
