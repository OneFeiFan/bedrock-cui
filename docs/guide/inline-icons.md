# 行内图标

## Text 与 InlineIcon

`Text` 用于在一段文字中插入图标。图标由 `InlineIcon` 创建，以模板字符串的形式写入文字：

```js
import { Color, InlineIcon, Text, TextStyle } from 'bedrock-cui'

const DIAMOND = InlineIcon.of('textures/items/diamond')
const STICK = InlineIcon.of('textures/items/stick')
const BODY = TextStyle.of(Color.hex('#3c2814'))

new Text(`合成钻石剑：工作台中间一列放 ${DIAMOND}${DIAMOND}，下面放 ${STICK}。`, 110, BODY)
```

第二个参数是折行宽度，第三个参数是文字样式。

图标在编译时转换为图片控件，因此显示清晰、颜色正确。`InlineIcon.of()` 的第二个参数是图标尺寸：

- `8`（默认）：与文字同高。
- `16`：所在的行自动加高到 16 像素，文字与图标垂直居中。

```js
const SWORD = InlineIcon.of('textures/items/diamond_sword', 16)
new Text(`${SWORD} §l钻石剑§r`, 110, BODY)
```

## 排版

`Text` 由 bedrock-cui 排版：按宽度折行，每一行编译为一个横向排列的容器，文字片段与图标依次放入。片段的宽度由游戏按当前设备的字宽决定，图标紧跟在文字之后。

折行按最宽的设备字宽（安卓）计算，因此每一行在 PC 和安卓上都放得下。格式码跨越图标和换行继续生效：`§c红色 ${DIAMOND} 仍是红色` 中，图标之后的文字仍为红色。

`setLineGap(n)` 在行与行之间增加 n 像素的间距。

## 与字形图标的区别

`Text` 只能用于构建时已知的文字。服务端脚本在运行时生成的文字无法预先排版，需要显示图标时使用字形图标（`GlyphSheet`），见[字形图标](glyph-icons.md)。

::: warning
`InlineIcon` 只在 `Text` 中有效。写进 `Label` 时，图标的位置显示为一个无效字符，静态检查报告 `inline-icon-in-label`。
:::
