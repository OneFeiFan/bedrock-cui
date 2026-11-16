# 开关与分页

开关（`Toggle`）是可以选中的控件，由游戏客户端切换，不需要脚本参与，表单也不关闭。`Pages` 用一组开关在界面内部切换多页内容，适合做标签页、目录、弹出层。本节介绍它们的用法与限制。

「页」与「界面」不同：界面是一整个界面文件，由行为包脚本作为服务端表单打开（见[界面文件](screens.md)）；页是一个界面内部的一部分内容，在客户端切换。同一个界面中可以有多组页。

## Toggle

`new Toggle(组名, 序号)` 创建一个开关。同一组中的开关互斥，同一时间只有一个被选中；序号区分组内的各个开关，必须是不重复的非负整数：

```js
import { Image, Label, Size, Texture, Toggle } from 'bedrock-cui'

const tab = new Toggle('tabs', 0).setName('tab_items').setSize(40, 16)
tab.unchecked.add(new Label('物品'))
tab.checked.add(new Image(Texture.SOLID).setSize(Size.full()), new Label('§l物品'))
```

开关的外观由四个状态面板组成：`unchecked`（未选中）、`checked`（选中）、`uncheckedHover`、`checkedHover`（鼠标悬停时）。`开关.unchecked.add(控件…)` 把控件加入某个状态。

`开关.setRadio(false)` 使开关脱离互斥，成为独立的复选框；`开关.setDefaultState(true)` 设置复选框一开始就是选中的。

## Pages

`new Pages(组名)` 创建一组页。`页面组.page(页名)` 创建一页并返回它的容器；`页面组.startAt(页名)` 设置一开始显示的页，未设置时为第一页。

切换到某一页的控件由 `页面组.link(页名)` 创建：它返回一个开关，点击后显示对应的页。下面是两个标签页，在「预览」中可以点击切换：

```js preview=book 220x110
import { Anchor, Color, Image, Label, Pages, Panel, Size, Texture } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const pages = new Pages('tabs').startAt('items').setSize(200, 70).setAnchor(Anchor.BOTTOM_CENTER)
pages.page('items').add(new Label('这里是物品').setColor(INK))
pages.page('blocks').add(new Label('这里是方块').setColor(INK))

// 标签：未选中时显示名称，选中时加粗并带底色
const tab = (key, name, x) => {
    const t = pages.link(key).setSize(60, 16).setAnchor(Anchor.TOP_LEFT).setOffset(x, 4)
    t.unchecked.add(new Label(name).setColor(INK))
    t.uncheckedHover.add(new Label(`§e${name}`))
    t.checked.add(new Image(Texture.SOLID).setColor(Color.hex('#c8b48c')).setSize(Size.full()), new Label(`§l${name}`).setColor(INK))
    t.checkedHover.add(new Image(Texture.SOLID).setColor(Color.hex('#c8b48c')).setSize(Size.full()), new Label(`§l${name}`).setColor(INK))
    return t
}

const book = new Panel().setSize(200, 96).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    tab('items', '物品', 10), tab('blocks', '方块', 74),
    pages,
)
```

同一页可以有多个入口，例如目录中的一行与书签。通过继承 `Toggle` 编写的组件，用 `页面组.attach(页名, 开关)` 关联到某一页。`页面组.showing(页名)` 返回「这一页正在显示」的表达式，可以用作书签选中时的显示条件。

开关的状态面板与每一页中，都可以直接显示界面的数据（`props`）：bedrock-cui 在使用数据的控件处读取它。

## 弹出层

`Pages` 也可以做弹出层：一组只有「无」和「详情」两页的 `Pages` 放在内容之上。`页面组.blocker(页名)` 创建一个铺满、透明、无声的开关，放在弹出层的下面，拦截对下层内容的点击：

```js
import { Label, Pages, Panel, Size } from 'bedrock-cui'

const detail = new Pages('detail').startAt('none').setSize(Size.full()).setLayer(40)
detail.page('none')
detail.page('sword').add(
    detail.blocker('sword'),                                   // 点击弹出层以外的区域时，停留在当前页
    new Panel().setSize(150, 90).add(new Label('钻石剑 · 详情')),
)
```

## 客户端切换的限制

游戏只在鼠标移动时重新判断悬停的控件。用开关连续翻页时，如果鼠标不移动，第二次点击会落到错误的位置（真机）。目录、书签、弹出层这类每次都要移动鼠标的操作，适合用开关；「下一页」这类在同一位置连续点击的操作，应当使用界面文件中的[服务端翻页](paging.md)。
