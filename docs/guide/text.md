# 文字

界面中的文字由三种控件显示：`Label` 显示一段文字，`Paragraph` 显示较长的段落，`Text` 显示夹有图标的文字。本节介绍它们的用法、游戏折行文字的规则，以及格式码与运行期文字。

## Label

`new Label(文字)` 创建一段文字：

```js
import { Color, Label, TextStyle } from 'bedrock-cui'

new Label('钻石').setColor(Color.hex('#3c2814'))
new Label('钻石').setColor(Color.WHITE).setShadow().setFontScale(2)   // 白色、带阴影、两倍字号

// 多处共用的样式可以写成 TextStyle，用 setStyle() 应用
const BODY = TextStyle.of(Color.hex('#3c2814'))
new Label('钻石').setStyle(BODY)
```

未设置尺寸时，`Label` 的大小由文字决定，不折行。设置了宽度时，文字由游戏在这个宽度内折行：

```js
import { Label, Length } from 'bedrock-cui'

new Label('一段较长的说明文字').setSize(110, Length.auto())   // 宽 110 像素，高随行数变化
```

## 游戏的折行规则

游戏只在空格处换行（PC 与安卓相同）。两个空格之间的文字视为一个单词：

- 单词放不进当前行、但放得进一整行时，整个单词移到下一行；
- 单词比一整行还长时，从当前行的剩余位置开始逐字排列。

不含空格的中文段落相当于一个很长的单词，因此会逐字排满每一行。中英文混排时，数字或英文两侧的空格是仅有的断点，空格之后的一长串汉字被视为一个单词，可能整个移到下一行，在上一行末尾留下大段空白。

下面把同一句话分别交给 `Label`（游戏折行，左）和 `Paragraph`（右）。在「预览」中拖动滑块改变折行宽度 `W`，观察左边的空白何时出现：

```js preview=compare 280x110 vary=W:60-130
import { Anchor, Color, Image, Label, Length, Panel, Paragraph, Size } from 'bedrock-cui'

const W = 110
const TEXT = '背包里一共 11 种物品，其中钻石有 3 个，每 2 个钻石加 1 根木棍可以合成 1 把钻石剑。'
const INK = Color.hex('#3c2814')
const compare = new Panel().setSize(270, 100).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label(TEXT).setColor(INK).setSize(W, Length.auto()).setAnchor(Anchor.TOP_LEFT).setOffset(8, 6),
    new Paragraph(TEXT, W).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(140, 6),
)
```

左边的 `Label` 中，数字之后的一长串汉字被整个移到下一行，上一行末尾留下空白。

## Paragraph

`new Paragraph(文字, 折行宽度)` 用于较长的文字。它和 `Label` 一样交给游戏折行，但会调整汉字与英文、数字交界处的间隔，避免上一节的空白：

```js
import { Anchor, Paragraph } from 'bedrock-cui'

new Paragraph('背包里一共 11 种物品，其中钻石有 3 个。', 110).setAnchor(Anchor.TOP_LEFT)
```

对于每一处交界，`Paragraph` 分别尝试不留空格、使用不换行空格、保留普通空格，按 PC 与安卓两种字宽模拟游戏的折行，选出标点不落在行首、英文单词不被拆开、每行排得较满的组合。最终的折行仍由游戏按当前设备的字宽完成。这种方式称为软换行，是 `Paragraph` 的默认方式。

`段落.setWrap('hard')` 改为硬换行：bedrock-cui 按 PC 的字宽计算每一行，并在文字中写入换行符：

```js
import { Paragraph } from 'bedrock-cui'

new Paragraph('背包里一共 11 种物品，其中钻石有 3 个。', 110).setWrap('hard')
```

硬换行可以严格处理避头尾，但在字宽不同的设备上（例如安卓），某一行可能超出宽度，被游戏再折一次。`setWrap('soft')` 恢复默认的软换行。

## 文字中的图标

`Text` 显示夹有图标的文字。图标由 `InlineIcon.of(贴图路径)` 创建，以模板字符串的形式写进文字。`new Text(文字, 折行宽度, 样式)` 的第二个参数是折行宽度，第三个参数是文字样式（`TextStyle`）：

```js preview=card 160x70
import { Anchor, Color, Image, InlineIcon, Panel, Size, Text, TextStyle } from 'bedrock-cui'

const DIAMOND = InlineIcon.of('textures/items/diamond')
const STICK = InlineIcon.of('textures/items/stick')
const BODY = TextStyle.of(Color.hex('#3c2814'))

const card = new Panel().setSize(130, 50).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Text(`合成钻石剑：工作台中间一列放 ${DIAMOND}${DIAMOND}，下面放 ${STICK}。`, 110, BODY)
        .setAnchor(Anchor.TOP_LEFT).setOffset(10, 8),
)
```

`InlineIcon.of(贴图路径, 尺寸)` 的第二个参数是图标的尺寸：

- `8`（默认）：与文字同高；
- `16`：所在的行自动加高到 16 像素，文字与图标垂直居中。

```js
import { Color, InlineIcon, Text, TextStyle } from 'bedrock-cui'

const SWORD = InlineIcon.of('textures/items/diamond_sword', 16)
new Text(`${SWORD} §l钻石剑§r`, 110, TextStyle.of(Color.hex('#3c2814')))
```

`Text` 的折行由 bedrock-cui 完成：它按折行宽度把文字与图标分成若干行，每一行编译为一个横向排列的容器，文字片段与图标依次放在其中。图标在编译时转换为图片控件，因此显示清晰、颜色正确。格式码跨越图标与换行继续生效：`§c红色 ${DIAMOND} 仍是红色` 中，图标之后的文字仍是红色。

`文字组件.setLineGap(像素)` 在 `Text` 的行与行之间增加间距：

```js
import { InlineIcon, Text } from 'bedrock-cui'

const DIAMOND = InlineIcon.of('textures/items/diamond')
new Text(`第一行 ${DIAMOND} 第二行很长很长会折行`, 60).setLineGap(4)
```

`Text` 只能用于构建时已知的文字。行为包脚本在运行时生成的文字中需要图标时，使用[字形图标](glyph-icons.md)。

::: warning
`InlineIcon` 只在 `Text` 中有效。写进 `Label` 时，图标的位置显示为一个无效字符，静态检查报告 `inline-icon-in-label`。
:::

## 格式码

文字中可以使用 Minecraft 的格式码：

```js
new Label('§c红色§r 普通 §l粗体§r')
```

| 格式码 | 效果 |
|---|---|
| `§0`–`§9`、`§a`–`§f` | 颜色 |
| `§g` `§h` `§i` `§j` `§m` `§n` `§p` `§q` `§s` `§t` `§u` `§v` | 颜色（基岩版特有） |
| `§l` | 粗体 |
| `§o` | 斜体 |
| `§k` | 乱码 |
| `§r` | 恢复默认 |

::: warning
- `§` 本身无法作为文字显示。
- `§k` 只在纯英文的文字中显示为乱码；与汉字同在一个控件中时，只显示为一串点（静态检查：`obfuscated-unifont`）。
- 以 `#` 开头的文字整行不显示，以 `$` 开头的文字会被当作变量。bedrock-cui 编译时会自动处理这两种情况。
:::

## 运行期文字

由脚本提供的文字是界面的[数据（props）](props.md)，在视图中直接显示：

```js
import { Label, Panel, defineScreen } from 'bedrock-cui'

const story = defineScreen({
    id: 'cui_ui:story',
    props: { story: '' },
    view({ props }) {
        // 显示数据的控件需要像素尺寸：宽 110，最多显示 6 行
        return new Panel().setSize(130, 80).add(new Label(props.story).setSize(110, 60))
    },
})
```

运行期文字的内容在构建时未知，`Paragraph` 无法预先处理。脚本在传入文字之前，可以用 `softWrap()` 做与 `Paragraph` 相同的处理（见[脚本端](runtime.md#softwrap)）：

```js
// 接上例：行为包脚本（player 为玩家，text 为要显示的文字）
import { softWrap } from 'bedrock-cui/runtime'

story.open(player, { story: softWrap(text, 110) })
```

## 不同设备上的字宽

PC 与安卓使用不同的字体，字宽也不同：

| | PC | 安卓 |
|---|---|---|
| 汉字 | 8.5 像素 | 9 像素 |
| 全角逗号 | 2 像素 | 9 像素 |
| 粗体每字增加（汉字） | 0.5 像素 | 1 像素 |

静态检查分别按两种字宽排版，只在安卓上出现的问题会注明「安卓字宽」。浏览器预览的地址加上 `?platform=android` 时，按安卓字宽显示。

`Text` 折行时按两种字宽中较宽的一种（安卓）计算，因此每一行在 PC 和安卓上都放得下。
