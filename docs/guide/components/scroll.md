# Scroll

`Scroll` 是可以滚动的区域。子控件纵向排列，超出区域的部分通过滚动查看。滚动条位于区域内侧右边，宽 8 像素。用法见[滚动](../scroll.md)。

```js preview=card 200x100
import { Anchor, Color, Image, Label, Panel, Scroll, Size } from 'bedrock-cui'

const list = new Scroll().setSize(160, 70).setGap(2).setAnchor(Anchor.TOP_LEFT).setOffset(8, 6)
for (let i = 1; i <= 12; i++) list.add(new Label(`第 ${i} 条`).setColor(Color.hex('#3c2814')))
const card = new Panel().setSize(180, 82).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), list)
```

`Scroll` 读取不到外层集合项的数据，见[滚动](../scroll.md)。

## API

<!-- api: Scroll -->
**创建**

- `new Scroll()`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `gap` | `setGap()` | `number` | 子控件之间的间距（像素） |
| `justify` | `setJustify()` | `Justify` | 主轴方向的分布方式 |
| `align` | `setAlign()` | `Align` | 交叉轴方向的对齐方式 |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
