# Text 与 InlineIcon

`Text` 是可以插入行内图标的文字，由 bedrock-cui 排版。图标由 `InlineIcon.of()` 创建，以模板字符串写入文字。用法见[文字](../text.md#文字中的图标)。

```js preview=card 180x70
import { Anchor, Color, Image, InlineIcon, Panel, Size, Text, TextStyle } from 'bedrock-cui'

const DIAMOND = InlineIcon.of('textures/items/diamond')
const SWORD = InlineIcon.of('textures/items/diamond_sword', 16)    // 16 像素：所在行自动加高

const card = new Panel().setSize(150, 50).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Text(`${SWORD} §l钻石剑§r\n需要 ${DIAMOND}×2`, 130, TextStyle.of(Color.hex('#3c2814'))).setAnchor(Anchor.TOP_LEFT).setOffset(8, 6),
)
```

`Text` 只能用于构建时已知的文字。运行期文字中的图标见[字形图标](../glyph-icons.md)。

## API

<!-- api: Text -->
**创建**

- `new Text(content: string, width?: number, style?: TextStyle)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `content` | 只读 | `string` |  |
| `width` | 只读 | `number \| undefined` |  |
| `style` | 只读 | `TextStyle \| undefined` |  |
| `lineGap` | `setLineGap()` | `number` | 行间额外的间距 |
| `lines` | 只读 | `TextPiece[][]` | 排好的行（每行一串段） |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->

<!-- api: InlineIcon -->
**创建**

见下方的静态方法。

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `marker` | 只读 | `string` | 写进文字里的记号字符 |
| `advance` | — | `number` | 占的宽度（界面像素）= 边长 + 间距 |

**方法**

| 方法 | 说明 |
|---|---|
| `InlineIcon.of(texture: Texture \| string, size: InlineIconSize = 8, gap = 1)` | 一个行内图标：texture 通常是 16×16 的物品贴图 |
| `toString()` |  |
| `InlineIcon.lookup(ch: string)` | 某个字符是不是行内图标的记号 |
| `InlineIcon.within(text: string)` | 文字里有没有行内图标 |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
