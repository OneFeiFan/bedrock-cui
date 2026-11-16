# 表达式

表达式描述一个由游戏客户端在显示时计算的值，例如「这项数据中是否包含 VIP」「开关是否选中」。它们编译为 JSON UI 的绑定，可以用作控件的文字、显示条件等属性。本节介绍表达式的数据来源、运算与限制。

## 数据来源

表达式从两种数据开始：

| 来源 | 写法 | 介绍 |
|---|---|---|
| 界面的数据 | `props.名字` | [数据（props）](props.md) |
| 开关的状态 | `toggleState(开关名)` | 下文「开关的状态」 |

`props.名字` 本身就是一个表达式：用在 `Label` 上取它的文字，用在 `Image` 上取它的图标，用在 `setVisible()` 上表示「有值」。在它上面调用运算方法，得到新的表达式。

## 显示条件

`控件.setVisible(表达式)` 在表达式的值为真时显示控件。下面根据 `props.rank` 中是否包含 `VIP`，显示不同的文字：

```js preview=card 220x60
import { Color, Image, Label, Panel, Size, defineScreen } from 'bedrock-cui'

const card = defineScreen({
    id: 'cui_ui:card',
    props: { rank: 'VIP 会员' },
    view({ props }) {
        const vip = props.rank.contains('VIP')
        return new Panel().setSize(200, 40).add(
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

`props.名字.number` 把文字转为数字（JSON UI 中对数字文字做乘法即得到数字）。

## 限制

以下限制由真机测试得出：

- **运算只有整数**。除法是整数除法（`1 ÷ 4` 得 0），小数文字转为数字后得 0（`'0.6'` 得 0）。因此需要小数的属性（例如图片的裁剪比例）无法由运算得到。
- **`>=` 与 `<=` 放在更大的表达式中时，游戏解析出错**：单个比较结果正确，`(x > 3) and (x < 7)` 也正确，但 `(x >= 0) and (x < 10)` 结果为假（真机）。因此 bedrock-cui 把 `gte(x)` 编译为 `not (… < x)`、`lte(x)` 编译为 `not (… > x)`；改写后，含 `gte`、`lte` 的组合也能得到正确结果（真机）。
- **不引用任何数据的表达式是常量**，编译时直接算出结果，写成固定值。游戏不接受来源只有常数的绑定。
- 绑定读取不到数据时，目标属性保持默认值，不会报错。

## 开关的状态

`toggleState(开关名)` 读取一个开关是否选中，用于显示条件。开关的用法见[开关与分页](pages.md)：

```js
import { Label, toggleState } from 'bedrock-cui'

new Label('§a已选中').setVisible(toggleState('show_details'))
```

开关按名称查找，范围是整个界面。传入 `{ siblingScope: true }` 时，只在兄弟控件中查找。

一个表达式同时读取界面的数据与开关状态时，开关变化后它不会重新计算（真机）。应将两者分别用于不同的控件，例如外层控件按开关显示、内层控件显示数据（静态检查：`mixed-sources`）。
