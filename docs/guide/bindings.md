# 表达式与绑定

服务端表单的标题、正文与按钮文字由脚本在运行时决定（见[附加包与服务端表单基础](addon-basics.md)）。界面通过表达式读取这些数据：表达式在编译时转换为 JSON UI 的绑定，由游戏在运行时求值。

以下示例的预览均模拟了一组表单数据，写在示例开头的 `data` 中。

## 显示表单的正文

`form.text` 是表单正文。将它作为 `Label` 的文字，界面即显示脚本传入的正文：

```js preview=card 220x80 form=data
import { Anchor, Color, Image, Label, Length, Panel, Size, form } from 'bedrock-cui'

// 脚本：new ActionFormData().title('cui_ui:card').body('今天的任务：收集 3 个钻石。')
const data = { title: 'cui_ui:card', text: '今天的任务：收集 3 个钻石。' }

const card = new Panel().setSize(200, 60).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label(form.text).setColor(Color.hex('#3c2814')).setSize(180, Length.auto()).setAnchor(Anchor.TOP_LEFT).setOffset(10, 8),
)
```

表单数据有三个来源：

| 表达式 | 内容 |
|---|---|
| `form.title` | 表单标题 |
| `form.text` | 表单正文 |
| `form.buttonText` | 某个表单按钮的文字（见下文「读取表单按钮的文字」） |
| `form.buttonTexture` | 某个表单按钮的图标路径（见下文「显示按钮的图标」） |

## 显示条件

表达式也可以作为显示条件。`setVisible()` 接受一个表达式，其值为真时显示控件：

```js preview=card 220x60 form=data
import { Anchor, Color, Image, Label, Panel, Size, form } from 'bedrock-cui'

// 正文中包含 #unlocked 标记，表示已解锁
const data = { text: '#unlocked' }

const card = new Panel().setSize(200, 40).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label('§2已解锁').setVisible(form.text.contains('#unlocked')),
    new Label('§4未解锁').setVisible(form.text.contains('#unlocked').not()),
)
```

正文中可以放置多个这样的标记，分别控制界面中不同部分的显示。

## 运算

表达式通过方法组合，每个方法返回一个新的表达式：

| 方法 | 含义 |
|---|---|
| `contains(x)` | 是否包含 x |
| `minus(x)` | 对字符串：去掉其中的 x；对数字：减法 |
| `plus(x)`、`times(x)`、`div(x)`、`mod(x)` | 拼接或算术运算 |
| `eq(x)`、`ne(x)`、`gt(x)`、`lt(x)`、`gte(x)`、`lte(x)` | 比较 |
| `and(x)`、`or(x)`、`not()` | 逻辑运算 |
| `isEmpty()` | 是否为空字符串 |

## 读取表单按钮的文字

正文只有一段，而表单按钮可以有很多个，适合传递成组的数据，例如一列物品。按钮的文字不一定显示为按钮：`CollectionItem('form_buttons', 序号)` 读取第几个按钮，在它的内部，`form.buttonText` 即该按钮的文字。

下面的界面用前三个按钮的文字显示一列物品。每个按钮的文字以 `item|` 开头，显示时用 `minus()` 去掉：

```js preview=list 220x80 form=data
import { Anchor, CollectionItem, Color, Column, Image, Label, Panel, Size, form } from 'bedrock-cui'

// 脚本：.button('item|钻石 ×3').button('item|绿宝石 ×12').button('item|金锭 ×5')
const data = { buttons: ['item|钻石 ×3', 'item|绿宝石 ×12', 'item|金锭 ×5'] }

const rows = new Column().setGap(2).setAnchor(Anchor.TOP_LEFT).setOffset(10, 8)
for (let i = 0; i < 3; i++) {
    rows.add(new CollectionItem('form_buttons', i).setSize(160, 10).add(
        new Label(form.buttonText.minus('item|')).setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_LEFT),
    ))
}
const list = new Panel().setSize(200, 50).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), rows)
```

`CollectionItem` 需要像素尺寸。按钮序号超出脚本实际发送的按钮数时，该项读取不到数据，保持空白。

`FormButton` 也是一种 `CollectionItem`：它除了读取按钮的文字，还能被点击，点击后表单关闭，脚本得知按钮的序号（见[服务端表单](server-form.md#表单按钮)）。

## 显示按钮的图标

`ActionFormData.button(文字, 图标路径)` 可以为按钮附带一个图标。在集合项内部，`form.buttonTexture` 即该按钮的图标路径，用作 `Image` 的贴图：

```js preview=list 220x60 form=data
import { Anchor, CollectionItem, Color, Column, Image, Label, Panel, Size, form } from 'bedrock-cui'

// 脚本：.button('ico|钻石', 'textures/items/diamond').button('ico|没有图标')
const data = { buttons: [{ text: 'ico|钻石', icon: 'textures/items/diamond' }, 'ico|没有图标'] }

const row = (i) => new CollectionItem('form_buttons', i).setSize(160, 16).add(
    new Image(form.buttonTexture).setSize(16, 16).setAnchor(Anchor.TOP_LEFT),
    new Label(form.buttonText.minus('ico|')).setColor(Color.hex('#3c2814')).setAnchor(Anchor.CENTER_LEFT).setOffset(20, 0),
)
const list = new Panel().setSize(200, 44).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Column().setGap(2).setAnchor(Anchor.TOP_LEFT).setOffset(8, 5).add(row(0), row(1)),
)
```

图标由脚本在运行时决定，游戏加载了的贴图都可以显示，包括其他附加包中的物品。按钮没有图标时，图片隐藏。编译结果与原版服务端表单的按钮图标相同。

## 按正文切换内容

`FormGate(标记)` 是一个容器：表单正文包含该标记时，显示其中的内容。它相当于 `new Panel().setVisible(form.text.contains(标记))`，用于由脚本决定显示界面中的哪一部分：

```js preview=card 220x60 form=data
import { Anchor, Color, FormGate, Image, Label, Panel, Size } from 'bedrock-cui'

// 脚本按玩家的进度传入 stage:2
const data = { text: 'stage:2' }
const INK = Color.hex('#3c2814')

const card = new Panel().setSize(200, 40).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new FormGate('stage:1').setSize(Size.full()).add(new Label('第一阶段：收集木头').setColor(INK)),
    new FormGate('stage:2').setSize(Size.full()).add(new Label('第二阶段：制作工具').setColor(INK)),
    new FormGate('stage:3').setSize(Size.full()).add(new Label('第三阶段：寻找钻石').setColor(INK)),
)
```

## 开关的状态

`toggleState(开关名)` 读取一个开关是否选中，用于显示条件。开关的用法见[开关与分页](pages.md)：

```js
import { Label, toggleState } from 'bedrock-cui'

new Label('§a已选中').setVisible(toggleState('show_details'))
```

开关按名称查找，范围是整个界面。传入 `{ siblingScope: true }` 时，只在兄弟控件中查找。

::: warning
以下行为由真机测试得出：

- 绑定读取不到数据时，目标属性保持默认值，不会报错。
- 一个表达式同时读取表单数据与开关状态时，开关变化后它不会重新计算。应将两者分别用于不同的控件（静态检查：`mixed-sources`）。
:::
