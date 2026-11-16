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
├─ ui/book.screen.mjs    # 示例界面：一本两页的小书
├─ scripts/index.js      # 行为包脚本：什么时候打开界面
├─ main.mjs              # 构建入口（sapdon）
├─ res/                  # 资源包中的文件（贴图等）
└─ build.config、mod.info # sapdon 的项目设置
```

一个界面写在一个文件里（`ui/*.screen.mjs`），文件中分为三块：

- **数据**（`props`）：界面显示的数据与默认值。行为包脚本打开界面时可以传入别的值；
- **逻辑**（`methods` 等）：在游戏中运行，例如点击按钮后做什么；
- **视图**（`view`）：返回控件树，即界面的样子。视图在构建时运行一次，编译为游戏读取的界面文件。

浏览器预览只需要视图；逻辑在游戏中运行。界面怎样显示在游戏中，见[工作原理](how-it-works.md)。

## 在浏览器中预览

```bash
npm run dev
```

打开终端中显示的地址（默认为 `http://localhost:5173`）。页面左侧列出项目中的界面，中间是按游戏规则绘制的预览，下方是静态检查的结果，右侧可以修改模拟的表单内容。首次运行时会下载预览所需的字体。

修改 `ui/book.mjs` 并保存后，预览自动刷新。

## 新建一个界面

在 `ui/` 中新建 `card.screen.mjs`，描述一块带问候语和正文的面板：

```js preview=card 220x120
// ui/card.screen.mjs
import { Anchor, Color, Image, Label, Panel, Paragraph, Size, defineScreen } from 'bedrock-cui'

const card = defineScreen({
    id: 'cui_ui:card',

    // 数据：问候语，默认为「欢迎」
    props: { greeting: '欢迎' },

    // 视图
    view({ props }) {
        return new Panel().setName('card').setSize(200, 100).add(
            // 背景图，与面板同样大小
            new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
            // 问候语：显示 props.greeting，水平居中，距顶部 8 像素
            new Label(props.greeting).setColor(Color.hex('#3c2814')).setSize(120, 10).setAnchor(Anchor.TOP_CENTER).setOffset(0, 8),
            // 正文：在 180 像素处折行
            new Paragraph('正文按给定的宽度折行。', 180).setName('intro').setAnchor(Anchor.TOP_LEFT).setOffset(10, 26),
        )
    },
})
export default card
```

- `defineScreen({ … })` 定义一个界面。`id` 是界面 id：脚本打开表单时，表单的标题就是它；
- `new Panel()` 创建一块面板，`.add(…)` 把括号中的控件加入面板。每个 `setXxx(…)` 设置一项属性并返回控件本身，因此可以连续调用；
- `props.greeting` 表示「数据中的 greeting」：预览中显示默认值「欢迎」，游戏中显示脚本传入的值。显示数据的控件需要像素尺寸（这里是 `setSize(120, 10)`）。

这个界面没有逻辑，所以只有数据和视图两块。控件与布局见「搭建界面」一章。

## 登记界面

界面要在配置中登记后，预览和构建才会包含它。打开 `cui.config.mjs`，加入标有 `← 新增` 的两处：

```js
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'
import book from './ui/book.screen.mjs'
import card from './ui/card.screen.mjs'                 // ← 新增

export default defineConfig({
    namespace: 'book',
    screens: [book, card],                             // ← 新增 card
    textures: ['res'],
    preview: { viewport: [320, 200] },
})
```

`screens` 列出项目中的界面。预览页面的界面列表中随即出现 `cui_ui:card`。

## 静态检查

预览页面下方显示静态检查的结果。例如，对面板调用 `setContain()`，表示其中的控件不得越出面板；再把正文的折行宽度改为 260：

```js
new Panel().setName('card').setSize(200, 100).setContain()
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

在 Windows 上，`npm run build` 还会把资源包与行为包复制到游戏的开发包目录。在游戏中新建世界并启用这两个包，手持书右键，即显示示例小书，第 1 页显示你的名字。

决定什么时候打开界面的，是行为包脚本 `scripts/index.js`：

```js
// scripts/index.js
import { world } from '@minecraft/server'
import './cui.generated.js'                    // 构建生成：登记项目中的界面，之后 open() 可用
import book from '../ui/book.screen.mjs'

world.afterEvents.itemUse.subscribe((e) => {
    // 打开界面，并传入 props：第 1 页显示玩家的名字
    if (e.itemStack.typeId === 'minecraft:book') book.open(e.source, { reader: `你好，${e.source.name}` })
})
```

- `import './cui.generated.js'`：导入构建生成的文件。它记录了每个界面的数据与按钮怎样传递，导入之后，界面的 `open()` 才能使用；
- `book.open(玩家, { … })`：为玩家打开界面。第二个参数是传给界面的数据，没有传的取默认值。打开的过程中，bedrock-cui 以界面 id 为标题打开一个服务端表单，并把数据写进表单。

要打开新建的 `cui_ui:card`，在脚本中导入 `../ui/card.screen.mjs`，再调用 `card.open(玩家, { greeting: '你好' })`。
