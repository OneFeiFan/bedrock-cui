# EventProgressBar

`EventProgressBar` 显示 `defineTimerHud()` 中的计时器。它由客户端播放剩余宽度内的动画，用于最多三个计时器的独立 HUD。完整用法见[事件驱动计时 HUD](../timer-hud.md)。

```js
import { EventProgressBar, Panel, Timer, defineTimerHud } from 'bedrock-cui'

const hud = defineTimerHud({
    id: 'cooldown',
    timers: { progress: Timer.idle(10) },
    view: ({ progress }) => new Panel().setSize(180, 20).add(
        new EventProgressBar(progress).setSize(160, 8),
    ),
})
```

`setDirection('progress')` 为默认方向，`setDirection('remaining')` 显示剩余部分。该组件需要 `TimerHudRef`，不接受服务端表单中的 `PropRef`。

<!-- api: EventProgressBar -->
**创建**

- `new EventProgressBar(readonly value: TimerHudRef)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `fill` | `setFill()` | `Color` |  |
| `track` | `setTrack()` | `Color` |  |

**方法**

| 方法 | 说明 |
|---|---|
| `setDirection(value: 'progress' \| 'remaining')` |  |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
