# 滚动

长度不固定、可能放不下的内容，放进可以滚动的区域中查看。本节介绍 `Scroll` 的用法与适用的场合。

## Scroll

`Scroll` 是一个可以滚动的区域。子控件纵向排列，内容高度为子控件高度之和，超出区域的部分通过滚动查看：

```js preview=box 150x110
import { Color, Image, Label, Panel, Scroll, Size } from 'bedrock-cui'

const list = new Scroll().setSize(110, 80).setGap(2)
for (let i = 1; i <= 20; i++) list.add(new Label(`第 ${i} 条`).setColor(Color.hex('#3c2814')))
const box = new Panel().setSize(130, 96).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), list)
```

`Scroll` 与 [`Column`](layout.md#弹性布局) 一样支持 `setGap()` 与 `setAlign()`。

滚动条位于区域内侧的右边，宽 8 像素，所以内容的可用宽度是区域宽度减 8 像素。

## 适用场景

- 长度不固定的内容，例如运行期文字、数量随数据变化的列表；
- 使用百分比尺寸的界面中，在小屏幕上可能放不下的内容。

固定长度的长文本，也可以用 `paginate()`（见[文字 · 运行期文字](text.md#运行期文字)）分成多页，放进[页面](pages.md)的 `Router` 中显示。
