# 尺寸与位置

## 尺寸

`setSize()` 接受宽和高两个值。数字表示界面像素，其余情况使用 `Length`：

```js
import { Length, Panel, Size } from 'bedrock-cui'

new Panel().setSize(200, 100)                                // 200 × 100 像素
new Panel().setSize(Length.pct(50), 20)                      // 宽为父控件的 50%，高 20 像素
new Panel().setSize(Length.pct(100).minus(6), Length.auto()) // 宽为父控件减 6 像素，高由内容决定
new Panel().setSize(Size.full())                             // 与父控件同样大小
```

| 写法 | 含义 |
|---|---|
| `Length.pct(n)` | 父控件对应尺寸的 n%。 |
| `Length.children()` | 子控件尺寸之和。 |
| `Length.largestChild()` | 最大的子控件的尺寸。 |
| `Length.auto()` | 由内容决定，用于文字。 |
| `Length.fill()` | 占满剩余空间，只在 `Stack`、`Row`、`Column` 中有效。 |

`plus()`、`minus()` 在以上任意一种的基础上加减像素，例如 `Length.children().plus(8)` 表示子控件之和再加 8 像素。

`Size` 提供几种常用组合：`Size.of(宽, 高)`、`Size.full()`、`Size.square(n)`、`Size.fitContent(内边距)`。

## 锚点与偏移

控件的位置由锚点和偏移决定。锚点指定父控件上的一个点，控件将自身的同一个点对齐到这里，再按偏移移动：

```js
import { Anchor, Label } from 'bedrock-cui'

// 自身的右下角对齐父控件的右下角，再向左、向上各移 4 像素
new Label('第 1 页').setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-4, -4)
```

锚点共九个：`TOP_LEFT`、`TOP_CENTER`、`TOP_RIGHT`、`CENTER_LEFT`、`CENTER`、`CENTER_RIGHT`、`BOTTOM_LEFT`、`BOTTOM_CENTER`、`BOTTOM_RIGHT`。未设置时为 `CENTER`。

父控件上的点与自身的点不同时，使用 `setPlacement(父控件上的点, 自身的点)`。下面的提示框位于父控件右侧外部，顶边对齐：

```js
import { Anchor, Image } from 'bedrock-cui'

new Image('textures/ui/purpleBorder').setSize(80, 30).setPlacement(Anchor.TOP_RIGHT, Anchor.TOP_LEFT)
```

## 弹性布局

`Row` 横向排列子控件，`Column` 纵向排列。`setGap()` 设置间距，`setJustify()` 设置主轴方向的分布，`setAlign()` 设置交叉轴方向的对齐：

```js
import { Align, Column, Justify, Label, Row } from 'bedrock-cui'

const row = new Row().setGap(4).setJustify(Justify.SPACE_BETWEEN).setAlign(Align.CENTER)
row.add(new Label('钻石'), new Label('× 3'))

const column = new Column().setGap(2)
column.add(new Label('第一行'), new Label('第二行'))
```

| `Justify` | 主轴方向 |
|---|---|
| `START` | 从起点依次排列（默认）。 |
| `CENTER` | 居中。 |
| `END` | 靠终点排列。 |
| `SPACE_BETWEEN` | 首尾贴边，剩余空间均分到子控件之间。 |

| `Align` | 交叉轴方向 |
|---|---|
| `STRETCH` | 拉伸到容器的尺寸（默认）。 |
| `START`、`CENTER`、`END` | 按自身尺寸对齐。 |

子控件调用 `setGrow()` 后，占用主轴方向的剩余空间。存在伸展的子控件时，`setJustify()` 不再起作用。

`Row` 与 `Column` 编译为 JSON UI 的 `stack_panel`，每个子控件放在一个占位面板中，间距、伸展和对齐都由占位面板实现。

## 内边距与边界

`setPadding()` 为容器设置内边距，子控件按内边距之内的区域定位：

```js
import { Insets, Panel } from 'bedrock-cui'

new Panel().setSize(116, 160).setPadding(Insets.of(3, 0, 3, 9))   // 左、上、右、下
```

`setContain()` 声明子控件不得越出该容器（含内边距）。静态检查据此报告 `out-of-bounds`，并给出越出的方向和像素数。提示框、弹出层这类本来就在容器之外的控件，调用 `setOverflow()` 排除在检查之外。

## 适应屏幕尺寸

使用百分比尺寸的界面随屏幕尺寸变化。为避免在过小或过大的屏幕上变形，可以设置尺寸的上下限：

```js
import { Length, Panel } from 'bedrock-cui'

new Panel().setSize(Length.pct(90), Length.pct(80)).setMinSize(200, 120).setMaxSize(560, 320)
```

内容长度不固定、在小屏幕上可能放不下时，放入 `Scroll`。静态检查会在多种屏幕尺寸下排版，报告弹性布局中放不下的内容（`flex-overflow`）。
