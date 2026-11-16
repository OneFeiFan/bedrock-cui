# 快速上手

本节演示创建项目、在浏览器中预览界面、构建附加包并在游戏中打开的完整流程。界面怎样显示在游戏中，见[工作原理](how-it-works.md)。

## 安装

需要 Node.js 22.12 或更高版本。bedrock-cui 有两种安装方式：

- **新建项目**：用命令行创建一个已经配置好的项目（一个使用 bedrock-cui 的 [sapdon](https://github.com/Meteage/sapdon) 项目），附带一个示例界面。本节使用这种方式。
- **加入已有的 sapdon 项目**：在项目中执行 `npm install bedrock-cui`，再添加配置文件，见[在 sapdon 中使用](sapdon.md)。

新建项目：

```bash
npx bedrock-cui create my_ui
cd my_ui
npm install
```

生成的项目结构如下：

```
my_ui/
├─ cui.config.mjs        # 项目配置：登记有哪些界面
├─ ui/book.mjs           # 示例界面：一本两页的小书
├─ scripts/index.js      # 行为包脚本：打开界面
├─ main.mjs              # 构建入口（sapdon）
├─ res/                  # 资源包中的文件（贴图等）
└─ build.config、mod.info # sapdon 的项目设置
```

使用 bedrock-cui 时的工作分为两部分：

- **描述界面**：用控件搭建界面，写在 `ui/` 目录中。这部分只涉及 JavaScript，在浏览器中预览即可，不需要进入游戏。
- **挂到游戏里**：行为包脚本打开服务端表单，游戏在表单上显示界面。新建的项目已经包含这部分的脚本，本节不需要修改它。

## 在浏览器中预览

```bash
npm run dev
```

打开终端中显示的地址（默认为 `http://localhost:5173`）。页面左侧列出项目中的界面，中间是按游戏规则绘制的预览，下方是静态检查的结果，右侧可以修改模拟的表单内容。首次运行时会下载预览所需的字体。

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

`card.add(…)` 把括号中的控件加入面板 `card`。每个 `setXxx(…)` 方法设置一项属性并返回控件本身，因此可以连续调用。控件与布局见「搭建界面」一章。

## 登记界面

界面要在配置中登记后，预览和构建才会包含它。打开 `cui.config.mjs`，加入标有 `← 新增` 的两行：

```js
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'
import { buildBook } from './ui/book.mjs'
import { buildCard } from './ui/card.mjs'                 // ← 新增

export default defineConfig({
    namespace: 'book',
    screens: {
        'cui_ui:book': () => buildBook(),
        'cui_ui:card': () => buildCard(),                // ← 新增
    },
    textures: ['res'],
})
```

`screens` 的每一项登记一个界面：键是界面 id，值是返回界面的函数。预览页面的界面列表中随即出现 `cui_ui:card`。

## 静态检查

预览页面下方显示静态检查的结果。例如，对面板调用 `setContain()`，表示其中的控件不得越出面板；再把正文的折行宽度改为 260：

```js
const card = new Panel().setName('card').setSize(200, 100).setContain()
// ……
new Paragraph('……', 260).setName('intro')
```

预览页面与构建时都会给出：

```
警告 out-of-bounds root/panel0/card/intro：越出 root/panel0/card 的安全区（右 70 像素）
```

路径由控件的名称组成（`setName(…)` 设置的名称）。未设置名称的控件按类型和顺序自动命名（如 `label1`），因此建议为需要定位的控件设置名称。警告不影响构建；错误会使构建失败。

## 构建并在游戏中打开

```bash
npm run build      # 构建，结果在 dev/ 中
npm run pack       # 构建并打包为 dev/my_ui.mcaddon
```

在 Windows 上，`npm run build` 还会把资源包与行为包复制到游戏的开发包目录。在游戏中新建世界并启用这两个包，手持书右键，即显示示例小书。

显示小书的过程是：行为包脚本 `scripts/index.js` 打开一个标题为 `cui_ui:book` 的服务端表单；资源包中 bedrock-cui 生成的界面定义识别出这个界面 id，在表单上显示 `buildBook()` 返回的界面。

```js
// scripts/index.js
import { world } from '@minecraft/server'
import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'

const book = new ServerPagesForm(paging['cui_ui:book']).setButtons(() => ({ 0: 'close|' }))

world.afterEvents.itemUse.subscribe((e) => {
    if (e.itemStack.typeId === 'minecraft:book') book.open(e.source)
})
```

示例小书有翻页功能，所以脚本使用 bedrock-cui 提供的 `ServerPagesForm`（它在内部使用 `ActionFormData`）打开表单；`cui.generated.js` 由构建生成，包含翻页所需的信息。翻页的原理见[翻页](paging.md)。要打开新登记的 `cui_ui:card`，脚本中写 `new ActionFormData().title('cui_ui:card').body('').show(player)` 即可。
