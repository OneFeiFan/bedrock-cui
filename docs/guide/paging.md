# 翻页

## 服务端翻页的原理

[开关与分页](pages.md)介绍了客户端翻页及其限制：游戏只在鼠标移动时重新判断悬停的控件，鼠标不动时连续点击会落到错误的位置。

服务端翻页的做法是：点击翻页箭头时关闭表单，脚本以新的页码重新打开表单。重新打开时，焦点重新设定，因此鼠标不移动也可以连续翻页。由于表单关闭与重新打开之间的间隔很短，看起来与翻页无异。

## 构建端

`pages.serverArrow(从哪页, 到哪页, 方向, 外观, 宽, 高)` 创建翻页箭头：

```js
import { Anchor, Label, Pages, Panel, Size } from 'bedrock-cui'

const pages = new Pages('book').startAt('p1').setSize(Size.full())
const arrow = (from, to, dir) => pages
    .serverArrow(from, to, dir, (hover) => new Label(hover ? `§e${dir === 'next' ? '>' : '<'}` : dir === 'next' ? '>' : '<'), 16, 12)
    .setAnchor(dir === 'next' ? Anchor.BOTTOM_RIGHT : Anchor.BOTTOM_LEFT)

pages.page('p1').add(new Label('第 1 页'), arrow('p1', 'p2', 'next'))
pages.page('p2').add(new Label('第 2 页'), arrow('p2', 'p1', 'prev'), arrow('p2', 'p3', 'next'))
pages.page('p3').add(new Label('第 3 页'), arrow('p3', 'p2', 'prev'))

const root = new Panel().setSize(200, 120).add(pages, pages.stayButton())
```

每个箭头由两个序号相同的[表单按钮](server-form.md#表单按钮)组成：普通按钮（默认焦点优先级 10）始终显示；高优先级按钮（100）只在该箭头位于刚才点击的方向时显示。脚本重新打开表单时，后者获得默认焦点。

`stayButton()` 创建一个不可见的表单按钮，优先级为 50。当前页没有该方向的箭头时（例如在最后一页点击「下一页」的位置），点击落在这个按钮上，脚本原样重新打开当前页。

箭头和 `stayButton()` 的序号由 `Pages` 自动分配，默认从 10 开始。界面自己的表单按钮使用 0 到 9；需要更多时，用 `setButtonBase(n)` 调整起始序号（应在第一个 `serverArrow()` 之前调用）。

## 脚本端

构建时，每个界面的翻页路由写入 `cui.generated.js`。脚本用它创建 `ServerPagesForm`：

```js
import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'

const book = new ServerPagesForm(paging['cui_ui:book'])
    .setButtons((player, page) => ({ 0: 'close|' }))        // 界面自己的表单按钮：序号 → 文字
    .setBody((player, page) => '')                          // 表单正文
    .onSelect((player, index, page) => { /* 点击了非翻页按钮，表单已关闭 */ })
    .onClose((player, page) => { /* 玩家按 Esc 关闭了表单 */ })

book.open(player)                  // 打开初始页
book.open(player, 'p2')            // 打开指定的页
```

`ServerPagesForm` 负责以下工作：

- 标题写入页码；
- 设置箭头按钮的文字，使刚才点击方向上的箭头获得默认焦点；
- 处理 `stayButton()` 的点击；
- 表单打开期间锁定视角，关闭时解除（`setLockCamera(false)` 可取消）。

::: warning
翻页过程中（表单关闭到重新打开之间），脚本不应向聊天栏发送消息，也不应重复设置玩家的输入权限。否则进入世界后的第一次翻页，界面会消失数秒（真机测试）。`ServerPagesForm` 本身不做这两件事；在 `setButtons()`、`setBody()` 的回调中也应避免。
:::

上次退出游戏时表单仍处于打开状态，视角可能保持锁定。脚本启动时可以统一解除：

```js
import { system, world } from '@minecraft/server'
import { lockCamera } from 'bedrock-cui/runtime/server-pages'

system.run(() => { for (const p of world.getAllPlayers()) lockCamera(p, false) })
```

## 在预览中翻页

浏览器预览中，`ServerPagesPreview`（`bedrock-cui/web`）模拟同样的过程，其逻辑与 `ServerPagesForm` 相同。
