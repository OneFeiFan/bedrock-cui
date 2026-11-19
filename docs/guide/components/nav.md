# Link、Back、Prev、Next

跳转元素：`Link` 跳到指定的页，`Back` 返回上一次所在的页，`Prev`、`Next` 按定义的顺序到上一页、下一页。它们在 [`Router`](router.md) 中由服务端跳转，在 [`Tabs`](tabs.md) 中编译为客户端的开关。用法见[页面](../pages.md#跳转)。

```js preview=bag 240x100
import { Anchor, Color, Image, Label, Link, Page, Size, Tabs, Texture, defineUI } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

// 标签：平时、悬停、选中（目标页正在显示）三种外观
function tab(name, text, x) {
    const t = new Link(name).setSize(60, 16).setAnchor(Anchor.TOP_LEFT).setOffset(x, 6)
    t.default.add(new Label(text).setColor(INK))
    t.hover.add(new Label(`§e${text}`))
    t.selected.add(new Image(Texture.SOLID).setColor(Color.hex('#c8b48c')).setSize(Size.full()), new Label(`§l${text}`).setColor(INK))
    return t
}

const bag = defineUI({
    id: 'cui_ui:bag',
    page: () => new Page().setSize(200, 80).add(
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        tab('items', '物品', 8), tab('blocks', '方块', 72),
        new Tabs({
            items: () => new Page().add(new Label('这里是物品').setColor(INK)),
            blocks: () => new Page().add(new Label('这里是方块').setColor(INK)),
        }).setSize(200, 50).setAnchor(Anchor.BOTTOM_CENTER),
    ),
})
```

| 写法 | 作用 |
|---|---|
| `new Link(名称)`、`new Link('组名:名称')` | 跳到指定的页；名称重复时用组名指明页面组 |
| `new Back()` | 返回上一次所在的页（只用于 `Router`）；没有历史时自动隐藏 |
| `new Prev()`、`new Next()` | 上一页、下一页；无处可去时自动隐藏 |
| `按钮.default`、`.hover`、`.pressed` | 平时、悬停、按下的外观，与 [`Button`](button.md) 相同 |
| `按钮.selected` | 目标页正在显示时的外观 |

跳转元素需要像素尺寸。它们属于哪一组页面，规则见[跳转元素属于哪一组](../pages.md#跳转元素属于哪一组)。

<!-- api: Link -->
**创建**

- `new Link(target: string)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `nav` | 只读 | `"link"` |  |
| `target` | 只读 | `string` | 目标页 |
| `selected` | 只读 | `Panel` | 目标页正在显示时的外观（例如高亮当前的标签） |
| `default` | 只读 | `Panel` |  |
| `hover` | 只读 | `Panel` |  |
| `pressed` | 只读 | `Panel` |  |
| `pressedName` | `setPressedName()` | `string \| undefined` | 按下时发出的按钮事件（缺省 button.form_button_click） |
| `template` | `setTemplate()` | `string \| undefined` | 继承的原版模板（缺省 common.button） |
| `focusPrecedence` | `setFocusPrecedence()` | `number \| undefined` | 默认聚焦优先级（服务端重开表单、鼠标没动时，点击交给默认聚焦的控件） |

**方法**

| 方法 | 说明 |
|---|---|
| `slots()` | 状态面板（按钮 / 开关覆盖） |
| `onClick(method: { readonly __method: string }, ...args: unknown[])` | 点击时调用界面的方法：onClick(buy) 或带参数 onClick(buy, '钻石')（参数须可写成 JSON） |
| `setOnPress(fn: () => void)` | 仅预览：点击回调 |
| `onPress(fn: () => void)` | 同 setOnPress |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->

`Back`、`Prev`、`Next` 与 `Link` 的属性和方法相同，构造时可以传入组名（`new Next('bag')`）。
