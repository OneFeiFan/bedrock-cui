# 事件驱动计时 HUD

脚本在开始、暂停、继续、完成等状态变化时发送整份计时快照。两次事件之间，原版客户端在剩余宽度内播放动画。默认的 `title` 传输借用屏幕标题的三个时间参数。使用 `transport: 'actionbar'` 时，进度和剩余时长改由快捷栏提示通道传递，中央标题和字幕可与计时条同时显示。

`defineTimerHud()` 定义独立于服务端表单的覆盖层，`EventProgressBar` 显示其中的计时器。每名玩家同一时刻打开一个计时 HUD，每个 HUD 支持 1～3 个计时器。

该接口目前处于试验阶段。V15 的真机录像确认了三个计时器的推进、暂停、继续、标题避让和结束状态，未观察到宽度越界；V14 完成事件处的一帧明显回跳已消失。暂停时仍存在快照取整带来的小幅位置修正。

## 定义视图

```js
import { Anchor, EventProgressBar, Label, Panel, Timer, defineTimerHud } from 'bedrock-cui'

export const cooldowns = defineTimerHud({
    id: 'cooldowns',
    timers: {
        craft: Timer.idle(12),
        heal: Timer.idle(18),
        shield: Timer.idle(24),
    },
    view(timers) {
        const root = new Panel().setSize(240, 100)
        for (const [i, name] of ['craft', 'heal', 'shield'].entries()) {
            root.add(new Label(name).setSize(40, 12).setAnchor(Anchor.TOP_LEFT).setOffset(0, i * 30))
            root.add(new EventProgressBar(timers[name]).setSize(180, 8)
                .setAnchor(Anchor.TOP_LEFT).setOffset(50, i * 30))
        }
        return root
    },
})
```

`timers` 中的值为默认计时器。视图收到同名引用，用作 `EventProgressBar` 的参数；引用的 `percent` 和 `running` 为事件快照的表达式，动画播放期间不会逐帧更新文字。

`EventProgressBar` 默认尺寸为 `160 × 8`，尺寸须是正整数像素。`setDirection('remaining')` 显示逐渐缩短的剩余部分。填充色与轨道色分别由 `setFill(Color)`、`setTrack(Color)` 设置。

## 项目配置

将计时 HUD 登记到 `cui.config.mjs`：

```js
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'
import { cooldowns } from './ui/cooldowns.mjs'

export default defineConfig({
    namespace: 'my_ui',
    screens: [],
    timerHuds: [cooldowns],
})
```

项目已有服务端表单时，保留原有 `screens`。构建会生成 HUD 文件、合并资源定义，并在 `cui.generated.js` 中登记运行时。计时 HUD 无需通过 `ActionFormData` 反复打开。

## 脚本中的状态更新

```js
// 行为包入口需导入 cui.generated.js
import './cui.generated.js'
import { Timer } from 'bedrock-cui'
import { cooldowns } from './ui/cooldowns.mjs'

export function openCooldowns(player) {
    const now = Date.now()
    let heal = Timer.idle(18).start(now)
    cooldowns.open(player, {
        craft: Timer.idle(12).start(now),
        heal,
        shield: Timer.idle(24).start(now),
    })
    return {
        pauseHeal() {
            heal = heal.pause()
            cooldowns.update(player, { heal })
        },
        resumeHeal() {
            heal = heal.resume()
            cooldowns.update(player, { heal })
        },
        close() { cooldowns.close(player) },
    }
}
```

`cooldowns.open(player, values)` 替换该玩家当前的计时 HUD，未提供的字段采用默认值。`cooldowns.update(player, patch)` 合并同名字段，同一 tick 的更新合并成一份完整快照。暂停其中一个计时器时，其余计时器按同一时刻的当前进度和各自剩余时长重新建立动画。

`cooldowns.close(player)` 关闭该 HUD，`cooldowns.isOpen(player)` 查询是否打开。计时器全部暂停或完成后，运行时不保留轮询定时器。玩家离开时清理状态，重生时请求完整快照。

计时 HUD 的关闭由调用方负责。与服务端表单一起使用时，可在表单的 `onClose()` 中调用 `cooldowns.close(this.player)`。普通表单 props 的更新机制见[逻辑](logic.md)。

## 标题通道共用

需要中央标题与计时条同屏时，在上面的 `defineTimerHud()` 配置中加上 `transport: 'actionbar'`，再一起构建资源包和行为包。请把计时条排在标题区域以外。例如，V22 在居中的 300 × 220 表单上使用 `setPlacement(Anchor.CENTER, Anchor.TOP_CENTER).setOffset(0, -104)` 放置计时区，三条间隔 12 个 UI 像素。

项目内的普通提示统一由 `cooldowns.showTitle(player, text, options)` 发送。

```js
// 接上例
cooldowns.showTitle(player, '任务完成', { subtitle: '已获得奖励' })
cooldowns.showTitle(player, '任务完成', {
    policy: 'priority',
    subtitle: '正在结算奖励',
    fadeInDuration: 10,
    stayDuration: 60,
    fadeOutDuration: 20,
})
// 连续调用默认排队，中间不恢复 HUD；没有字幕的标题会清掉上一条字幕。
cooldowns.showTitle(player, '继续前进', { policy: 'priority' })
// 稍后奖励到账时更新当前字幕，不重播标题、不延长显示时间。
cooldowns.updateSubtitle(player, '已获得奖励')

// 紧急提示立即替换当前标题，同时丢弃待显示标题。
cooldowns.showTitle(player, '危险区域', { policy: 'priority', mode: 'replace' })
// 也可主动取消当前标题及队列，下一 tick 恢复完整当前进度。
cooldowns.clearTitle(player)
```

| 策略 | 行为 |
|---|---|
| `actionbar` | 提示显示在快捷栏上方，计时器继续显示。当计时数据也走 actionbar 时，用 `showTitle()` 把提示与快照一起发送 |
| `priority` | 显示原版中央标题。使用 `transport: 'actionbar'` 时计时条继续推进。使用 `transport: 'title'` 时计时条暂时隐藏，队列结束后恢复当前进度 |

`transport: 'actionbar'` 的默认提示策略是 `priority`。`transport: 'title'` 的默认提示策略是 `actionbar`。`titlePolicy` 可修改默认策略，单次调用的 `policy` 优先。HUD 未打开时，默认使用原版标题。原版标题的默认时长为淡入 `10`、停留 `70`、淡出 `20` tick。

中央标题的 `mode` 默认是 `queue`；`replace` 立即替换并清空待显示队列。每名玩家最多等待 8 条标题，超出时抛错，已接收的队列保持不变；每条都从实际发送时开始计时。`actionbar` 不使用这套队列。调用者无需定时轮询标题是否结束。

`updateSubtitle()` 仅更新当前受管理的中央标题，没有正在显示的标题时返回 `false`。它保留原版字幕更新行为，不重新发送主标题和计时快照，也不延长标题时长。`clearTitle()` 清除当前受管理的中央标题及其队列；没有受管理的标题时返回 `false`，不会主动清除外部标题或 actionbar。关闭计时 HUD 不取消普通标题；需要一起关闭时，显式调用 `clearTitle()`。玩家离开会同时清理二者。

使用 actionbar 传输时，其他脚本直接调用 `setActionBar()` 会覆盖计时快照。需要同时显示快捷栏提示时，使用 `cooldowns.showTitle(player, text, { policy: 'actionbar' })`。直接调用 `setTitle()` 可以显示中央标题。希望通过 `updateSubtitle()` 和 `clearTitle()` 管理该标题时，请通过 `showTitle()` 发送。

## 范围与验证

单计时器的局部动画、暂停和继续已经过 V11 真机反馈确认。V12 真机反馈确认了 actionbar 提示和中央标题出现，但进度条几乎不动，A 曾越界、C 在结束时仅显示很短一段。因此 V12 的脚本模拟通过不能作为多计时器绘制正确的证据。

V13 将大整数拆包替换为 ASCII 定长字段，每个字段分别携带运行标记和进度；例如 `aR025bP016cR012` 表示三个计时器的快照。协议前缀已升版，行为包与资源包须同时更新。V13 真机反馈确认动画有推进，但彩条越界；截图中的 `aP100bR066cR062` 对应的 B/C 总宽度约为两份已完成宽度，各行混合表达式文字未显示。

V14 为各计时器建立独立的接收控件，依次保存字段、数字文字、数值。尺寸绑定只读取数值，运行标记只读取对应字段，避免在尺寸减法与显示条件中嵌入字符串格式化。用户提供的 25 秒、750 帧录像确认了该示例的尺寸修正：三条轨道始终等宽，最终均为 `p=200`、`left=0`，未观察到越界。此结论仅适用于该三计时器示例和当前测试环境。

录像仍显示事件切换的一帧回跳：约 21.067 秒，B 完成引发新标题事件后，对照动画已重启，但字段仍为 `aP100bR067cR062`；下一帧约 21.100 秒才更新为 `aP100bP100cR087`。这表明原生动画重建与绑定快照的更新不同步，尚需解决。暂停时还可观察到与 `1/100` 进度取整一致的小幅回跳。V13 的静态 `min_size` / `max_size` 未阻止越界，不能作为绑定后尺寸的可靠钳制。

V15 将快照接收器和三个解码控件移入标题工厂实例，使用原版标题文字的初始化绑定方式，移除常驻的 `visibility_changed` 缓存。每次事件在同一实例中创建数据和动画；发送次数和分步数值解码保持不变。用户提供的 815 帧录像中，B 完成时新数据与动画已在同一采样帧出现，未再观察到 V14 的明显回跳；三条均未越界并最终填满。暂停处仍有约 4～6 屏幕像素（该画面约 0.8～1.2 个 UI 像素）的回退，与当前 `1/100` 快照取整一致。验证范围仍限于该示例与测试环境。

默认精度为 actionbar 传输 `1/800`，标题传输 `1/1000`（三条时为 `1/100`）。`steps` 可设为 `1～10000` 的整数。actionbar 的动画时长取最接近的整秒，最少一秒。短计时或频繁切换时，客户端动画可能与服务端的完成时刻有偏差，下一次事件会校正到当前进度。

V14 示例在彩条上方分别显示客户端字段、已完成像素 `p`、剩余像素 `left`。在 200 像素条上两者应始终相加为 200；截图那一帧的预期为 A `200 + 0`、B `132 + 68`、C `124 + 76`。下方的白色细条只使用原生动画时长与固定宽度，不读取进度字段。白条会在每次事件时从零重播，暂停槽位的白条会立即填满；它只用于区分时钟问题与进度解码问题，不代表业务进度。

该方案依赖 HUD 的标题与 actionbar 工厂。构建会保留并合并 sapdon 的常规 HUD 修改；若其他 HUD 重复登记同名原生工厂，构建会报告通道所有权冲突。独立安装的资源包仍按游戏的覆盖顺序生效。

浏览器中的服务端表单预览不会模拟此 HUD 的原生工厂与时钟。客户端动画、较大延迟下的校准效果和资源包之间的配合，以目标游戏版本的测试为准。

完整项目位于 [`examples/timer-hud`](../../examples/timer-hud)，构建命令为 `node examples/timer-hud/build.mjs`。脚本模拟检查命令为 `node --experimental-vm-modules --no-warnings examples/timer-hud/verify.mjs`。

主示例提供 V15 布局和单标题时间线。打包前将表单与计时 HUD 的完整控件树同 V15 原始安装包提取的基准比较。

### Actionbar 同屏实测

2026-11-18 的录像 `20261118-1248-58.7017498.mp4` 和用户反馈确认：通过 actionbar 工厂接收计时数据、将完整字段解析表达式直接用于动画时长后，三条彩条能够推进，中央标题、字幕和普通 actionbar 提示也能同时出现。引擎输入先复制为自定义变量；时长公式不再通过多级自定义变量传递，避免把表达式文字当成计算结果。这个结果支持独立通道方案，不代表此前失败的 V17 生成器已经修好。

V20 仍有两类回退：暂停时约 8～9 屏幕像素的小幅校正，以及后段黄条约 28 屏幕像素的回退。该录像的轨道宽 800 屏幕像素；后段速度接近把约 9 秒按 8 秒播放，支持小数时长被截断的判断。后续 V21 使用 JSON 浮点常量换算时长、提高演示快照精度并按最近 UI 像素取整，且将演示 HUD 与居中表单对齐、移除诊断白条。

V21 中的浮点乘法使动画约慢 20 倍，标题也遮挡了第三条进度。V22 恢复 V20 的内联除法，将时长预先取整，并收紧三条计时器的间距。录像 `20261118-1315-04.7486286.mp4` 确认三条按预期暂停、继续和完成，标题与字幕期间持续显示。800 屏幕像素宽的轨道上，启动后没有测到超过 2 个屏幕像素的单帧回退。框架的 `transport: 'actionbar'` 使用这套方案，构建时生成 v4 协议。
