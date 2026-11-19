# Tabs

`Tabs` 是一组在客户端切换的子页面（选项卡）：用开关切换，表单不关闭。它与跳转元素在界面构建时展开，所以要放在界面文件的页面中。用法见[选项卡](../tabs.md)；需要在服务端切换（鼠标不动也能连续点击、点击按钮后停留在原来的页）时，用 [`Router`](../pages.md)。

```js preview=bag 220x80
import { Anchor, Color, Image, Label, Link, Page, Size, Tabs, Texture, defineUI } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const tab = (name, text, x) => {
    const t = new Link(name).setSize(60, 16).setAnchor(Anchor.TOP_LEFT).setOffset(x, 4)
    t.default.add(new Label(text).setColor(INK))
    t.selected.add(new Image(Texture.SOLID).setColor(Color.hex('#c8b48c')).setSize(Size.full()), new Label(`§l${text}`).setColor(INK))
    return t
}

const bag = defineUI({
    id: 'cui_ui:bag',
    page: () => new Page().setSize(200, 66).add(
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        tab('items', '物品', 10), tab('blocks', '方块', 74),
        new Tabs({
            items: () => new Page().add(new Label('这里是物品').setColor(INK)),
            blocks: () => new Page().add(new Label('这里是方块').setColor(INK)),
        }).setSize(200, 40).setAnchor(Anchor.BOTTOM_CENTER),
    ),
})
```

| 写法 | 作用 |
|---|---|
| `new Tabs({ 名称: 页面函数 })` | 一组选项卡；每一块由页面函数返回 |
| `选项卡.startAt(名称)` | 一开始显示的一块（缺省为第一块） |
| `new Link(名称)` | 切换到某一块的开关；`selected` 为选中时的外观 |

<!-- api: Tabs -->
**创建**

- `new Tabs(routes: Record<string, PageFunction>)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `routes` | 只读 | `Record<string, PageFunction>` | 子页面（按定义的顺序） |
| `start` | — | `string \| undefined` | 一开始显示的子页面（缺省为第一个） |

**方法**

| 方法 | 说明 |
|---|---|
| `startAt(name: string)` | 一开始显示的子页面 |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
