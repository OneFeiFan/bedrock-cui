# 滚动

## Scroll

`Scroll` 是一个可以滚动的区域。子控件纵向排列，内容高度为子控件高度之和，超出区域的部分通过滚动查看：

```js
import { Label, Length, Paragraph, Scroll } from 'bedrock-cui'

const list = new Scroll().setSize(110, 80).setGap(2)
for (let i = 1; i <= 20; i++) list.add(new Label(`第 ${i} 条`))
```

`Scroll` 与 [`Column`](layout.md#弹性布局) 一样支持 `setGap()` 与 `setAlign()`。

`Scroll` 编译为原版的 `common.scrolling_panel`。滚动条位于区域内侧右边，宽 8 像素，内容的可用宽度为区域宽度减 8 像素。

## 适用场景

- 长度不固定的内容，例如运行期文字、数量随数据变化的列表；
- 使用百分比尺寸的界面中，在小屏幕上可能放不下的内容。

固定长度的长文本，也可以用 `paginate()` 分成多页，放进[页面](pages.md)的 `Router` 中显示。

::: warning
滚动区域中可以直接显示界面的数据（`props`）：bedrock-cui 在使用数据的控件处读取它。
:::
