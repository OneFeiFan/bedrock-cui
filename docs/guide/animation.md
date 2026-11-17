# 动画

动画由游戏客户端播放：界面打开时开始，不需要脚本参与，也不需要刷新界面。透明度、位置、尺寸、颜色、图片的裁剪比例都可以做成动画。本节介绍 `Anim` 的写法与动画在游戏中的行为。

## 一段动画

`Anim` 的静态方法创建一段动画，`控件.setAnims(动画)` 把它加到控件上。任何控件都可以加动画。

```js
import { Anim, Label } from 'bedrock-cui'

// 0.5 秒内从透明变为不透明
new Label('欢迎').setAnims(Anim.alpha(0, 1, 0.5))
```

| 方法 | 变化的属性 |
|---|---|
| `Anim.alpha(起始, 结束, 秒数)` | 透明度（0 透明，1 不透明） |
| `Anim.offset([x, y], [x, y], 秒数)` | 位置偏移 |
| `Anim.size([宽, 高], [宽, 高], 秒数)` | 尺寸 |
| `Anim.color(颜色, 颜色, 秒数)` | 颜色 |
| `Anim.clip(起始, 结束, 秒数)` | 图片的裁剪比例（0 完整显示，1 全部裁掉）；图片要先用 `setClipRatio(方向, 比例)` 设置裁剪方向 |
| `Anim.wait(秒数)` | 等待，保持控件原本的状态 |

缺省的变化是匀速的。`动画.setEasing(缓动方式)` 改变变化的快慢，例如 `'in_out_sine'`（两头慢、中间快），可用的名称见 [API 参考](reference/api-core.md)。

## 动画链与循环

`动画.then(下一段)` 在一段动画之后接上下一段，组成动画链；`动画.loop()` 让动画链播完后回到第一段，循环播放。

```js preview=card 160x40
import { Anim, Image, Label, Panel, Size } from 'bedrock-cui'

// 「呼吸」：透明度在 1 与 0.2 之间来回变化
const card = new Panel().setSize(140, 30).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label('§5等待中').setAnims(
        Anim.alpha(1, 0.2, 1).setEasing('in_out_sine')
            .then(Anim.alpha(0.2, 1, 1).setEasing('in_out_sine'))
            .loop(),
    ),
)
```

下面照原版熔炉做一个循环播放的进度箭头：空箭头上叠一个满箭头，满箭头从左侧开始显示（`'left'`：可见部分靠左），裁剪比例在 3 秒内从 1 变为 0：

```js
import { Anim, Image, Panel } from 'bedrock-cui'

const arrow = new Panel().setSize(22, 15).add(
    new Image('textures/ui/arrow_inactive').setSize(22, 15),
    new Image('textures/ui/arrow_active').setSize(22, 15).setLayer(2)
        .setClipRatio('left', 1)
        .setAnims(Anim.clip(1, 0, 3).loop()),
)
```

燃烧的火焰同理：满火焰用 `setClipRatio('down', 0)`，动画为 `Anim.clip(0, 1, 3).loop()`。

## 在游戏中的行为

以下行为经过真机测试：

- 控件创建时（界面打开时）动画开始播放。界面因点击或刷新而重新打开时，控件重新创建，**动画从头开始**。
- 动画链播完后，控件保持最后一段的结束状态。
- 动画没有「从第几秒开始播放」的方法；`起始` 指属性的起始值，不是起始时间。

## 可续播的动画

倒计时、加工进度这类按时间推进的显示，界面重新打开后要从正确的位置接着播放，并在终点准确停下。[计时显示](timers.md)中的 `ProgressBar` 与 `Countdown` 已经做好了这些；自己实现类似的动画时，可以用下面三种技巧：

- **数值定起点**：由逻辑传入当前进度（整数），界面用位置绑定把控件摆到起点，再交给匀速的动画（速度 = 总距离 ÷ 总时长）。位置绑定的单位是控件自身的宽（高），所以移动的容器做成 1 像素宽，偏移即像素（真机）。到达终点的时刻就是真正结束的时刻。
- **裁剪封顶**：动画的时长在构建时已定，重新打开过的话会越过终点。把运动的部分放进边界固定在终点的裁剪容器（`setClip(true)`），越过的部分不显示。要在运动的末端画标记时，用两层叠放：底层画到末端，上一层画到末端之前一点，露出的部分就是标记，两层的裁剪边界同样错开。
- **遮挡**：要在终点显示一个静止的内容，把它放在运动部分的后面，运动部分的每一块都画上不透明的底；运动部分过去之后，后面的内容露出来。

这三种技巧只用到经过真机验证的能力：整数的位置绑定、匀速的动画、裁剪与叠放。透明度、颜色这类不能靠位置与裁剪表达的属性，目前没有续播的办法。

## 在浏览器中

`bedrock-cui dev` 与手册网站的预览播放动画：透明度、位置、尺寸、颜色与裁剪比例按时间变化，动画链、循环与缓动方式与游戏一致。界面因点击或刷新而重新显示时，动画从头开始，与游戏相同。

以字符串引用的已有动画定义（例如 `setAnims('@my_ns.fade')`）在预览中不播放。
