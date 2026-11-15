# 文字

## Label

`Label` 显示一段文字：

```js
import { Color, Label, TextStyle } from 'bedrock-cui'

new Label('钻石').setColor(Color.hex('#3c2814'))
new Label('钻石').setColor(Color.WHITE).setShadow().setFontScale(2)   // 白色、带阴影、两倍字号

// 多处共用的样式可以写成 TextStyle
const BODY = TextStyle.of(Color.hex('#3c2814'))
new Label('钻石').setStyle(BODY)
```

未设置尺寸时，`Label` 的大小由文字决定，不折行。设置了宽度时，文字由游戏在该宽度内折行：

```js
import { Label, Length } from 'bedrock-cui'

new Label('一段较长的说明文字').setSize(110, Length.auto())   // 宽 110 像素，高随行数变化
```

## 游戏的折行规则

游戏只在空格处换行（PC 与安卓相同）。相邻两个空格之间的文字视为一个单词：

- 单词放不进当前行、但放得进一整行时，整个单词移到下一行；
- 单词比一整行还长时，从当前行的剩余位置开始逐字排列。

不含空格的中文段落相当于一个很长的单词，因此会逐字排满每一行。中英文混排时，数字或英文两侧的空格是仅有的断点，空格之后的一长串汉字被视为一个单词，可能整个移到下一行，在上一行末尾留下大段空白。

下面是同一句话分别交给 `Label`（游戏折行）和 `Paragraph`（软换行）的结果：

```js preview=compare 260x80
import { Anchor, Color, Image, Label, Length, Panel, Paragraph, Size } from 'bedrock-cui'

const TEXT = '背包里一共 11 种物品，其中钻石有 3 个，每 2 个钻石加 1 根木棍可以合成 1 把钻石剑。'
const INK = Color.hex('#3c2814')
const compare = new Panel().setSize(250, 72)
compare.add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label(TEXT).setColor(INK).setSize(110, Length.auto()).setAnchor(Anchor.TOP_LEFT).setOffset(8, 6),
    new Paragraph(TEXT, 110).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(132, 6),
)
```

左边的 `Label` 中，数字之后的一长串汉字被整个移到下一行，上一行末尾留下空白。

## Paragraph

`Paragraph` 用于较长的文字。它与 `Label` 一样交给游戏折行，但会调整汉字与英文、数字交界处的间隔，避免上述的空白：

```js
import { Anchor, Paragraph } from 'bedrock-cui'

new Paragraph('背包里一共 11 种物品，其中钻石有 3 个。', 110).setAnchor(Anchor.TOP_LEFT)
```

第二个参数是折行宽度。对于每一处交界，`Paragraph` 分别尝试不留空格、使用不换行空格和保留普通空格，按 PC 与安卓两种字宽模拟游戏的折行，选择标点不落在行首、英文单词不被拆开、每行排得较满的组合。最终的折行仍由游戏按当前设备的字宽完成。

`setWrap('hard')` 改为由 bedrock-cui 按 PC 的字宽计算每一行，并在文字中写入换行。这种方式可以严格处理避头尾，但在字宽不同的设备上（如安卓）可能超出宽度并被游戏再次折行。

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

由服务端脚本生成的文字通过表达式绑定到控件：

```js
import { CollectionItem, Label, Length, form } from 'bedrock-cui'

// 显示第 5 个表单按钮的文字，去掉标记 'txt|'
new CollectionItem('form_buttons', 5).add(
    new Label(form.buttonText.minus('txt|')).setSize(110, Length.auto()),
)
```

运行期文字的内容在构建时未知，无法预先处理。脚本在发送文字之前，可以用 `softWrap()` 做与 `Paragraph` 相同的处理：

```js
// 行为包脚本
import { softWrap } from 'bedrock-cui/runtime'

actionForm.button('txt|' + softWrap(text, 110))
```

`softWrap()` 的结果会缓存，同样的文字与宽度不会重复计算。

## 不同设备上的字宽

PC 与安卓使用不同的字体，字宽也不同：

| | PC | 安卓 |
|---|---|---|
| 汉字 | 8.5 像素 | 9 像素 |
| 全角逗号 | 2 像素 | 9 像素 |
| 粗体每字增加（汉字） | 0.5 像素 | 1 像素 |

静态检查分别按两种字宽排版，只在安卓上出现的问题会注明「安卓字宽」。浏览器预览的地址加上 `?platform=android` 时，按安卓字宽显示。
