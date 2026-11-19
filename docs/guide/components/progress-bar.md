# ProgressBar

`ProgressBar` 是进度条，有两种用法：随计时器匀速前进（计时期间不刷新界面），或显示一个数值占上限的比例。用法与原理见[计时显示](../timers.md)。

```js preview=cooldown 240x70
import { Anchor, Color, Image, Label, Page, ProgressBar, Size, Timer, defineUI } from 'bedrock-cui'

const cooldown = defineUI({
    id: 'cui_ui:cooldown',
    state() { return { time: Timer.idle(10).start() } },          // 打开时开始计时，10 秒走满
    page: ({ time }) => new Page().setSize(200, 44).add(
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        new Label('冷却').setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_LEFT).setOffset(10, 8),
        new ProgressBar(time).setHead(Color.WHITE).setSize(180, 8).setAnchor(Anchor.BOTTOM_CENTER).setOffset(0, -10),
    ),
})
```

| 写法 | 作用 |
|---|---|
| `new ProgressBar(计时器)` | 随计时器前进；参数是页面函数参数中值为计时器的数据 |
| `new ProgressBar(数值, 上限)` | 数值占上限的比例，数据变化后在下一次显示界面时更新 |
| `进度条.setFill(颜色)`、`进度条.setTrack(颜色)` | 已完成部分的颜色、底色（`undefined` 表示不画底色） |
| `进度条.setHead(颜色, 宽度, 条数, 间隔)` | 前进末端的竖条，到达右端后停在那里 |

进度条需要像素尺寸。

<!-- api: ProgressBar -->
**创建**

- `new ProgressBar(readonly value: T, max?: number | PropRef)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `seconds` | 只读 | `number` | 动画总时长（秒，取自计时器的初始值） |

**方法**

| 方法 | 说明 |
|---|---|
| `setFill(color: Color)` | 已完成部分的颜色 |
| `setTrack(color: Color \| undefined)` | 底色 |
| `setHead(color: Color, width = 2, count = 1, gap = 3)` | 末端的竖条（「头」）：count 条，宽 width、间隔 gap 像素 |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
