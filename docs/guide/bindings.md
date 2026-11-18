# 表达式

表达式描述一个由游戏客户端在显示时计算的值，例如「这项数据中是否包含 VIP」「开关是否选中」。它们编译为 JSON UI 的绑定，可以用作控件的文字、显示条件等属性。本节介绍表达式的数据来源、运算与限制。

## 数据来源

表达式从两种数据开始：

| 来源 | 写法 | 介绍 |
|---|---|---|
| 界面的数据 | 页面函数参数中的名字（props、state、computed） | [数据（props）](props.md) |
| 开关的状态 | `toggleState(开关名)` | 下文「开关的状态」 |

页面函数参数中的数据本身就是一个表达式：用在 `Label` 上取它的文字，用在 `Image` 上取它的图标，用在 `setVisible()` 上表示「有值」。在它上面调用运算方法，得到新的表达式。

## 显示条件

`控件.setVisible(表达式)` 在表达式的值为真时显示控件。下面根据 `rank` 中是否包含 `VIP`，显示不同的文字：

```js preview=card 220x60
import { Color, defineUI, Image, Label, Page, Size } from 'bedrock-cui'

const card = defineUI({
    id: 'cui_ui:card',
    props: { rank: { type: String, default: 'VIP 会员' } },
    page({ rank }) {
        const vip = rank.contains('VIP')
        return new Page().setSize(200, 40).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            new Label('§6欢迎，尊贵的会员').setSize(160, 10).setVisible(vip),
            new Label('欢迎').setColor(Color.hex('#3c2814')).setSize(160, 10).setVisible(vip.not()),
        )
    },
})
```

## 运算

表达式的运算写成方法调用，返回新的表达式：

| 方法 | 含义 | 真机 |
|---|---|---|
| `contains(x)` | 文字中是否包含 x | 已验证 |
| `minus(x)` | 对文字：去掉其中的 x；对数字：减法 | 已验证 |
| `eq(x)`、`ne(x)` | 相等、不相等 | 原版常用（`=`） |
| `and(x)`、`or(x)`、`not()` | 逻辑运算 | 原版常用 |
| `isEmpty()` | 是否为空字符串 | |
| `times(x)`、`div(x)`、`mod(x)`、`plus(x)` | 算术运算；`plus` 对文字是拼接 | 只有整数（见下文） |
| `gt(x)`、`lt(x)`、`gte(x)`、`lte(x)` | 大于、小于、大于等于、小于等于 | 已验证，可以用 `and`、`or` 组合 |

`数据.number` 把文字转为数字（JSON UI 中对数字文字做乘法即得到数字）。

## 限制

以下限制由真机测试得出：

- **运算只有整数**（真机）：除法是整数除法（`1 ÷ 4` 得 0，`5 ÷ 2` 得 2）；小数常数参与运算时结果仍是整数（`5 × 0.1`、`5 ÷ 12.5` 得 0）；小数文字转为数字后得 0（`'0.6'` 得 0）。因此需要小数的属性（例如图片的裁剪比例）无法由运算得到：让脚本算好整数传入（例如 `new ProgressBar(数值, 上限)` 由脚本算出千分比），或用整数与位置代替。
- **`>=` 与 `<=` 放在更大的表达式中时，游戏解析出错**：单个比较结果正确，`(x > 3) and (x < 7)` 也正确，但 `(x >= 0) and (x < 10)` 结果为假（真机）。因此 bedrock-cui 把 `gte(x)` 编译为 `not (… < x)`、`lte(x)` 编译为 `not (… > x)`；改写后，含 `gte`、`lte` 的组合也能得到正确结果（真机）。
- **`and`、`or`、`not` 的组合**：数字比较之间的各种组合都正确，包括被 `not` 包住的组合、`not` 在 `and` 或 `or` 的右边（真机 1.69.0）。`not (not X)` 的外层 `not` 没有生效（真机 1.59.0），bedrock-cui 编译时消去双重否定。
- **含文字比较（「包含」等）的组合**：文字比较之间的 `and` 正确；下列组合结果错误（真机）：`or` 右边被 `not` 包住的文字比较（例如「… 或 包含 X」）、被 `not` 包住的含文字比较的组合、数字比较与文字比较写在同一个表达式里（例如「(数量 > 3) 且 包含 X」）。bedrock-cui 把同一数据的「包含」用 `or` 连接时自动写成一次比较（`s.contains('a').or(s.contains('z'))` 编译为 `not ((s − 'a' − 'z') = s)`）；其余错误的组合由静态检查 `text-logic` 提示，改为在逻辑中算好（computed）再显示。
- **不引用任何数据的表达式是常量**，编译时直接算出结果，写成固定值。游戏不接受来源只有常数的绑定。
- 绑定读取不到数据时，目标属性保持默认值，不会报错。

## 开关的状态

`toggleState(开关的名称)` 表示「这个开关是否选中」，常用作显示条件：开关选中时显示某些内容。下面勾选「显示详情」时显示一行说明，在「预览」中可以点击：

```js preview=card 220x60
import { Anchor, Color, Image, Label, Panel, Size, Texture, Toggle, toggleState } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const box = new Toggle('options', 0).setName('show_details').setRadio(false).setSize(80, 12).setAnchor(Anchor.TOP_LEFT).setOffset(10, 8)
box.unchecked.add(new Label('□ 显示详情').setColor(INK))
box.checked.add(new Label('■ 显示详情').setColor(INK))

const card = new Panel().setSize(200, 44).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    box,
    new Label('钻石：最坚硬的矿物之一').setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(10, 26)
        .setVisible(toggleState('show_details')),
)
```

开关按名称查找（`setName()` 设置的名称），范围是整个界面。选项卡（`Tabs`）的 `showing()` 也是用开关的状态实现的。

一个表达式不要同时读取界面的数据与开关的状态：开关变化后它不会重新计算（真机）。需要两者共同决定时，把控件拆成两层，外层按开关显示，内层按数据显示（静态检查：`mixed-sources`）。
