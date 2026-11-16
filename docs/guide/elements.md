# 控件与组件树

界面由控件组成：文字、图片、容器等。容器中放入其他控件，控件之间形成一棵树，称为组件树。本节介绍创建控件、设置属性、组成组件树，以及按名称查找、移除和复制控件。

## 控件

每种控件对应一个类。用 `new` 创建控件时，构造函数只接收必需的参数，例如文字的内容、图片的路径：

```js
import { Image, Label, Panel, Stack } from 'bedrock-cui'

const panel = new Panel()                                 // 容器，本身没有外观
const title = new Label('物品图鉴')                        // 文字
const icon = new Image('textures/items/diamond')          // 图片
const list = new Stack('vertical')                        // 让子控件纵向依次排列
```

常用的控件如下：

| 类 | 用途 |
|---|---|
| `Panel` | 容器。子控件按各自的锚点与偏移定位（见[尺寸与位置](layout.md)）。 |
| `Image` | 图片，支持九宫格（见[图片与贴图](images.md)）。 |
| `Label` | 一段文字，由游戏折行。 |
| `Paragraph` | 一段较长的文字，按给定宽度折行（见[文字](text.md)）。 |
| `Stack` | 子控件沿一个方向依次排列。 |
| `Row`、`Column` | 弹性布局：间距、对齐、伸展。 |
| `Grid` | 网格。 |
| `Scroll` | 内容超出时可滚动的区域。 |
| `Button`、`Toggle` | 按钮与开关。 |

## 设置属性

控件的其余属性（颜色、尺寸、位置等）在创建之后设置。最常用的写法是 `控件.setXxx(值)`：它设置一项属性，并返回控件本身，所以可以连续调用：

```js
import { Color, Label } from 'bedrock-cui'

const label = new Label('钻石').setColor(Color.WHITE).setLayer(2)
```

同一项属性还有两种写法，效果相同：

```js
import { Color, Label } from 'bedrock-cui'

const label = new Label('钻石')
label.color = Color.WHITE                              // 直接赋值
label.set({ color: Color.WHITE, layer: 2 })            // 一次设置多项
```

`控件.set({ 属性名: 值, … })` 中，值会转换为对应的类型，例如 `size: [100, 20]` 与 `size: Size.of(100, 20)` 等价。

## 组成组件树

`容器.add(控件…)` 把一个或多个控件加入容器，成为它的子控件；参数也可以是一段文字，相当于 `new Label(文字)`。`add()` 返回容器本身：

```js
import { Image, Label, Panel, Size } from 'bedrock-cui'

const card = new Panel().setSize(120, 40).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label('钻石'),
)
```

一个控件只能有一个父控件。把已经在某个容器中的控件加入另一个容器时，会抛出错误；同样的内容要出现在两处时，用下文的 `clone()` 复制一份。

## 名称

每个控件都有名称。`控件.setName(名称)` 设置名称：

```js
import { Label } from 'bedrock-cui'

const title = new Label('钻石').setName('title')
```

未设置名称的控件，按类型和在父控件中的顺序自动命名，例如 `panel0`、`label1`。名称有三个用途：

- 静态检查的输出用名称组成的路径指出控件的位置，例如 `root/panel0/card/intro`；
- 下文的 `find()` 按名称查找控件；
- 生成的界面文件（JSON UI）中，控件以名称为键。

同一个容器中的子控件不能重名，否则静态检查报错（`duplicate-name`）。不同容器中的子控件可以同名。

## 查找、移除与复制

`容器.find(名称)` 在容器的所有子孙控件中查找第一个名称相同的控件，找不到时返回 `undefined`：

```js
import { Label, Panel } from 'bedrock-cui'

const card = new Panel().add(
    new Panel().setName('header').add(new Label('钻石').setName('title')),
)
const title = card.find('title')              // 在子控件的子控件中也能找到
```

`容器.remove(控件)` 把一个**直接**子控件从容器中移除，参数是控件本身（不是名称）。移除后，这个控件可以加入别的容器。要移除更深一层的控件，在它的父控件上调用 `remove()`：控件的 `parent` 属性就是它的父控件。

```js
import { Label, Panel } from 'bedrock-cui'

const card = new Panel().add(
    new Panel().setName('header').add(new Label('钻石').setName('title')),
)
const title = card.find('title')
title.parent.remove(title)                    // 从 header 中移除；card.remove(title) 不会生效
```

`控件.clone()` 复制控件及其全部子控件，返回的副本没有父控件，可以加入任何容器。副本的名称与原控件相同，所以把它加入同一个容器时，需要另设名称：

```js
import { Label, Panel } from 'bedrock-cui'

const first = new Label('钻石').setName('first')
const row = new Panel().add(first, first.clone().setName('second'))
```

## 自定义组件

可以复用的界面部件，通过继承内置的控件类编写：在构造函数中创建子控件并加入自己：

```js
import { Anchor, Color, Image, Label, Length, Panel, Size } from 'bedrock-cui'

/** 带背景的标题栏 */
class TitleBar extends Panel {
    constructor(text) {
        super()
        this.setSize(Size.of(Length.pct(100), 16))
        this.add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label(text).setColor(Color.WHITE).setAnchor(Anchor.CENTER),
        )
    }
}

const bar = new TitleBar('物品图鉴').setAnchor(Anchor.TOP_LEFT)
```

自定义组件本身也是控件：可以继续调用 `setAnchor()` 等方法，也可以作为父类，派生新的组件。
