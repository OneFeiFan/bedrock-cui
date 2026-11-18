# 逻辑

逻辑是界面文件中在游戏里运行的部分：界面的状态、点击按钮后做什么、何时更新显示。它写在 `defineUI` 的 `state`、`computed`、`methods` 与生命周期函数中，由行为包脚本运行。本节依次介绍这些部分。

## 按钮与方法

`new Button().onClick(方法)` 创建一个按钮，点击时调用逻辑中的方法。方法从页面函数的参数中解构得到：

```js
methods: {
    buy() { this.coins -= 1 },
},
page({ buy }) {
    const b = new Button().onClick(buy).setSize(60, 18)
    b.default.add(new Label('购买'))         // 平时的样子
    b.hover.add(new Label('§e购买'))         // 鼠标悬停时的样子
    return new Page().setSize(200, 100).add(b)
},
```

按钮有三个状态：`default`（平时）、`hover`（悬停或获得焦点）、`pressed`（按下）。`按钮.default.add(控件…)` 把控件加入某个状态；`按钮.add(控件…)` 加入始终显示的内容。绑定了方法的按钮需要像素尺寸。

`onClick()` 的第一个参数之后可以跟随参数，点击时传给方法。一个方法可以绑定到多个按钮，例如列表中每一行一个「购买」：

```js
methods: {
    buy(name, price) { this.coins -= price },
},
page({ buy }) {
    return new Page().setSize(200, 100).add(
        new Button().onClick(buy, '苹果', 1).setSize(60, 16),
        new Button().onClick(buy, '钻石', 5).setSize(60, 16).setOffset(0, 20),
    )
},
```

参数在构建时写进界面的清单，须是文字、数字、布尔值、数组或普通对象。关闭界面用 `new Close()`，它与按钮一样设置外观。没有绑定方法的 `Button` 只是界面内部的按钮，点击时不通知逻辑。

点击后，方法执行完毕，界面以最新的数据重新打开，刚才点击的按钮获得默认焦点。游戏只在鼠标移动时重新判断悬停的位置，鼠标不动时的点击交给默认焦点，因此连续点击同一个按钮时，每一次都落在这个按钮上（真机）。

## 状态

`state()` 返回界面的初始状态。每个玩家打开界面时，各自得到一份新的状态；界面关闭时，状态随之销毁。需要跨越多次打开保留的数据（例如金币），应保存在界面之外（玩家的动态属性等），打开时通过 props 传入，或在 `onOpen()` 中读取。

修改状态，界面就会更新：给属性赋新值、修改数组或对象的内部（`this.list.push(x)`、`this.bag.count += 1`）都会触发。赋相同的值、删除不存在的属性不会刷新。只有普通对象与数组被跟踪；类的实例（例如游戏对象、计时器）内部的变化不会触发，修改它们时重新赋值（`this.cooldown = this.cooldown.start()`）。

逻辑中的 `this` 可以：

| 写法 | 作用 |
|---|---|
| `this.名字` | 读取 props、state、computed 的值，调用 methods 中的方法 |
| `this.coins = 5` | 修改状态 |
| `this.player` | 打开界面的玩家 |
| `this.mc` | 游戏的脚本 API（`@minecraft/server`），见下文 |
| `this.close()` | 关闭界面 |
| `this.emit(事件名, …)` | 通知行为包脚本（见下文） |
| `this.setInterval(函数, 刻数)`、`this.setTimeout(函数, 刻数)` | 定时器（见下文） |
| `this.refresh()` | 立即更新显示（见下文） |

## 计算值

`computed` 中的函数由状态计算出一个值，每次显示界面时重新计算。页面可以直接显示它：

```js
state() { return { coins: 10 } },
computed: {
    coinText() { return `金币：${this.coins}` },
},
page({ coinText }) {
    return new Page().setSize(200, 40).add(new Label(coinText).setSize(160, 10))
},
```

## 生命周期

| 函数 | 调用时机 |
|---|---|
| `onOpen()` | 第一次打开界面之前 |
| `onUpdate()` | 点击按钮、方法执行完之后，重新打开之前 |
| `onClose()` | 玩家关闭界面（按 Esc），或调用了 `this.close()` |

点击方法与事件处理函数在每个玩家的界面实例中依次执行。异步方法完成后才处理下一次点击；界面已关闭时，未处理的点击被取消，正在等待的逻辑返回后也不会重新打开界面。

方法、生命周期或表单显示出错时，运行时打印警告并关闭界面，取消定时器、解除视角锁定。事件监听函数出错时仍只打印警告，不影响后续处理。

## 使用游戏的脚本 API

界面文件不能在开头导入 `@minecraft/server`（构建时 Node.js 导入界面文件，那里没有游戏）。逻辑中的 `this.mc` 就是这个模块，可以直接使用：

```js
methods: {
    buy() {
        this.coins -= 1
        this.player.getComponent('minecraft:inventory').container.addItem(new this.mc.ItemStack('minecraft:diamond', 1))
        this.mc.world.sendMessage(`${this.player.name} 买了一颗钻石`)
    },
},
```

## 更新显示

服务端表单打开后内容不能修改，所以更新显示的方式是：关闭当前表单，以新的数据重新打开（见[工作原理](how-it-works.md)）。这是游戏的限制，界面文件只能在此之上尽量减少它的影响：

- **点击按钮后**：本来就会重新打开，方法中的修改随之显示，没有额外的代价。
- **点击以外的时机**（定时器、游戏中的事件）修改了状态：bedrock-cui 安排一次刷新。同一时刻的多次修改合并为一次；表单显示后 0.4 秒内的刷新推迟到 0.4 秒之后，避免与玩家的连续点击冲突。

刷新有代价：从关闭到重新打开大约有 150 毫秒的过渡，这段时间内的点击可能没有落在任何表单上（真机）。因此：

- 随时间连续变化的显示，使用[计时显示](timers.md)中的进度条，由客户端的动画推进，不需要刷新。不要用定时器每秒修改状态来显示剩余时间：一个界面在 10 秒内因点击以外的原因刷新 3 次以上时，运行时会在日志中提示；
- 其他由游戏事件引起的变化，尽量让它在玩家下一次点击时一起显示，而不是立即刷新。

`computed` 读取游戏中的数据（例如背包里的物品）时，游戏中的变化不经过状态，bedrock-cui 无从得知。需要显示时调用 `this.refresh()`。

## 通知行为包脚本

界面以外的代码（其他系统、计分板逻辑）需要知道界面中发生了什么时，逻辑用 `this.emit()` 发出事件，脚本用 `界面.on()` 接收：

```js
// 界面文件
methods: {
    buy() { this.emit('buy', '钻石', 1) },
},
```

```js
// 行为包脚本
shop.on('buy', (player, item, count) => {
    console.warn(`${player.name} 买了 ${count} 个${item}`)
})
```

- 处理函数得到玩家与 `emit()` 的参数，可以是异步函数。`界面.off(事件名, 处理函数)` 取消登记。
- 点击按钮时的顺序是：方法 → 事件交给脚本 → `onUpdate()` → 重新打开一次。
- 处理函数出错时只打印警告，不影响界面。
- 表单关闭与重新打开之间不要向聊天栏发送消息，否则界面会消失数秒（真机）。

## 定时器

`this.setInterval(函数, 刻数)` 每隔若干游戏刻执行一次函数，`this.setTimeout(函数, 刻数)` 在若干刻后执行一次（20 刻为 1 秒）。两者都返回一个取消函数；界面关闭时，它们自动取消。定时器中修改状态会引起刷新，按上文的原则使用。

## 在浏览器中

`bedrock-cui dev` 与手册网站的预览都运行逻辑。浏览器中没有游戏：`this.mc` 与 `this.player` 是模拟对象，调用、事件与聊天消息写进日志，例如「游戏 API：new mc.ItemStack("minecraft:diamond", 1)」。
