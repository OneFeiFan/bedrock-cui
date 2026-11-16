# 数据（props）

props 是界面显示的数据。它们在界面文件的 `props` 中定义，在视图中显示，值由逻辑或行为包脚本在打开界面时提供。本节介绍定义与使用 props 的方法。

## 定义

`props` 列出界面需要的数据，每一项的值是默认值。默认值的类型决定这项数据的种类：

```js
props: {
    greeting: '欢迎光临',                                    // 文字
    count: 3,                                               // 数字（按文字传递）
    item: { text: '钻石', icon: 'textures/items/diamond' },  // 文字与图标
    vip: false,                                             // 是否显示
    goods: ['苹果', '面包', '牛奶'],                          // 列表，最多 3 项
}
```

默认值有两个用途：浏览器预览直接用它显示界面；游戏中没有提供值时也使用它。

## 在视图中使用

视图中，`props.名字` 用在控件上，控件按用途取值：

| 用法 | 取值 |
|---|---|
| `new Label(props.greeting)` | 文字 |
| `new Image(props.item)` | 图标 |
| `控件.setVisible(props.vip)` | 有值时显示 |

同一个 prop 可以用在多个控件上。下面用 `props.item` 同时显示物品的图标和名称，`props.vip` 决定是否显示「会员」：

```js preview=card 220x60
import { Anchor, Color, Image, Label, Panel, Size, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

const card = defineScreen({
    id: 'cui_ui:card',
    props: {
        item: { text: '钻石', icon: 'textures/items/diamond' },
        vip: true,
    },
    view({ props }) {
        return new Panel().setSize(200, 40).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Image(props.item).setSize(16, 16).setAnchor(Anchor.CENTER_LEFT).setOffset(10, 0),
            new Label(props.item).setColor(INK).setSize(100, 10).setAnchor(Anchor.CENTER_LEFT).setOffset(32, 0),
            new Label('§6会员').setSize(30, 10).setAnchor(Anchor.CENTER_RIGHT).setOffset(-10, 0).setVisible(props.vip),
        )
    },
})
```

「有值」的含义：值为 `false`、`null` 或 `undefined` 时视为没有值，其他值（包括空字符串）都视为有值。

### 列表

默认值是数组的 prop 是列表，数组的长度就是最多显示的项数。视图中用 `props.名字[序号]` 读取第几项（从 0 开始），每一项可以是文字，也可以是文字与图标。提供的项数少于最多项数时，多出的位置没有值：

```js preview=list 200x80
import { Anchor, Color, Image, Label, Panel, Size, defineScreen } from 'bedrock-cui'

const list = defineScreen({
    id: 'cui_ui:list',
    props: { goods: ['苹果', '面包', '牛奶'] },
    view({ props }) {
        const box = new Panel().setSize(180, 60)
        box.add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()))
        props.goods.forEach((g, i) => box.add(
            new Label(g).setColor(Color.hex('#3c2814')).setSize(160, 10).setAnchor(Anchor.TOP_LEFT).setOffset(10, 8 + i * 16),
        ))
        return box
    },
})
```

### 条件

`props.名字.contains(文字)` 表示 prop 的文字中包含某段文字，可以作为显示条件。例如 `props.rank.contains('VIP')`。更多运算见[表达式](bindings.md)。

## 值从哪里来

游戏中，一个 prop 的值按以下顺序取第一个有的：

1. 逻辑中 `computed` 的同名项（见[逻辑](logic.md#由状态计算-props)）；
2. 脚本调用 `界面.open(玩家, { … })` 时传入的值；
3. 默认值。

```js
// 行为包脚本：传入 greeting，其余取默认值
shop.open(player, { greeting: `你好，${player.name}` })
```

## 限制

- **显示 prop 的控件需要像素尺寸**（例如 `setSize(120, 10)`）。prop 经由服务端表单的按钮传递，读取按钮数据的方式要求像素尺寸。缺少时静态检查报错。
- **一个控件只能使用一个 prop**。需要两个时（例如文字用 `props.a`，显示条件用 `props.b`），把控件拆成嵌套的两层，各用一个。
- **使用未定义的 prop 时，构建报错**，例如把 `props.greeting` 写成 `props.greting`。
- **运算只有整数**。`props.名字.number` 把文字转为数字，但除法与小数都得到整数（真机）。
