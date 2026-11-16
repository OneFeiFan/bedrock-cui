# 逻辑

逻辑是界面文件中在游戏里运行的部分：点击按钮后做什么、界面的状态、何时更新显示。它写在 `defineScreen` 的 `state`、`computed`、`methods` 与生命周期函数中，由行为包脚本运行。本节依次介绍这些部分。

## 按钮与方法

视图中的 `button(名字)` 创建一个按钮；玩家点击它时，逻辑中 `methods` 的同名方法被调用：

```js
methods: {
    buy() { this.coins -= 1 },       // 点击 button('buy') 时调用
},
view({ button }) {
    const buy = button('buy').setSize(60, 18)
    buy.default.add(new Label('购买'))         // 平时的样子
    buy.hover.add(new Label('§e购买'))         // 鼠标悬停时的样子
    return new Panel().setSize(200, 100).add(buy)
},
```

`button()` 返回的按钮有三个状态：`default`（平时）、`hover`（悬停或获得焦点）、`pressed`（按下）。`按钮.default.add(控件…)` 把控件加入某个状态；`按钮.add(控件…)` 加入始终显示的内容。按钮需要像素尺寸。

`methods` 中没有同名方法时，构建报错；同一个名字只能创建一个按钮。

点击后，方法执行完毕，界面以最新的数据重新打开，刚才点击的按钮获得默认焦点。游戏只在鼠标移动时重新判断悬停的位置，鼠标不动时的点击交给默认焦点，因此连续点击同一个按钮时，每一次都落在这个按钮上（真机）。

## 状态

`state()` 返回界面的初始状态。每个玩家打开界面时，各自得到一份新的状态；界面关闭时，状态随之销毁。关闭后再打开，状态重新从 `state()` 开始。需要跨越多次打开保留的数据（例如金币），应保存在界面之外（脚本中的变量、玩家的动态属性），打开时通过 `open(玩家, { … })` 传入，或在 `onOpen()` 中读取。

逻辑中的 `this` 可以：

| 写法 | 作用 |
|---|---|
| `this.coins`、`this.coins = 5` | 读写状态 |
| `this.名字` | 读 `computed` 的值、调用 `methods` 中的方法 |
| `this.player` | 打开界面的玩家 |
| `this.close()` | 关闭界面 |
| `this.refresh()` | 立即更新显示（见下文） |
| `this.emit(事件名, …)` | 发出事件，交给脚本处理（见下文） |
| `this.setInterval(函数, 刻数)`、`this.setTimeout(函数, 刻数)` | 定时器（见下文） |

## 由状态计算 props

`computed` 中与 props 同名的函数，决定这项 props 的值。每次显示界面时都会重新计算：

```js
props: { greeting: '' },
state() { return { coins: 10 } },
computed: {
    greeting() { return `金币：${this.coins}` },     // props.greeting 的值
},
```

不与 props 同名的 `computed` 是辅助的计算值，可以在逻辑中用 `this.名字` 读取。

## 生命周期

| 函数 | 调用时机 |
|---|---|
| `onOpen()` | 第一次打开界面之前 |
| `onUpdate()` | 点击按钮、方法与事件处理完之后，重新打开之前 |
| `onClose()` | 玩家关闭界面（按 Esc），或调用了 `this.close()` |

## 更新显示

服务端表单打开后内容不能修改，所以更新显示的方式是：关闭当前表单，以新的数据重新打开（见[工作原理](how-it-works.md)）。

- **点击按钮后**：本来就会重新打开，方法中对状态的修改随之显示。
- **点击以外的时机**（定时器、游戏中的事件）修改了状态：bedrock-cui 安排一次刷新。同一时刻的多次修改合并为一次；表单显示后 0.4 秒内的刷新推迟到 0.4 秒之后，避免与玩家的连续点击冲突。
- 状态的检测是浅层的：给属性重新赋值（`this.list = [...this.list, x]`）会触发刷新，修改数组或对象的内部（`this.list.push(x)`）不会。后一种情况可以调用 `this.refresh()`。

刷新有代价：从关闭到重新打开大约有 150 毫秒的过渡，这段时间内的点击可能没有落在任何表单上（真机）。因此刷新适合偶尔的数据变化（例如购买之后）。随时间连续变化的显示（倒计时、进度条），应当让客户端用[动画](animation.md)自己完成，不要每秒刷新。

## 事件

界面文件在构建时会被 Node.js 导入，不能导入游戏的脚本模块，所以和游戏交互的操作（给物品、扣金币、改变世界）交给行为包脚本：逻辑中用 `this.emit()` 发出事件，脚本中用 `界面.on()` 接收。

```js
// 界面文件
methods: {
    buy() { this.emit('buy', '钻石', 1) },
},
```

```js
// 行为包脚本
import { ItemStack } from '@minecraft/server'

shop.on('buy', (player, item, count) => {
    player.getComponent('minecraft:inventory')?.container?.addItem(new ItemStack('minecraft:diamond', count))
})
```

- 处理函数得到玩家与 `emit()` 的参数，可以是异步函数。`界面.off(事件名, 处理函数)` 取消登记。
- 点击按钮时的顺序是：方法 → 事件交给脚本 → `onUpdate()` → 重新打开一次。处理函数中对界面的更新（例如再次调用 `open()` 传入新数据）合并到这一次重新打开中。
- 处理函数出错时只打印警告，不影响界面。
- 处理函数在重新打开的过程中运行，其中不要向聊天栏发送消息：表单关闭与重新打开之间发送消息，会使界面消失数秒（真机）。

## 定时器

`this.setInterval(函数, 刻数)` 每隔若干游戏刻执行一次函数，`this.setTimeout(函数, 刻数)` 在若干刻后执行一次（20 刻为 1 秒）。两者都返回一个取消函数；界面关闭时，它们自动取消。

```js
methods: {
    start() {
        this.left = 5
        this.stop = this.setInterval(() => {
            this.left -= 1                  // 修改状态：安排一次刷新
            if (this.left <= 0) this.stop()
        }, 20)
    },
},
```

上例每秒刷新一次界面，只作为定时器用法的示例。倒计时这类连续变化的显示，按上文应当用动画实现。

## 在浏览器中

`bedrock-cui dev` 的预览在浏览器中运行界面的逻辑：点击按钮调用方法，状态变化后重新显示，`computed`、生命周期、翻页与定时器照常工作。发出的事件和 `this.player.sendMessage()` 的消息写进日志，例如「发出事件「buy」（钻石，1）：游戏中交给脚本的 on('buy') 处理」；预览中没有行为包脚本，事件不会被处理。

手册网站上的示例只显示视图，props 显示默认值。
