# 界面文件

一个界面写在一个文件里，通常命名为 `ui/名字.screen.mjs`。文件用 `defineScreen({ … })` 定义界面，选项分为三块：数据、逻辑、视图。本节介绍文件的整体结构；三块各自的写法见[数据（props）](props.md)、[逻辑](logic.md)和「搭建界面」一章。

## 文件的结构

下面是一个商店界面：显示问候语与一件物品，点击「购买」时金币减少。

```js preview=shop 240x140
// ui/shop.screen.mjs
import { Anchor, Color, Image, Label, Panel, Size, Texture, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

const shop = defineScreen({
    id: 'cui_ui:shop',

    // ———— 数据：视图显示的 props 与默认值 ————
    props: {
        greeting: '欢迎光临',
        item: { text: '钻石', icon: 'textures/items/diamond' },
    },

    // ———— 逻辑：在游戏中运行 ————
    state() {
        return { coins: 10 }
    },
    computed: {
        greeting() { return `金币：${this.coins}` },
    },
    methods: {
        buy() { this.coins -= 1 },
    },

    // ———— 视图：返回控件树 ————
    view({ props, button }) {
        const buy = button('buy').setSize(60, 18).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-10, -10)
        buy.default.add(new Image(Texture.SOLID).setColor(Color.hex('#5b8c3a')).setSize(Size.full()), new Label('购买'))
        buy.hover.add(new Image(Texture.SOLID).setColor(Color.hex('#7cb34f')).setSize(Size.full()), new Label('§e购买'))

        return new Panel().setSize(220, 120).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label(props.greeting).setColor(INK).setSize(180, 10).setAnchor(Anchor.TOP_LEFT).setOffset(12, 10),
            new Image(props.item).setSize(16, 16).setAnchor(Anchor.TOP_LEFT).setOffset(12, 34),
            new Label(props.item).setColor(INK).setSize(120, 10).setAnchor(Anchor.TOP_LEFT).setOffset(34, 38),
            buy,
        )
    },
})
export default shop
```

- `id`：界面 id，以 `cui_ui:` 开头（见[工作原理](how-it-works.md)）。
- `props`：视图显示的数据及其默认值。视图中用 `props.greeting` 读取；预览显示默认值，游戏中显示由逻辑或脚本提供的值。
- `state()`、`computed`、`methods`：逻辑。`computed` 中与 props 同名的 `greeting()` 决定 `props.greeting` 的值；`methods.buy()` 在点击 `button('buy')` 时调用。
- `view({ props, button })`：视图，返回控件树。`button('buy')` 创建一个名为 `buy` 的按钮。

## 各部分在何时、何处运行

数据、逻辑、视图写在同一个文件中，但运行的时间与地点不同：

| | 视图（`view`） | 逻辑（`state`、`computed`、`methods`、生命周期） |
|---|---|---|
| 何时运行 | 构建时运行一次 | 游戏运行时 |
| 在哪里运行 | 构建工具（Node.js）中；结果编译为界面文件，由游戏客户端显示 | 行为包脚本中 |
| 能用什么 | `props`、`button()`、`pages()` 与各种控件 | 状态、玩家、事件、定时器 |

因此视图不能读取状态，逻辑也不能修改控件。两者通过名字联系：props 的名字，以及 `button('buy')` 与 `methods.buy`。

界面文件在构建时会被 Node.js 导入，所以文件开头不能导入游戏的脚本模块（`@minecraft/server` 等）：这些模块只有类型声明，在 Node.js 中无法导入。需要和游戏交互的操作（给物品、扣金币），由逻辑发出[事件](logic.md#事件)，交给行为包脚本处理。

## 视图函数的参数

`view()` 得到一个对象，包含三项：

| 参数 | 作用 |
|---|---|
| `props` | 界面的数据。`props.名字` 用在控件上，见[数据（props）](props.md) |
| `button(名字)` | 创建一个按钮。点击时调用 `methods` 中的同名方法，见[逻辑](logic.md#按钮与方法) |
| `pages(组名)` | 创建多页内容，其中的翻页由 bedrock-cui 处理，见[翻页](paging.md) |

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
| `shop.open(玩家, props)` | 为玩家打开界面。`props` 可省略；传入的值优先于默认值，但不覆盖 `computed` 计算的值。界面已经打开时，合并新的值并更新显示 |
| `shop.close(玩家)` | 关闭玩家的这个界面，之后调用 `onClose()` |
| `shop.isOpen(玩家)` | 玩家是否打开着这个界面 |

`cui.generated.js` 记录了每个界面的数据与按钮怎样经由服务端表单传递（见[工作原理](how-it-works.md#bedrock-cui-怎样传递数据与点击)）。没有导入它就调用 `open()` 时，会报错并提示导入。
