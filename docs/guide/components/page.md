# Page

`Page` 是一页内容。界面文件中，根页面函数与子页面函数都返回一个 `Page`（见[界面文件](../screens.md#页面函数)）。它与 [`Panel`](panel.md) 一样是没有外观的容器；放在 [`Router`](router.md) 或 [`Tabs`](tabs.md) 中时，缺省铺满页面组的区域。

```js preview=card 240x110
import { Anchor, Color, Image, Label, Page, Size, defineUI } from 'bedrock-cui'

const card = defineUI({
    id: 'cui_ui:card',
    page: () => new Page().setSize(200, 80).add(
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        new Label('一页内容').setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
    ),
})
```

根页面需要尺寸（这里是 200 × 80）；页面组中的子页面不必设置。

<!-- api: Page -->
**创建**

- `new Page()`

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
