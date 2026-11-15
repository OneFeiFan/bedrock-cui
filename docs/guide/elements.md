# 控件与组件树

## 控件

界面由控件组成。每种控件对应一个类，构造函数只接收必需的参数，其余属性通过方法设置：

```js
import { Image, Label, Panel, Stack } from 'bedrock-cui'

const panel = new Panel()                                 // 容器，没有外观
const title = new Label('物品图鉴')                        // 文字
const icon = new Image('textures/items/diamond')          // 图片
const list = new Stack('vertical')                        // 按顺序排列子控件
```

常用的控件如下：

| 类 | 用途 |
|---|---|
| `Panel` | 容器。子控件按各自的锚点与偏移定位。 |
| `Image` | 图片，支持九宫格。 |
| `Label` | 一段文字，由游戏折行。 |
| `Paragraph` | 一段较长的文字，按给定宽度折行（见[文字](text.md)）。 |
| `Stack` | 子控件沿一个方向依次排列。 |
| `Row`、`Column` | 弹性布局：间距、对齐、伸展（见[尺寸与位置](layout.md)）。 |
| `Grid` | 网格。 |
| `Scroll` | 内容超出时可滚动的区域。 |
| `Button`、`Toggle` | 按钮与开关。 |

## 组件树

`add()` 将控件加入容器，参数可以是多个控件：

```js
import { Image, Label, Panel, Size } from 'bedrock-cui'

const card = new Panel().setSize(120, 40)
card.add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label('钻石'),
)
```

一个控件只能有一个父控件。将已加入某个容器的控件再加入另一个容器时，会抛出错误。同样的内容需要出现在两处时，使用 `clone()` 复制：

```js
const label = new Label('钻石')
a.add(label)
b.add(label.clone())
```

`remove()` 将子控件从容器中移除；`find()` 按名称查找子孙控件。

## 属性

每个属性都可以通过三种方式设置，效果相同：

```js
import { Color, Label } from 'bedrock-cui'

const label = new Label('钻石')

label.color = Color.WHITE                              // 直接赋值
label.setColor(Color.WHITE).setLayer(2)                // 链式调用
label.set({ color: Color.WHITE, layer: 2 })            // 一次设置多项
```

`setXxx()` 返回控件本身，适合在创建控件时连续设置。`set()` 接受的值会转换为对应的类型，例如 `size: [100, 20]` 与 `size: Size.of(100, 20)` 等价。

## 名称

控件的名称出现在生成的 JSON UI 中，也出现在静态检查的输出路径中。未设置名称时，控件按类型和在父控件中的顺序自动命名，例如 `panel0`、`label1`。

```js
new Label('钻石').setName('title')
```

同一个父控件中的子控件不应重名，否则静态检查报告 `duplicate-name`。

## 自定义组件

可复用的界面部件通过继承内置类编写，在构造函数中创建子控件：

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

组件本身也是控件，可以继续调用 `setAnchor()` 等方法，也可以作为父类派生新的组件。
