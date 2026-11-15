# Label

`Label` 显示一段文字。未设置宽度时不折行；设置宽度后，由游戏在该宽度内折行（只在空格处换行，见[文字](../text.md#游戏的折行规则)）。较长的文字应使用 [`Paragraph`](paragraph.md)。

```js preview=card 220x90
import { Anchor, Color, Column, Image, Label, Panel, Size } from 'bedrock-cui'

const card = new Panel().setSize(200, 70).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Column().setGap(4).setAnchor(Anchor.TOP_LEFT).setOffset(8, 6).add(
        new Label('默认颜色与大小'),
        new Label('指定颜色').setColor(Color.hex('#3c2814')),
        new Label('§c格式码§r 与 §l粗体'),
        new Label('两倍字号').setColor(Color.hex('#3c2814')).setFontScale(2),
    ),
)
```

文字可以是表达式，例如 `new Label(form.text)` 显示表单正文，见[表达式与绑定](../bindings.md)。

## API

<!-- api: Label -->
**创建**

- `new Label(text: string | Expr, style?: TextStyle)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `text` | `setText()` | `string \| Expr` | 文字（字符串或表达式） |
| `color` | `setColor()` | `Color \| undefined` | 颜色 |
| `shadow` | `setShadow()` | `boolean \| undefined` | 阴影 |
| `fontScale` | `setFontScale()` | `number \| undefined` | 字号倍数（font_scale_factor） |
| `align` | `setAlign()` | `TextAlign \| undefined` | 对齐 |
| `localize` | `setLocalize()` | `boolean \| undefined` | 文字是语言键，按玩家语言显示 |
| `lineSpacing` | `setLineSpacing()` | `number \| undefined` | 行距（line_padding） |

**方法**

| 方法 | 说明 |
|---|---|
| `setStyle(st: TextStyle)` | 套用样式（颜色、阴影、缩放、对齐；样式里没写的项不动） |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
