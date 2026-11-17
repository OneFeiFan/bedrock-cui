# 页面

一个界面可以有多页，例如图鉴的目录页与各个条目页。切换页面时，界面以那一页重新打开（服务端切换），因此鼠标不动也能连续点击「下一页」。本节介绍多页的写法，以及它与只在客户端切换的[选项卡](tabs.md)的区别。

## 写法

有多页时，界面文件不写 `view`，改写 `pages`：每一页是一个函数，返回这一页的内容。页内用 `link(页名)`、`next()`、`prev()`、`back()` 创建跳转用的按钮，只需说明「去哪一页」，翻页的过程由 bedrock-cui 完成。各页共用的外框（背景、关闭按钮）写在 `layout` 中，参数 `page` 是当前页放置的位置。下面的示例在「预览」中可以点击跳转：

```js preview=guide 240x150
import { Anchor, Color, Image, Label, Panel, Size, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

// 跳转按钮的外观：平时与鼠标悬停时
const look = (b, text) => { b.default.add(new Label(text).setColor(INK)); b.hover.add(new Label(`§e${text}`)); return b }

const guide = defineScreen({
    id: 'cui_ui:guide',
    pages: {
        home: ({ link }) => new Panel().setSize(Size.full()).add(
            new Label('目录').setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
            look(link('sword'), '· 钻石剑').setSize(80, 12).setAnchor(Anchor.TOP_LEFT).setOffset(20, 32),
            look(link('apple'), '· 苹果').setSize(80, 12).setAnchor(Anchor.TOP_LEFT).setOffset(20, 48),
        ),
        sword: ({ back, next }) => new Panel().setSize(Size.full()).add(
            new Label('钻石剑：攻击伤害 7').setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
            look(back(), '< 返回').setSize(50, 12).setAnchor(Anchor.BOTTOM_LEFT).setOffset(8, -6),
            look(next(), '下一条 >').setSize(50, 12).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-8, -6),
        ),
        apple: ({ back, prev }) => new Panel().setSize(Size.full()).add(
            new Label('苹果：恢复 4 点饥饿值').setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
            look(back(), '< 返回').setSize(50, 12).setAnchor(Anchor.BOTTOM_LEFT).setOffset(8, -6),
            look(prev(), '< 上一条').setSize(50, 12).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-8, -6),
        ),
    },
    layout: ({ page }) => new Panel().setSize(220, 130).add(
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        page,
    ),
})
```

打开界面时显示 `pages` 中的第一页；`start: '页名'` 可以指定别的页。

## 跳转

| 写法 | 跳到 |
|---|---|
| `link(页名)` | 指定的页 |
| `next()`、`prev()` | 按 `pages` 中定义的顺序，下一页、上一页 |
| `back()` | 上一次所在的页。bedrock-cui 记录跳转的历史；没有历史时（例如刚打开界面），这个按钮不显示 |

它们返回的按钮与 `button()` 一样设置外观（`default`、`hover`、`pressed`、`add()`），需要像素尺寸，但不需要 `onClick()`。

跳转之后，与跳转方向相同的按钮获得默认焦点：连续点击「下一条」或「返回」时，鼠标不动也会落在同一个按钮上（真机）。当前页没有这个方向的按钮时（例如最后一页），bedrock-cui 自动加入的「原地不动」按钮接住这次点击，界面原样重新打开。

## 外框

`layout` 返回各页共用的外框，参数中除了 `page`，还有 props、state、computed、methods 与 `button`，与 `view` 相同。例如在外框中放一个关闭按钮：

```js
layout: ({ page, button, close }) => new Panel().setSize(220, 130).add(
    page,
    button().onClick(close).setSize(12, 12),
),
```

省略 `layout` 时，各页铺满整个屏幕。

## 页面与选项卡

| | 页面（`pages`） | [选项卡](tabs.md)（`Tabs`） |
|---|---|---|
| 切换的方式 | 服务端：界面以那一页重新打开 | 客户端：用开关切换，表单不关闭 |
| 鼠标不动时连续点击 | 每次都落在同一个按钮上 | 第二次点击会落到错误的位置（真机） |
| 切换的速度 | 有约 150 毫秒的过渡 | 立即 |
| 适合 | 「下一页」这类在同一位置连续点击的翻页 | 目录、标签、弹出层这类每次都移动鼠标的切换 |

两者可以同时使用：例如每一页中放一组选项卡。

## 注意

- 跳转时界面重新打开，方法与[事件](logic.md#通知行为包脚本)处理函数在这个过程中运行，其中不要向聊天栏发送消息：表单关闭与重新打开之间发送消息，会使界面消失数秒（真机）。
- 界面打开期间，玩家的视角被锁定，避免点击时视角随鼠标移动；界面关闭时解除。
