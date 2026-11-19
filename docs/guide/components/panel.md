# Panel

`Panel` 是没有外观的容器。子控件按各自的锚点与偏移定位，常用来组合背景、文字等控件。子控件的定位见[尺寸与位置](../layout.md#锚点与偏移)。

```js preview=card 220x90
import { Anchor, Color, Image, Label, Panel, Size } from 'bedrock-cui'

const card = new Panel().setSize(200, 70).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label('左上').setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_LEFT).setOffset(6, 6),
    new Label('居中').setColor(Color.hex('#3c2814')),
    new Label('右下').setColor(Color.hex('#3c2814')).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-6, -6),
)
```

子控件的定位方式见[尺寸与位置](../layout.md#锚点与偏移)。

## API

<!-- api: Panel -->
**创建**

- `new Panel()`

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
