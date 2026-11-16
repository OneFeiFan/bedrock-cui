# 开关与分页

## Toggle

`Toggle` 是一个可以选中的控件。同一组（`group`）中的开关互斥，序号（`index`）标识组内的每个开关：

```js
import { Image, Label, Size, Texture, Toggle } from 'bedrock-cui'

const tab = new Toggle('tabs', 0).setName('tab_items').setSize(40, 16)
tab.unchecked.add(new Label('物品'))
tab.checked.add(new Image(Texture.SOLID).setKeepRatio(false).setSize(Size.full()), new Label('§l物品'))
```

开关的外观由四个状态面板组成，分别是 `unchecked`、`checked`、`uncheckedHover`、`checkedHover`，向其中加入控件即可。

`setRadio(false)` 使开关脱离互斥，成为独立的复选框；`setDefaultState(true)` 设置复选框的初始状态。

## Pages

`Pages` 用一组开关在客户端切换多页内容，切换时表单不关闭：

```js
import { Label, Pages, Size } from 'bedrock-cui'

const pages = new Pages('book').startAt('home').setSize(Size.full())
pages.page('home').add(new Label('目录'))
pages.page('sword').add(new Label('钻石剑'))
pages.page('diamond').add(new Label('钻石'))
```

`page(名称)` 创建一页并返回其容器。`startAt()` 设置初始显示的页，未设置时为第一页。

切换到某一页的控件由 `link()` 创建，它返回一个开关，点击后显示对应的页：

```js
// 接上例
import { Anchor, Label } from 'bedrock-cui'

const toSword = pages.link('sword').setSize(80, 16).setAnchor(Anchor.TOP_LEFT)
toSword.unchecked.add(new Label('钻石剑'))
toSword.uncheckedHover.add(new Label('§e钻石剑'))
pages.page('home').add(toSword)
```

同一页可以有多个入口（例如目录中的一行和书签）。通过继承 `Toggle` 编写的组件，用 `pages.attach(页名, 开关)` 关联到某一页。`pages.showing(页名)` 返回「该页正在显示」的表达式，可用于书签的选中样式。

## 弹出层

`Pages` 也可以用于弹出层：一组只有「无」和「详情」两页的 `Pages` 放在内容之上。`pages.blocker(页名)` 创建一个铺满、透明、无声的开关，放在弹出层下方，拦截对下层内容的点击：

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

游戏只在鼠标移动时重新判断悬停的控件。用开关连续翻页时，若鼠标不移动，第二次点击会落到错误的位置。目录、书签、弹出层这类每次都需要移动鼠标的操作适合用开关；「下一页」这类在同一位置连续点击的操作，应使用[服务端翻页](paging.md)。

::: warning
开关的状态面板中可以直接显示界面的数据（`props`）：bedrock-cui 在使用数据的控件处读取它。
:::
