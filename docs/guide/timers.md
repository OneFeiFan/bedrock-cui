# 计时显示

冷却、加工进度这类随时间匀速推进的显示，由计时器 `Timer` 与进度条 `ProgressBar` 完成。计时期间界面不刷新，玩家的点击不会落空；界面因点击而重新打开时，显示从当时的进度接着走。

## 写法

计时器放在状态中，页面直接显示它。下面的示例在「预览」中点击「开始」即开始计时：

```js preview=lab 220x90
import { Anchor, Button, Color, defineUI, Image, Label, Page, ProgressBar, Size, Timer } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

const lab = defineUI({
    id: 'cui_ui:furnace',
    state() { return { cooldown: Timer.idle(10) } },        // 10 秒的计时器，尚未开始
    methods: {
        start() { this.cooldown = this.cooldown.start() },  // 开始：重新赋值，界面随之更新
    },
    page({ cooldown, start }) {
        const go = new Button().onClick(start).setSize(40, 14).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-10, -8)
        go.default.add(new Label('开始').setColor(INK))
        go.hover.add(new Label('§e开始'))
        return new Page().setSize(200, 70).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label('冷却').setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(10, 10),
            new ProgressBar(cooldown).setSize(180, 8).setAnchor(Anchor.TOP_LEFT).setOffset(10, 30),
            go,
        )
    },
})
```

计时器也可以作为 props 由脚本传入：`props: { cooldown: { type: Timer, default: Timer.idle(10) } }`，组件从默认值得知总时长。

## 计时器

`Timer` 只记录开始的时刻与总时长。它不可变：下列方法返回新的计时器，赋值给状态即触发界面更新。

总时长和已过时间以秒为单位，支持小数。总时长须为能换算成有限毫秒数的正数。已过时间和传入的时刻须为有限数字。

| 方法 | 作用 |
|---|---|
| `Timer.idle(秒数)` | 一个尚未开始的计时器 |
| `Timer.of({ seconds, elapsed, running })` | 由已有的数据构造：总时长、已经过去的秒数、是否正在进行（见下文「与游戏对象同步」） |
| `计时器.start()` | 从头开始 |
| `计时器.pause()`、`计时器.resume()` | 暂停、从暂停处继续 |
| `计时器.reset()` | 回到未开始 |
| `计时器.remaining()`、`计时器.progress()` | 剩余的秒数、进度（0 到 1） |
| `计时器.isRunning()`、`计时器.isDone()` | 是否正在计时、是否已经完成 |

计时进行、暂停、继续、界面重新打开时，进度条从真实的进度接着走，到达右端时准确停下，不需要刷新界面。计时结束后才显示的内容（例如「领取」按钮），可以用 `computed` 判断：`ready() { return this.cooldown.isDone() }`，页面中 `setVisible(ready)`；它在下一次显示界面时生效（例如玩家的下一次点击）。

## ProgressBar

`new ProgressBar(计时器)` 创建一个进度条，参数是页面函数参数中值为计时器的数据，需要像素尺寸。`进度条.setFill(颜色)` 设置已完成部分的颜色，`进度条.setTrack(颜色)` 设置底色（`undefined` 表示不画底色）。`进度条.setHead(颜色, 宽度, 条数, 间隔)` 在前进的末端加亮色的竖条（缺省 1 条、宽 2 像素）。它们随末端移动，到达右端后停在那里；暂停时停在当前进度处。

### 数值进度

`new ProgressBar(value, max)` 显示给定数值占上限的比例，每次显示表单时按当前数据绘制。参数可用有限数字或页面参数中的数值数据。两者都支持小数，`max` 须大于 0，填充范围为 0 至 100%。

```js
import { defineUI, ProgressBar } from 'bedrock-cui'

const capacity = defineUI({
    id: 'cui_ui:capacity',
    props: { used: { type: Number, default: 2.5 }, total: { type: Number, default: 4 } },
    page: ({ used, total }) => new ProgressBar(used, total).setSize(160, 8),
})
```

默认显示 62.5%。脚本调用 `capacity.open(player, { used: 3.25, total: 5 })` 时会按新值显示。表单绑定接收脚本算好的整数千分比，数值模式的进度条随表单数据更新。

## 与游戏对象同步

进度条显示的是逻辑传来的进度。把它们绑定到游戏中的对象（例如自定义实体的加工进度）时，需要先弄清两个「钟」：

- **逻辑中的计时器**：记录开始的时刻与暂停时已经过去的时间。界面的关闭与重新打开不影响它，它就是真实的进度。
- **客户端动画自己的钟**：每次打开界面，控件重新创建，这个钟从零开始。但动画的起点由逻辑传来的进度决定，之后按「总宽度 ÷ 总时长」匀速前进。

以 10 秒的计时为例：

| 时刻 | 逻辑中的进度 | 进度条 |
|---|---|---|
| 第 0 秒：开始 | 0% | 从 0% 出发 |
| 第 4 秒：暂停 | 停在 40% | 停在 40% |
| 第 6 秒：继续（界面重新打开） | 从 40% 接着走 | 动画的钟归零，从 40% 的位置出发 |
| 第 12 秒 | 100%，完成 | 到达右端 |
| 第 12 到 16 秒 | 已完成 | 动画的钟还剩 4 秒，被裁掉，看不出来 |

看得见的部分始终与真实进度一致；被裁掉的只是动画剩下的播放时间，不是进度。

### 同步的条件

1. **每次显示界面时，传入对象的真实进度。** 界面只在显示时得到起点，之后按匀速推进。
2. **对象的速度变化时，让界面更新一次。** 例如实体停工、恢复、被卸载：修改状态，或对正在查看的玩家再调用一次 `open()`，界面以新的进度重新显示。两次变化之间只要是匀速，显示就是准的。
3. **总时长与界面中的一致。** 组件的速度在构建时按计时器初始值的总时长决定。传入的计时器总时长不同时，进度条会走得太快或太慢，运行时会打印提示。总时长不同的对象，用不同的界面或组件。

### 例子：实体的加工进度

实体开始加工时，用动态属性记下开始的时刻；行为包脚本打开界面时，由它构造计时器传入：

```js
// ui/machine.screen.mjs
import { defineUI, Page, ProgressBar, Timer } from 'bedrock-cui'

export default defineUI({
    id: 'cui_ui:machine',
    props: {
        progress: { type: Timer, default: Timer.idle(30) },      // 加工一件需要 30 秒（组件按它决定速度）
    },
    page({ progress }) {
        return new Page().setSize(200, 40).add(
            new ProgressBar(progress).setSize(180, 8),
        )
    },
})
```

```js
// 行为包脚本
import { world } from '@minecraft/server'
import { Timer } from 'bedrock-cui'
import './cui.generated.js'
import machine from '../ui/machine.screen.mjs'

// 实体的真实进度：开始的时刻记在动态属性 my:start（毫秒）中，没有时表示没在加工
const progressOf = (entity) => {
    const start = entity.getDynamicProperty('my:start')
    return Timer.of({ seconds: 30, elapsed: start === undefined ? 0 : (Date.now() - start) / 1000, running: start !== undefined })
}

world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
    if (target.typeId === 'my:machine') machine.open(player, { progress: progressOf(target) })
})
// 加工开始或停止时：对正在查看这台机器的玩家再调用一次 machine.open(player, { progress: progressOf(实体) })
```

### 时钟

计时器按现实时间计时。如果对象的进度按游戏刻推进（每刻加工一点），服务器卡顿（每秒不到 20 刻）或单人游戏暂停时，它会比现实时间慢，界面就会走在前面。这时需要按游戏刻换算出进度，并在偏差变大时让界面更新一次。

### 能不能做纯 UI 的计时

界面一直开着、中途不关闭时，可以只用[动画](animation.md)，不需要逻辑参与。关闭后再打开还要接着走时不行：客户端每次打开都重新创建控件，没有能跨越「关闭」保存时间的地方，必须由逻辑记住开始的时刻。逻辑承担的工作很少：只在显示界面时算一次进度，不需要每秒运行，也不需要每秒刷新。

## 原理

[动画](animation.md)由客户端播放，不需要刷新；但它的时长在构建时已定，界面重新打开时从头开始，也没有「从某个时间点开始播放」的方法。进度条用[可续播的动画](animation.md#可续播的动画)中的技巧实现：

1. **数值定起点**：逻辑只在打开或重新打开界面时，把计时器当前的进度传给界面（编码为 `I0`、`R400`、`P400`、`D1000`：状态用前缀表示，进度为千分比）。界面按进度摆好起点，再交给匀速的动画，速度是「总宽度 ÷ 总时长」。因此到达右端的时刻就是计时结束的时刻（真机）。
2. **裁剪封顶**：动画按总时长播放，重新打开过的话会越过终点。进度条的每一层都放在右边界固定的裁剪容器中，越过的部分不显示；末端的竖条由层的叠放画出（底层画到末端，上一层画到末端减去竖条的宽度），各层的裁剪边界同样错开，所以竖条停在右端（真机：1.62.0 验证了越过的距离，1.68.0 验证了封顶——暂停、继续、重新打开之后竖条都停在右端）。
