# 数据（props）

props 是行为包脚本传给界面的数据，例如玩家的名字、物品的数量。它们在界面文件的 `props` 中声明，在页面中显示；脚本打开界面时传入实际的值，没有传入的显示默认值。本节介绍声明与使用数据的方法。

## 声明

`props` 中的每一项写明类型与默认值，写法与 Vue 的 props 相同：

```js
import { Item, Timer } from 'bedrock-cui'

const props = {
    greeting: { type: String, default: '欢迎光临' },                             // 文字
    count:    { type: Number, default: 0 },                                     // 数字（按文字显示）
    item:     { type: Item, default: { text: '钻石', icon: 'textures/items/diamond' } },   // 文字与图标
    vip:      { type: Boolean },                                                // 是否显示，默认 false
    goods:    { type: Array, of: Item, max: 3 },                                // 列表，最多 3 项，默认为空
    cooldown: { type: Timer, default: Timer.idle(10) },                         // 计时器（见「计时显示」）
}
```

| `type` | 数据 | 省略 `default` 时 |
|---|---|---|
| `String`、`Number` | 文字 | `''`、`0` |
| `Item` | 文字与图标：`{ text, icon }` | `{ text: '' }` |
| `Boolean` | 是否显示 | `false` |
| `Array` | 列表。`of` 为每一项的类型（`String` 或 `Item`，缺省为 `String`），`max` 为最多的项数（必须写） | `[]` |
| `Timer` | [计时器](timers.md) | 必须写 |

默认值有两个用途：浏览器预览直接用它显示界面；游戏中脚本没有传入这一项时也使用它。

## 在页面中使用

页面函数从参数中解构需要的数据，用在控件上，控件按用途取值：

| 用法 | 取值 |
|---|---|
| `new Label(greeting)` | 文字 |
| `new Image(item)` | 图标 |
| `控件.setVisible(vip)` | 有值时显示 |

同一项数据可以用在多个控件上。下面用 `item` 同时显示物品的图标和名称，`vip` 决定是否显示「会员」：

```js preview=card 220x60
import { Anchor, Color, defineUI, Image, Item, Label, Page, Size } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

const card = defineUI({
    id: 'cui_ui:card',
    props: {
        item: { type: Item, default: { text: '钻石', icon: 'textures/items/diamond' } },
        vip: { type: Boolean, default: true },
    },
    page({ item, vip }) {
        return new Page().setSize(200, 40).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Image(item).setSize(16, 16).setAnchor(Anchor.CENTER_LEFT).setOffset(10, 0),
            new Label(item).setColor(INK).setSize(100, 10).setAnchor(Anchor.CENTER_LEFT).setOffset(32, 0),
            new Label('§6会员').setSize(30, 10).setAnchor(Anchor.CENTER_RIGHT).setOffset(-10, 0).setVisible(vip),
        )
    },
})
```

「有值」的含义：值为 `false`、`null`、`undefined` 或空字符串时视为没有值，其他值都视为有值。

### 列表

页面中用 `列表[序号]` 读取第几项（从 0 开始），列表的长度为 `max`。脚本传入的项数少于 `max` 时，多出的位置没有值：

```js preview=list 200x80
import { Anchor, Color, defineUI, Image, Label, Page, Size } from 'bedrock-cui'

const list = defineUI({
    id: 'cui_ui:list',
    props: { goods: { type: Array, max: 3, default: ['苹果', '面包', '牛奶'] } },
    page({ goods }) {
        const box = new Page().setSize(180, 60)
        box.add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()))
        goods.forEach((g, i) => box.add(
            new Label(g).setColor(Color.hex('#3c2814')).setSize(160, 10).setAnchor(Anchor.TOP_LEFT).setOffset(10, 8 + i * 16),
        ))
        return box
    },
})
```

### 条件

`数据.contains(文字)` 表示数据的文字中包含某段文字，可以作为显示条件，例如 `rank.contains('VIP')`。更多运算见[表达式](bindings.md)。

## 值从哪里来

游戏中，一项 props 的值是行为包脚本调用 `界面.open(玩家, { … })` 时传入的值；没有传入时取默认值：

```js
// 行为包脚本：传入 greeting，其余取默认值
shop.open(player, { greeting: `你好，${player.name}` })
```

逻辑中用 `this.名字` 读取 props 的当前值。

## 页面也可以显示 state 与 computed

页面函数的参数中还有 state 与 computed 中的值，用法与 props 相同，例如[界面文件](screens.md)中的 `coinText`。它们的类型由初始值决定：`state()` 返回的初始值，以及 computed 用初始状态计算出的值。列表的长度是初始值的长度。

## 限制

- **显示数据的控件需要像素尺寸**（例如 `setSize(120, 10)`）。数据经由服务端表单的按钮传递，读取按钮数据的方式要求像素尺寸。缺少时静态检查报错。
- **一个控件只能使用一项数据**。需要两项时（例如文字用 `a`，显示条件用 `b`），把控件拆成嵌套的两层，各用一项。
- **页面中使用了没有定义的名字时，构建报错**，例如把 `greeting` 写成 `greting`。
- **运算只有整数**。`数据.number` 把文字转为数字（见[表达式](bindings.md)），但除法与小数都得到整数（真机）。
