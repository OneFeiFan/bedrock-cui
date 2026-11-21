# 选项卡

选项卡在界面内部切换几块内容，例如背包中的「物品」「方块」两栏、目录、弹出层。它由游戏客户端切换，不需要脚本参与，表单也不关闭。本节介绍选项卡与开关的用法和限制。

选项卡与[页面](pages.md)写法相同，只是把 `Router` 换成 `Tabs`：页面由服务端切换，界面以那一页重新打开；选项卡只是在同一个界面中显示不同的内容。两者的区别见[页面与选项卡](pages.md#页面与选项卡)。

## Tabs

`new Tabs({ 名称: 页面函数 })` 创建一组选项卡，放进页面中；`.startAt(名称)` 设置一开始显示的一块，未设置时为第一块。切换用 `new Link(名称)`：它在 `Tabs` 中编译为客户端的开关。`Link` 的 `selected` 是这一块正在显示时的外观，用来高亮当前的标签。下面的示例在「预览」中可以点击切换：

```js preview=bag 220x110
import { Anchor, Color, Image, Label, Link, Page, Size, Tabs, Texture, defineUI } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

// 标签：平时显示名称，悬停时变黄，选中时加粗并带底色
function Tab(name, text, x) {
    const t = new Link(name).setSize(60, 16).setAnchor(Anchor.TOP_LEFT).setOffset(x, 4)
    t.default.add(new Label(text).setColor(INK))
    t.hover.add(new Label(`§e${text}`))
    t.selected.add(new Image(Texture.SOLID).setColor(Color.hex('#c8b48c')).setSize(Size.full()), new Label(`§l${text}`).setColor(INK))
    return t
}

function Bag() {
    return new Page().setSize(200, 96).add(
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        Tab('items', '物品', 10), Tab('blocks', '方块', 74),
        new Tabs({
            items: () => new Page().add(new Label('这里是物品').setColor(INK)),
            blocks: () => new Page().add(new Label('这里是方块').setColor(INK)),
        }).setSize(200, 70).setAnchor(Anchor.BOTTOM_CENTER),
    )
}

const bag = defineUI({ id: 'cui_ui:bag', page: Bag })
```

每一块的内容由页面函数返回，写法与[页面](pages.md)相同；其中可以直接显示界面的数据。一个界面可以有多组选项卡，也可以放在 `Router` 的子页面里。切换用的 `Link` 属于哪一组，规则见[跳转元素属于哪一组](pages.md#跳转元素属于哪一组)。

## 弹出层

选项卡也可以做弹出层：一组只有「无」和「详情」两块的选项卡，放在内容之上。「详情」一块铺满整个界面，最底下放一个铺满、没有外观的 `Link('none')`：点击弹出层以外的地方时，它接住点击并关闭弹出层，也拦住了对下层内容的点击。

```js
import { Label, Link, Page, Panel, Size, Tabs } from 'bedrock-cui'

const detail = new Tabs({
    none: () => new Page(),
    sword: () => new Page().add(
        new Link('none').setSize(Size.full()),                       // 点击外面：关闭
        new Panel().setSize(150, 90).add(new Label('钻石剑 · 详情')),
    ),
}).setLayer(40)
// 打开它的入口：new Link('sword')
```

## 单个开关：Toggle

只需要一个开关时（例如勾选「显示详情」时显示一行说明），使用 `Toggle`。`new Toggle(组名, 序号).setRadio(false)` 创建一个独立的开关；它的外观由四个状态面板组成：`unchecked`（未选中）、`checked`（选中）、`uncheckedHover`、`checkedHover`（鼠标悬停时），`开关.unchecked.add(控件…)` 把控件加入某个状态。`开关.setDefaultState(true)` 让它一开始就是选中的。

其他控件用 `toggleState(开关的名称)` 读取它是否选中，例子见[表达式 · 开关的状态](bindings.md#开关的状态)。

不调用 `setRadio(false)` 时，组名相同的开关互斥，同一时间只有一个被选中，`Tabs` 就是这样实现的；几块内容之间的切换直接使用 `Tabs`。

## 限制

- **鼠标不动时连续点击不可靠**：游戏只在鼠标移动时重新判断悬停的控件；客户端切换后，原位置上换成了另一个开关，第二次点击会落到错误的位置（真机）。所以 `Tabs` 中没有 `Back`；`Prev`、`Next` 可以放在各块之中，但静态检查会给出警告。在同一位置连续点击的翻页，应当使用[页面](pages.md)。
- **界面重新打开后回到起始的一块**：服务端不知道当前选中的是哪一块，界面因为点击按钮而重新打开时，选项卡回到 `startAt` 那一块。需要点按钮的标签页，用 `Router` 做（见[页面](pages.md)），当前页由服务端记录。
