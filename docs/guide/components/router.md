# Router

`Router` 是一组由服务端切换的子页面：切换时，界面以那一页重新打开，鼠标不动也能连续点击「下一页」。用法见[页面](../pages.md)；只在客户端切换的内容用 [`Tabs`](tabs.md)。

```js preview=book 240x120
import { Anchor, Color, Image, Label, Next, Page, Prev, Router, Size, defineUI } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const arrow = (b, text) => {
    b.setSize(16, 12)
    b.default.add(new Label(text).setColor(INK))
    b.hover.add(new Label(`§e${text}`))
    return b
}
const chapter = (title) => () => new Page().add(
    new Label(title).setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
    arrow(new Prev(), '<').setAnchor(Anchor.BOTTOM_LEFT).setOffset(6, -6),
    arrow(new Next(), '>').setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-6, -6),
)

const book = defineUI({
    id: 'cui_ui:book',
    page: () => new Page().setSize(200, 90).add(
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        new Router({ p1: chapter('第 1 页'), p2: chapter('第 2 页'), p3: chapter('第 3 页') }),
    ),
})
```

| 写法 | 作用 |
|---|---|
| `new Router({ 名称: 页面函数 })` | 一组子页面，名称由字母、数字、下划线与连字符组成；按写出的顺序排列 |
| `页面组.startAt(名称)` | 一开始显示的页（缺省为第一页） |

每个界面最多一个 `Router`。跳转用 [`Link`、`Back`、`Prev`、`Next`](nav.md)。

<!-- api: Router -->
**创建**

- `new Router(routes: Record<string, PageFunction>)`

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
