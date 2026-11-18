# 页面

一个界面可以有多页，例如图鉴的目录页与各个条目页。多页放在 `Router` 中：切换页面时，界面以那一页重新打开（服务端切换），因此鼠标不动也能连续点击「下一页」。本节介绍多页的写法，以及它与只在客户端切换的[选项卡](tabs.md)的区别。

## 写法

`new Router({ 名称: 页面函数 })` 创建一组子页面，放进页面中。`Router` 所在的位置就是子页面显示的区域；它以外的部分（背景、标题、关闭按钮）是各页共用的公共部分，切换页面时不变。跳转用 `Link`、`Back`、`Prev`、`Next` 元素，只需说明去哪一页，翻页的过程由 bedrock-cui 完成。下面的示例在「预览」中可以点击跳转：

```js preview=guide 240x150
import { Anchor, Back, Close, Color, Image, Label, Link, Next, Page, Prev, Router, Size, defineUI } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

// 跳转按钮的外观：平时与鼠标悬停时
const look = (b, text, w = 60) => {
    b.setSize(w, 14)
    b.default.add(new Label(text).setColor(INK))
    b.hover.add(new Label(`§e${text}`))
    return b
}

// 子页面：目录
function Home() {
    return new Page().add(
        new Label('目录').setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 8),
        look(new Link('sword'), '· 钻石剑', 90).setAnchor(Anchor.TOP_LEFT).setOffset(20, 30),
        look(new Link('apple'), '· 苹果', 90).setAnchor(Anchor.TOP_LEFT).setOffset(20, 46),
    )
}

// 子页面：条目（共用一个函数，用参数区分内容）
const Entry = (title, text) => () => new Page().add(
    new Label(title).setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 8),
    new Label(text).setColor(INK).setSize(180, 30).setAnchor(Anchor.TOP_LEFT).setOffset(20, 28),
    look(new Back(), '< 返回').setAnchor(Anchor.BOTTOM_LEFT).setOffset(8, -6),
    look(new Prev(), '上一条').setAnchor(Anchor.BOTTOM_CENTER).setOffset(-34, -6),
    look(new Next(), '下一条 >').setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-8, -6),
)

// 根页面：公共部分与一组子页面
function Guide() {
    return new Page().setSize(220, 130).add(
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        look(new Link('home'), '目录', 30).setAnchor(Anchor.TOP_LEFT).setOffset(6, 4),
        new Close().setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 4).add(new Label('§4x')),
        new Router({
            home: Home,
            sword: Entry('钻石剑', '攻击伤害 7，耐久 1561。'),
            apple: Entry('苹果', '恢复 4 点饥饿值。'),
        }),
    )
}

const guide = defineUI({ id: 'cui_ui:guide', page: Guide })
```

打开界面时显示 `Router` 中的第一页；`new Router({ … }).startAt('名称')` 可以指定别的页。子页面的页面函数与根页面相同：参数是你定义的名字，返回一个 `Page`。

## 跳转

| 元素 | 跳到 |
|---|---|
| `new Link(名称)` | 指定的页 |
| `new Prev()`、`new Next()` | 按 `Router` 中定义的顺序，上一页、下一页 |
| `new Back()` | 上一次所在的页。bedrock-cui 记录跳转的历史 |

它们与 `Button` 一样设置外观（`default`、`hover`、`pressed`、`add()`），需要像素尺寸；另有 `selected`：目标页正在显示时显示，可以用来高亮当前的标签。

**无处可去时自动隐藏**：第一页的 `Prev`、最后一页的 `Next`、没有历史时的 `Back`，都不显示。所以条目页可以共用一个页面函数，不需要判断。

**放在哪里都可以**：跳转元素可以放在子页面中，也可以放在公共部分（例如上例左上角的「目录」）。放在公共部分的 `Prev`、`Next`，相对于当前显示的页。

**鼠标不动也能连续点击**：跳转之后，新页中动作相同的按钮获得默认焦点（例如刚才点了「下一条」，新页的「下一条」获得焦点）；公共部分的按钮在每一页都是同一个，焦点不变。游戏只在鼠标移动时重新判断悬停的位置，鼠标不动时的点击交给默认焦点，所以连续点击都落在同一个按钮上（真机）。当前页没有这个按钮时（例如最后一页没有「下一条」），bedrock-cui 自动加入的「原地不动」按钮接住这次点击。

## 跳转元素属于哪一组

一个界面可以同时有 `Router` 与[选项卡](tabs.md)，跳转元素在构建时自己找到所属的那一组：

- 元素在某一组的子页面中：属于这一组（由内向外找，`Link` 要求这一组有目标页）；
- 元素在公共部分：从元素向外，第一层含有匹配的组的位置决定。

找到多个时构建报错，提示指明组名：给页面组设置名称（`new Tabs({ … }).setName('bag')`），再写成 `new Link('bag:items')` 或 `new Next('bag')`。

## 页面与选项卡

| | 页面（`Router`） | [选项卡](tabs.md)（`Tabs`） |
|---|---|---|
| 切换的方式 | 服务端：界面以那一页重新打开 | 客户端：表单不关闭 |
| 速度 | 有约 150 毫秒的过渡 | 立即 |
| 鼠标不动时连续点击 | 每次都落在同一个按钮上 | 第二次点击会落到错误的位置（真机） |
| 点击按钮、界面重新打开后 | 停留在原来的页 | 回到起始的一块 |
| 数量 | 每个界面一个 | 不限，可以放在 `Router` 的子页面里 |
| 适合 | 翻页、需要点按钮的标签页 | 只看不点的标签、目录、弹出层 |

## 注意

- 跳转时界面重新打开，方法与[事件](logic.md#通知行为包脚本)处理函数在这个过程中运行，其中不要向聊天栏发送消息：表单关闭与重新打开之间发送消息，会使界面消失数秒（真机）。
- 界面打开期间，玩家的视角被锁定，避免点击时视角随鼠标移动；界面关闭时解除。
