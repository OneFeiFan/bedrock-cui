# 快速上手

本节演示从创建项目到在游戏中显示可翻页界面的完整流程。

## 创建项目

```bash
mkdir hello && cd hello
npm init -y
npm pkg set type=module
npm install bedrock-cui
npm install -D typescript @minecraft/server @minecraft/server-ui
```

`typescript` 与 `@minecraft/*` 用于构建时对游戏脚本做类型检查。

::: tip
发布到 npm 之前，可通过 `npm install github:OneFeiFan/bedrock-cui` 安装。
:::

项目结构如下：

```
hello/
├─ build.mjs        # 描述界面并打包
└─ scripts/
   └─ main.js       # 游戏脚本，复制到行为包
```

## 描述界面

```js
// build.mjs
import { Anchor, Color, Image, Label, Panel, Paragraph, Size } from 'bedrock-cui'

const card = new Panel().setName('card').setSize(200, 100)
card.add(
    // 背景图，与面板同样大小
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    // 标题：水平居中，距顶部 8 像素
    new Label('欢迎').setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_CENTER).setOffset(0, 8),
    // 正文：在 180 像素处折行
    new Paragraph('正文按给定的宽度折行。', 180).setName('intro').setAnchor(Anchor.TOP_LEFT).setOffset(10, 26),
)
```

`add()` 将控件加入面板。`setXxx()` 返回控件本身，因此可以链式调用。

## 挂载到服务端表单

`CuiApp` 负责挂载界面与打包：

```js {2,8}
import { Anchor, Color, Image, Label, Panel, Paragraph, Size } from 'bedrock-cui'
import { CuiApp } from 'bedrock-cui/node'

const card = new Panel().setName('card').setSize(200, 100)
card.add(/* …… */)

// 命名空间 'hello'；界面 id 'cui_ui:hello'
const app = new CuiApp('hello').screen('cui_ui:hello', card)
```

游戏打开标题以界面 id 开头的服务端表单时，显示对应的界面。

## 打开表单

```js
// scripts/main.js
import { world } from '@minecraft/server'
import { ActionFormData } from '@minecraft/server-ui'

world.afterEvents.itemUse.subscribe((e) => {
    if (e.itemStack.typeId !== 'minecraft:book') return
    // 标题即界面 id
    new ActionFormData().title('cui_ui:hello').body('').show(e.source)
})
```

## 打包

在 `build.mjs` 末尾加上：

```js
await app.build({ out: 'out', title: '你好', scripts: 'scripts' })
```

运行 `node build.mjs`，`out/` 中生成 `hello.mcaddon`。`build()` 完成以下工作：

- 生成资源包与行为包的清单。UUID 写入 `out/hello.uuid.json`，此后的构建沿用同一组 UUID，游戏据此识别为同一个附加包。
- 将 `scripts/` 复制到行为包。
- 对脚本做类型检查。存在错误时（例如将 `show` 写成 `shwo`）构建失败，并给出出错的行。

::: tip
UUID 文件应提交到版本库。可通过 `uuidFile` 选项指定其位置：`app.build({ ..., uuidFile: 'hello.uuid.json' })`。
:::

## 服务端翻页

将正文改为两页，每页放置一个翻页箭头：

```js {1,4-9}
import { Anchor, Color, Image, Label, Pages, Panel, Size } from 'bedrock-cui'
import { CuiApp } from 'bedrock-cui/node'

const pages = new Pages('hello').startAt('p1').setSize(Size.full())
// 第四个参数返回箭头的外观，hover 为 true 时表示悬停状态
pages.page('p1').add(new Label('第 1 页'),
    pages.serverArrow('p1', 'p2', 'next', (hover) => new Label(hover ? '§e>' : '>'), 16, 12).setAnchor(Anchor.BOTTOM_RIGHT))
pages.page('p2').add(new Label('第 2 页'),
    pages.serverArrow('p2', 'p1', 'prev', (hover) => new Label(hover ? '§e<' : '<'), 16, 12).setAnchor(Anchor.BOTTOM_LEFT))
const card = new Panel().setSize(200, 100).add(pages, pages.stayButton())

await new CuiApp('hello').screen('cui_ui:hello', card).build({ out: 'out', title: '你好', scripts: 'scripts' })
```

脚本中使用 `ServerPagesForm` 处理翻页：

```js {1-2,5,8}
import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'
import { world } from '@minecraft/server'

const book = new ServerPagesForm(paging['cui_ui:hello'])

world.afterEvents.itemUse.subscribe((e) => {
    if (e.itemStack.typeId === 'minecraft:book') book.open(e.source)
})
```

`cui.generated.js` 由构建生成，包含各界面的翻页路由，不应手动修改。

点击箭头时，表单关闭，脚本随即以新的页码重新打开表单。重新打开时，刚才点击方向上的箭头获得默认焦点，因此鼠标不移动也可以连续翻页。在最后一页继续点击时，点击由 `stayButton()` 创建的不可见按钮接收，表单停留在当前页。

::: details 为什么不在客户端翻页
JSON UI 可以通过开关在客户端切换页，目录和书签即采用这种方式。但游戏只在鼠标移动时重新判断悬停的控件，鼠标不动时再次点击会落到错误的位置。服务端翻页通过重新打开表单重设焦点，不存在这一问题。
:::

## 静态检查

构建时，静态检查的结果输出到终端。例如，对面板调用 `setContain()`（要求子控件不越出面板），并将正文的折行宽度改为 260：

```js
const card = new Panel().setName('card').setSize(200, 100).setContain()
// ……
new Paragraph('……', 260).setName('intro')
```

输出如下：

```
[bedrock-cui] 警告 out-of-bounds root/panel0/card/intro：越出 root/panel0/card 的安全区（右 70 像素）
```

路径由控件名组成。未命名的控件按类型和顺序自动命名（如 `label1`），因此建议为需要定位的控件设置名称。警告不影响构建；错误会使构建失败。

## 下一步

- [控件与组件树](elements.md)
- 在 sapdon 项目中使用：见 [examples/sapdon-project](../../examples/sapdon-project)
