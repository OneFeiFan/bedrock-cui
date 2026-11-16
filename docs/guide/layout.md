# 尺寸与位置

每个控件都有尺寸和位置。本节介绍设置尺寸的写法、用锚点与偏移确定位置、弹性布局（`Row`、`Column`），以及内边距与边界。

## 尺寸

`控件.setSize(宽, 高)` 设置尺寸。数字表示界面像素；其他情况用 `Length` 表示：

```js
import { Length, Panel, Size } from 'bedrock-cui'

new Panel().setSize(200, 100)                                // 200 × 100 像素
new Panel().setSize(Length.pct(50), 20)                      // 宽为父控件的 50%，高 20 像素
new Panel().setSize(Length.pct(100).minus(6), Length.auto()) // 宽为父控件的宽减 6 像素，高由内容决定
new Panel().setSize(Size.full())                             // 与父控件同样大小
```

| 写法 | 含义 |
|---|---|
| `Length.pct(n)` | 父控件对应尺寸的 n%。 |
| `Length.children()` | 子控件尺寸之和。 |
| `Length.largestChild()` | 最大的子控件的尺寸。 |
| `Length.auto()` | 由内容决定，用于文字。 |
| `Length.fill()` | 占满剩余空间，只在 `Stack`、`Row`、`Column` 中有效。 |

`长度.plus(n)`、`长度.minus(n)` 在以上任意一种的基础上加减像素，例如 `Length.children().plus(8)` 表示子控件之和再加 8 像素。常用的组合有 `Size.of(宽, 高)`、`Size.full()`、`Size.square(边长)`、`Size.fitContent(内边距)`。

## 锚点与偏移

控件的位置由**锚点**与**偏移**决定。锚点是一个方位，例如「右下角」；`控件.setAnchor(锚点)` 让控件自身的这个方位，对齐到父控件的同一个方位。`控件.setOffset(x, y)` 再从对齐的位置移动若干像素（向右、向下为正）：

```js preview=card 200x80
import { Anchor, Color, Image, Label, Panel, Size } from 'bedrock-cui'

const card = new Panel().setSize(180, 60).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    // 自身的右下角对齐父控件的右下角，再向左、向上各移 6 像素
    new Label('第 1 页').setColor(Color.hex('#3c2814')).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-6, -6),
)
```

锚点共九个：`TOP_LEFT`、`TOP_CENTER`、`TOP_RIGHT`、`CENTER_LEFT`、`CENTER`、`CENTER_RIGHT`、`BOTTOM_LEFT`、`BOTTOM_CENTER`、`BOTTOM_RIGHT`。未设置时为 `CENTER`。

有时控件要对齐的不是父控件上的同一个方位。例如提示框要放在父控件的**右侧外面**：提示框的左上角，对齐父控件的右上角。这时用 `控件.setPlacement(父控件上的方位, 自身的方位)` 分别指定两个方位：

```js preview=box 240x80
import { Anchor, Color, Image, Label, Panel, Size, Texture } from 'bedrock-cui'

const box = new Panel().setSize(80, 30).add(
    new Image(Texture.SOLID).setColor(Color.hex('#5b8c3a')).setSize(Size.full()),
    new Label('按钮').setAnchor(Anchor.CENTER),
    // 提示框：自身的左上角，对齐父控件的右上角
    new Panel().setSize(90, 30).setPlacement(Anchor.TOP_RIGHT, Anchor.TOP_LEFT).setOverflow().add(
        new Image('textures/ui/purpleBorder').setSize(Size.full()),
        new Label('§e提示框').setAnchor(Anchor.CENTER),
    ),
)
```

`setAnchor(A)` 相当于 `setPlacement(A, A)`。

## 弹性布局

`Row` 把子控件横向依次排列，`Column` 纵向依次排列。排列的方向称为**主轴**（`Row` 是横向，`Column` 是纵向），与它垂直的方向称为**交叉轴**。

```js preview=row 220x40
import { Align, Color, Image, Justify, Label, Panel, Row, Size } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const row = new Panel().setSize(200, 24).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Row().setSize(Size.full()).setGap(4).setJustify(Justify.SPACE_BETWEEN).setAlign(Align.CENTER).add(
        new Label('钻石').setColor(INK),
        new Label('× 3').setColor(INK),
    ),
)
```

容器上的三个方法：

- `容器.setGap(像素)`：子控件之间的间距；
- `容器.setJustify(分布)`：子控件在主轴方向的分布；
- `容器.setAlign(对齐)`：子控件在交叉轴方向的对齐。

| `Justify` | 主轴方向的分布 |
|---|---|
| `START` | 从起点依次排列（默认）。 |
| `CENTER` | 整体居中。 |
| `END` | 整体靠终点。 |
| `SPACE_BETWEEN` | 首尾贴边，剩余空间平均分到子控件之间。 |

| `Align` | `Row` 中 | `Column` 中 |
|---|---|---|
| `STRETCH`（默认） | 高度拉伸到容器的高度 | 宽度拉伸到容器的宽度 |
| `START` | 靠上 | 靠左 |
| `CENTER` | 上下居中 | 左右居中 |
| `END` | 靠下 | 靠右 |

`子控件.setGrow()` 让这个子控件伸展：主轴方向上，其他子控件排完之后剩余的空间都分给它；有多个子控件调用了 `setGrow()` 时，它们平分剩余空间。剩余空间被伸展的子控件占用之后，`setJustify()` 也就不再起作用。

```js preview=row 220x40
import { Color, Image, Label, Panel, Row, Size, Texture } from 'bedrock-cui'

const row = new Panel().setSize(200, 24).add(
    new Row().setSize(Size.full()).setGap(4).add(
        new Label('名称'),
        // 伸展：占满「名称」与「× 3」之间的空间
        new Image(Texture.SOLID).setColor(Color.hex('#5b8c3a')).setGrow(),
        new Label('× 3'),
    ),
)
```

## 内边距

`容器.setPadding(内边距)` 为容器设置内边距：子控件在扣除内边距之后的区域中定位。`Insets.of(左, 上, 右, 下)` 分别指定四边，`Insets.all(n)` 四边相同：

```js preview=card 200x80
import { Anchor, Color, Image, Insets, Label, Panel, Size } from 'bedrock-cui'

const card = new Panel().setSize(180, 60).setPadding(Insets.all(10)).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.of(180, 60)).setOverflow(),
    // 左上角对齐的是内边距之内的区域：距边缘 10 像素
    new Label('标题').setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_LEFT),
)
```

## 声明边界

`容器.setContain()` 声明这个容器的子孙控件不应越出它（扣除内边距之后的区域）。它不改变显示，只供静态检查使用：有控件越出时，静态检查报告 `out-of-bounds`，并给出越出的方向与像素数，例如：

```
警告 out-of-bounds root/panel0/card/intro：越出 root/panel0/card 的安全区（右 70 像素）
```

提示框、弹出层这类本来就放在容器外面的控件，调用 `控件.setOverflow()` 排除在这项检查之外（上文提示框的例子就是这样）。

## 适应屏幕尺寸

使用百分比尺寸的界面会随屏幕尺寸变化。`控件.setMinSize(宽, 高)` 与 `控件.setMaxSize(宽, 高)` 设置尺寸的下限与上限，避免在过小或过大的屏幕上变形：

```js
import { Length, Panel } from 'bedrock-cui'

new Panel().setSize(Length.pct(90), Length.pct(80)).setMinSize(200, 120).setMaxSize(560, 320)
```

屏幕变小时，长度不固定的内容（说明文字、列表）可能放不下。这种内容需要自己放进 `Scroll`（见[滚动](scroll.md)），屏幕放不下时就可以滚动。静态检查会在多种屏幕尺寸下排版，报告弹性布局中放不下的内容（`flex-overflow`）。
