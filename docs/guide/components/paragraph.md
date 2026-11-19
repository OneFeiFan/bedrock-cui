# Paragraph

`Paragraph` 用于较长的文字。它与 `Label` 一样交给游戏折行，但会调整汉字与英文、数字交界处的间隔，使 PC 与安卓上的折行都排得整齐。第二个参数是折行宽度。用法见[文字](../text.md#paragraph)。

```js preview=card 220x70
import { Anchor, Color, Image, Panel, Paragraph, Size } from 'bedrock-cui'

const card = new Panel().setSize(200, 50).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Paragraph('背包里一共 11 种物品，其中钻石有 3 个，每 2 个钻石加 1 根木棍可以合成 1 把钻石剑。', 184)
        .setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_LEFT).setOffset(8, 6),
)
```

`setWrap('hard')` 改为由 bedrock-cui 按 PC 的字宽计算每一行。两种方式的区别见[文字](../text.md#paragraph)。

## API

<!-- api: Paragraph -->
**创建**

- `new Paragraph(text: string, width: number, style?: TextStyle)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `wrap` | `setWrap()` | `"soft" \| "hard"` | 折行模式：'soft'（缺省，交给游戏、跨平台）或 'hard'（CUI 按 PC 字宽排好每一行） |
| `lines` | — | `string[]` | 折好的行（soft 模式：按当前字宽档案模拟游戏折行的结果） |
| `text` | `setText()` | `string` | 原文（未折行） |
| `width` | `setWidth()` | `number` | 折行宽度（像素） |
| `fontScale` | `setFontScale()` | `number \| undefined` | 字号倍数 |
| `kinsoku` | `setKinsoku()` | `boolean \| undefined` | 避头尾（缺省 true） |
| `autoSpace` | `setAutoSpace()` | `boolean \| undefined` | 中英文自动留空（缺省 true；中文标点与英文之间也留——Minecraft 的全角标点画得很窄） |
| `hang` | `setHang()` | `number \| undefined` | 给挂在行尾的标点留的像素（缺省 8） |
| `unifont` | `setUnifont()` | `boolean \| undefined` | 字体（缺省按内容：含非 ASCII ⇒ Unifont） |
| `color` | `setColor()` | `Color \| undefined` | 颜色 |
| `shadow` | `setShadow()` | `boolean \| undefined` | 阴影 |
| `align` | `setAlign()` | `TextAlign \| undefined` | 对齐 |
| `localize` | `setLocalize()` | `boolean \| undefined` | 文字是语言键，按玩家语言显示 |
| `lineSpacing` | `setLineSpacing()` | `number \| undefined` | 行距（line_padding） |

**方法**

| 方法 | 说明 |
|---|---|
| `setStyle(st: TextStyle)` | 套用样式（颜色、阴影、缩放、对齐；样式里没写的项不动） |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
