# 快速上手

本节演示用命令行创建项目、在浏览器中预览界面、再构建附加包并在游戏中打开的完整流程。

## 两部分工作

使用 bedrock-cui 时的工作分为两部分：

- **描述界面**：用控件搭建界面，写在 `ui/` 目录中。这一部分只涉及 JavaScript，在浏览器中预览即可，不需要进入游戏。
- **挂到游戏里**：界面通过服务端表单显示，由行为包脚本打开。这一部分涉及附加包，见「挂到游戏里」一章。

本节先完成第一部分；第二部分使用项目自带的脚本，不需要修改。

## 创建项目

```bash
npx bedrock-cui create my_ui
cd my_ui
npm install
```

::: tip
发布到 npm 之前，先全局安装：`npm install -g github:OneFeiFan/bedrock-cui`，再运行 `bedrock-cui create my_ui`。
:::

生成的项目结构如下：

```
my_ui/
├─ cui.config.mjs        # 项目配置：有哪些界面
├─ ui/book.mjs           # 示例界面：一本两页的小书
├─ scripts/index.js      # 行为包脚本：打开界面
├─ main.mjs              # 构建入口
├─ res/                  # 资源包文件（贴图等）
└─ build.config、mod.info # sapdon 的项目设置
```

bedrock-cui 的项目同时是一个 [sapdon](https://github.com/Meteage/sapdon) 项目：bedrock-cui 负责界面与预览，清单、UUID 与打包由 sapdon 负责。

## 在浏览器中预览

```bash
npm run dev
```

打开终端中显示的地址（默认为 `http://localhost:5173`）。页面左侧列出项目中的界面，中间是按游戏规则绘制的预览，下方是静态检查的结果，右侧可以编辑表单的标题、正文与按钮文字。首次运行时会下载预览所需的字体。

修改 `ui/book.mjs` 并保存后，预览自动刷新。

## 描述界面

在 `ui/` 中新建 `card.mjs`，描述一块带标题和正文的面板：

```js preview=buildCard() 220x120
// ui/card.mjs
import { Anchor, Color, Image, Label, Panel, Paragraph, Size } from 'bedrock-cui'

export function buildCard() {
    const card = new Panel().setName('card').setSize(200, 100)
    card.add(
        // 背景图，与面板同样大小
        new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
        // 标题：水平居中，距顶部 8 像素
        new Label('欢迎').setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_CENTER).setOffset(0, 8),
        // 正文：在 180 像素处折行
        new Paragraph('正文按给定的宽度折行。', 180).setName('intro').setAnchor(Anchor.TOP_LEFT).setOffset(10, 26),
    )
    return card
}
```

`add()` 将控件加入面板。`setXxx()` 返回控件本身，因此可以链式调用。各类控件与布局方式见「搭建界面」一章。

在配置中登记这个界面：

```js {3,8}
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'
import { buildBook } from './ui/book.mjs'
import { buildCard } from './ui/card.mjs'

export default defineConfig({
    namespace: 'book',
    screens: {
        'cui_ui:book': () => buildBook(),
        'cui_ui:card': () => buildCard(),
    },
    textures: ['res'],
})
```

`screens` 中的键是界面 id，值是返回根控件的函数。预览页面的界面列表中随即出现 `cui_ui:card`。

## 静态检查

预览页面下方显示静态检查的结果。例如，对面板调用 `setContain()`（要求子控件不越出面板），并将正文的折行宽度改为 260：

```js
const card = new Panel().setName('card').setSize(200, 100).setContain()
// ……
new Paragraph('……', 260).setName('intro')
```

预览页面与构建时均会给出：

```
警告 out-of-bounds root/panel0/card/intro：越出 root/panel0/card 的安全区（右 70 像素）
```

路径由控件名组成。未命名的控件按类型和顺序自动命名（如 `label1`），因此建议为需要定位的控件设置名称。警告不影响构建；错误会使构建失败。

## 构建并在游戏中打开

```bash
npm run build      # 构建，结果在 dev/ 中
npm run pack       # 构建并打包为 dev/my_ui.mcaddon
```

在 Windows 上，`npm run build` 还会将资源包与行为包复制到游戏的开发包目录。在游戏中新建世界并启用这两个包，手持书右键，即显示示例小书。

打开界面的是 `scripts/index.js`：

```js
import { world } from '@minecraft/server'
import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'

const book = new ServerPagesForm(paging['cui_ui:book']).setButtons(() => ({ 0: 'close|' }))

world.afterEvents.itemUse.subscribe((e) => {
    if (e.itemStack.typeId === 'minecraft:book') book.open(e.source)
})
```

脚本打开一个标题为界面 id 的服务端表单，游戏随即显示对应的界面。`cui.generated.js` 由构建生成，包含各界面的翻页路由。这一部分的原理见[附加包与服务端表单基础](addon-basics.md)。
