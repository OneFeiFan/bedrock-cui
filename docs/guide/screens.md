# 界面文件

一个界面写在一个文件里，通常命名为 `ui/名字.screen.mjs`。文件用 `defineScreen({ … })` 定义界面，内容分为三部分：数据、逻辑、视图。本节介绍文件的整体结构；各部分的写法见[数据（props）](props.md)、[逻辑](logic.md)、[页面](pages.md)和「搭建界面」一章。

## 文件的结构

下面是一个商店界面：显示金币与一件物品，点击「购买」时金币减少。

```js preview=shop 240x140
// ui/shop.screen.mjs
import { Anchor, Color, Image, Item, Label, Panel, Size, Texture, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

const shop = defineScreen({
    id: 'cui_ui:shop',

    // ———— 数据：行为包脚本打开界面时传入的值，以及默认值 ————
    props: {
        item: { type: Item, default: { text: '钻石', icon: 'textures/items/diamond' } },
    },

    // ———— 逻辑：在游戏中运行 ————
    state() {
        return { coins: 10 }
    },
    computed: {
        coinText() { return `金币：${this.coins}` },
    },
    methods: {
        buy() { this.coins -= 1 },
    },

    // ———— 视图：从参数中解构需要的名字，返回控件树 ————
    view({ coinText, item, buy, button }) {
        const buyButton = button().onClick(buy).setSize(60, 18).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-10, -10)
        buyButton.default.add(new Image(Texture.SOLID).setColor(Color.hex('#5b8c3a')).setSize(Size.full()), new Label('购买'))
        buyButton.hover.add(new Image(Texture.SOLID).setColor(Color.hex('#7cb34f')).setSize(Size.full()), new Label('§e购买'))

        return new Panel().setSize(220, 120).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label(coinText).setColor(INK).setSize(180, 10).setAnchor(Anchor.TOP_LEFT).setOffset(12, 10),
            new Image(item).setSize(16, 16).setAnchor(Anchor.TOP_LEFT).setOffset(12, 34),
            new Label(item).setColor(INK).setSize(120, 10).setAnchor(Anchor.TOP_LEFT).setOffset(34, 38),
            buyButton,
        )
    },
})
export default shop
```

- `id`：界面 id，以 `cui_ui:` 开头（见[工作原理](how-it-works.md)）。
- `props`：行为包脚本传给界面的数据。每一项写明类型与默认值，见[数据（props）](props.md)。
- `state()`、`computed`、`methods`：逻辑。状态、由状态计算的值、点击时调用的方法，见[逻辑](logic.md)。
- `view()`：视图。参数是一个对象，包含 props、state、computed 中的值与 methods 中的方法，视图从中解构需要的名字。`button()` 创建一个按钮，`onClick(buy)` 指定点击时调用 `buy()`。

props、state、computed、methods 中的名字不能重复，也不能与视图的工具名（`button`、`close`、`link`、`back`、`next`、`prev`、`page`）相同，否则构建时报错。

## 视图相当于模板

视图与逻辑写在同一个文件中，但运行的时间与地点不同：

| | 视图（`view`） | 逻辑（`state`、`computed`、`methods`、生命周期） |
|---|---|---|
| 何时运行 | 构建时运行一次 | 游戏运行时 |
| 在哪里运行 | 构建工具（Node.js）中；结果编译为界面文件，由游戏客户端显示 | 行为包脚本中 |
| 能做什么 | 搭建控件树，指定数据显示在哪里、按钮调用哪个方法 | 修改状态、计算显示的值、调用游戏的脚本 API |

视图相当于 Vue 的模板：它描述界面的结构，以及数据显示的位置。视图中写的循环、条件、函数，只在构建时运行一次，用来生成结构；游戏运行时不执行视图中的代码。运行时由游戏客户端计算的，只有[表达式](bindings.md)（整数运算、比较、包含、与或非）。因此视图中拿到的 `coinText`、`item` 并不是值，而是「这项数据」的占位：它们可以显示在控件上、作为显示条件，但不能在视图中用 JavaScript 判断它们的内容。需要根据数据计算的，写在逻辑的 `computed` 中。

## 在逻辑中使用游戏的脚本 API

界面文件在构建时会被 Node.js 导入，所以文件开头不能导入游戏的脚本模块（`@minecraft/server`）。逻辑中用 `this.mc` 代替它，`this.player` 是打开界面的玩家：

```js
methods: {
    buy() {
        this.coins -= 1
        const bag = this.player.getComponent('minecraft:inventory').container
        bag.addItem(new this.mc.ItemStack('minecraft:diamond', 1))
    },
},
```

## 登记界面

界面要在项目配置 `cui.config.mjs` 的 `screens` 中登记，预览和构建才会包含它：

```js
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'
import shop from './ui/shop.screen.mjs'

export default defineConfig({
    namespace: 'shop',
    screens: [shop],
    textures: ['res'],
})
```

## 在脚本中打开

行为包脚本导入构建生成的 `cui.generated.js` 之后，界面的 `open()` 即可使用：

```js
// scripts/index.js
import { world } from '@minecraft/server'
import './cui.generated.js'
import shop from '../ui/shop.screen.mjs'

world.afterEvents.itemUse.subscribe((e) => {
    if (e.itemStack.typeId === 'minecraft:emerald') shop.open(e.source)
})
```

| 方法 | 作用 |
|---|---|
| `shop.open(玩家, props)` | 为玩家打开界面。`props` 可省略，没有传入的项取默认值。界面已经打开时，合并新的值并更新显示 |
| `shop.close(玩家)` | 关闭玩家的这个界面，之后调用 `onClose()` |
| `shop.isOpen(玩家)` | 玩家是否打开着这个界面 |

## 在浏览器中

- `bedrock-cui dev` 与手册网站上的预览都运行界面的逻辑：点击按钮调用方法，状态变化后重新显示，翻页、定时器照常工作。
- 浏览器中没有游戏：`this.mc` 与 `this.player` 是模拟对象，对它们的调用、发出的事件与聊天消息都写进日志，不产生实际效果。
