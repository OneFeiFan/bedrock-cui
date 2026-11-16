# 翻页

界面文件中，`pages(组名)` 创建多页内容，翻页由 bedrock-cui 在服务端完成：点击翻页箭头时，界面以新的一页重新打开。本节介绍服务端翻页的原理与写法。只在界面内切换、不需要脚本参与的分页，见[开关与分页](pages.md)。

## 原理

[开关与分页](pages.md)介绍了客户端翻页及其限制：游戏只在鼠标移动时重新判断悬停的控件，鼠标不动时连续点击会落到错误的位置。

服务端翻页的做法是：点击翻页箭头时表单关闭，bedrock-cui 以新的一页重新打开表单。重新打开时，刚才点击的箭头获得默认焦点，因此鼠标不移动也可以连续翻页。表单关闭与重新打开之间的间隔很短，看起来与翻页无异。

## 写法

视图函数的参数中有 `pages`。`pages(组名)` 返回一个 `Pages`，`页面组.page(页名)` 返回某一页的面板，`页面组.serverArrow(从哪页, 到哪页, 方向, 外观, 宽, 高)` 创建翻页箭头：

```js preview=book 220x140
import { Anchor, Color, Image, Label, Panel, Size, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

const book = defineScreen({
    id: 'cui_ui:book',
    view({ pages }) {
        const p = pages('book').startAt('p1').setSize(Size.full())
        // 箭头的外观：hover 为鼠标悬停时
        const arrow = (from, to, dir) => p
            .serverArrow(from, to, dir, (hover) => new Label(`${hover ? '§e' : ''}§l${dir === 'next' ? '>' : '<'}`), 16, 12)
            .setAnchor(dir === 'next' ? Anchor.BOTTOM_RIGHT : Anchor.BOTTOM_LEFT)
            .setOffset(dir === 'next' ? -8 : 8, -6)

        p.page('p1').add(new Label('第 1 页').setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10), arrow('p1', 'p2', 'next'))
        p.page('p2').add(new Label('第 2 页').setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10), arrow('p2', 'p1', 'prev'), arrow('p2', 'p3', 'next'))
        p.page('p3').add(new Label('第 3 页').setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10), arrow('p3', 'p2', 'prev'))

        return new Panel().setSize(200, 120).add(
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            p,
            p.stayButton(),
        )
    },
})
```

- `startAt('p1')`：打开界面时显示的页。
- `serverArrow()` 的「外观」是一个函数：参数 `hover` 为 `true` 时返回悬停时的样子。
- `页面组.stayButton()` 创建一个不可见的按钮，需要和页面组一起加入界面。当前页没有某个方向的箭头时（例如在最后一页点击「下一页」的位置），点击落在这个按钮上，界面原样重新打开，焦点不会落到别的按钮上。

翻页不需要在逻辑或脚本中写任何代码。翻页箭头与界面中的 `button()` 使用同一套序号分配，互不冲突。

## 注意

- 翻页时界面重新打开，方法与[事件](logic.md#事件)处理函数在这个过程中运行。其中不要向聊天栏发送消息：表单关闭与重新打开之间发送消息，会使界面消失数秒（真机）。
- 界面打开期间，玩家的视角被锁定，避免点击时视角随鼠标移动；界面关闭时解除。

## 在浏览器中

`bedrock-cui dev` 的预览中可以点击箭头翻页，日志中显示翻到的页（例如「翻到 p2」）。手册网站上的示例只显示第一页。
