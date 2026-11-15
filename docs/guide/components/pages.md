# Pages

`Pages` 管理多页内容。页之间可以用开关在客户端切换（目录、书签），也可以用服务端翻页箭头切换（鼠标不动也能连续翻页）。

```js preview=book 220x110
import { Anchor, Color, Image, Label, Pages, Panel, Row, Size } from 'bedrock-cui'

const pages = new Pages('book').startAt('sword').setSize(Size.full())
pages.page('sword').add(new Label('钻石剑：攻击伤害 7').setColor(Color.hex('#3c2814')))
pages.page('pick').add(new Label('钻石镐：可以挖掘黑曜石').setColor(Color.hex('#3c2814')))

// 目录：点击后切换到对应的页
const link = (key, name) => {
    const t = pages.link(key).setSize(50, 14)
    t.unchecked.add(new Label(name).setColor(Color.hex('#3c2814')))
    t.checked.add(new Label(`§l${name}`).setColor(Color.hex('#3c2814')))
    return t
}
const book = new Panel().setSize(200, 90).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Row().setGap(6).setAnchor(Anchor.TOP_LEFT).setOffset(8, 6).add(link('sword', '钻石剑'), link('pick', '钻石镐')),
    pages,
)
```

服务端翻页箭头（`serverArrow()`、`stayButton()`）见[翻页](../paging.md)；弹出层（`blocker()`）见[开关与分页](../pages.md#弹出层)。

## API

<!-- api: Pages -->
**创建**

- `new Pages(group: string)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `group` | `setGroup()` | `string` | 开关组名（同时是开关名前缀） |
| `start` | `setStart()` | `string \| undefined` | 初始页（缺省第一页） |
| `server` | `setServer()` | `{ source: Expr; prefix: string; } \| undefined` | 服务端页码（useServerPages 的设置） |

**方法**

| 方法 | 说明 |
|---|---|
| `startAt(key: string)` | 同 setStart |
| `useServerPages(source: Expr = form.title, prefix = 'P:')` | 服务端页码：脚本把标题写成 `<界面 id>\|P:<页名>;`（titleFor）， |
| `setButtonBase(n: number)` | 服务端翻页按钮从第几个表单按钮开始分配（缺省 10；前面的序号留给界面自己的表单按钮） |
| `serverArrow(from: string, to: string, dir: 'prev' \| 'next', art: (hover: boolean) => Element \| Element[], width: number, height: number)` | 翻页箭头（服务端）：点了关掉表单，脚本按新页码重开 |
| `stayButton()` | 「原地不动」：透明的表单按钮（1×1，优先级 50——介于聚焦版箭头 100 与普通箭头 10 之间） |
| `serverPaging(panelId: string)` | 翻页路由表（给脚本端 ServerPagesForm）：界面 id 即表单标题的前缀，例如 'cui_ui:my_book' |
| `titleFor(panelId: string, key: string)` | 静态界面的服务端分页：表单标题 `<界面 id>\|P:<页名>;` |
| `useRoutePages()` | 服务端分页（路由界面用）：每一页一个路由——标题 `<界面 id>/<页名>`（serverTitle）路由到「同一个界面 + 一个变量」， |
| `serverRoutes()` | 服务端路由：基础路由 = 初始页 |
| `page(key: string, options: LayoutOptions = {})` | 取 / 建一页 |
| `link(key: string, options: Omit<LayoutOptions, 'name'> & { name?: string } = {})` | 一个跳到 key 页的开关（放在树里任何地方；视觉加在它的状态面板里） |
| `indexOf(key: string)` | 第几页（从 0 起） |
| `attach(key: string, toggle: Toggle)` | 把一个自己构造的开关（例如继承 Toggle 的目录行、箭头、书签类）挂到 key 页：设好组名、序号、名字 |
| `blocker(key: string, options: Omit<LayoutOptions, 'name'> & { name?: string } = {})` | 透明、无声的拦截层：一个指向 key 页（通常是弹层自己所在的页）的开关 |
| `showing(key: string)` | 某页「正在显示」的表达式（例如书签的选中样式用） |
| `pageKeys()` |  |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
