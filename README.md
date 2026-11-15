# bedrock-cui

[![test](https://github.com/OneFeiFan/bedrock-cui/actions/workflows/test.yml/badge.svg)](https://github.com/OneFeiFan/bedrock-cui/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Minecraft 基岩版 JSON UI 的面向对象 UI 框架。** 用 TypeScript / JavaScript 写一棵组件树，同时得到：

- **基岩版 JSON UI**（挂到原版服务端表单 `ActionFormData` 上，脚本打开即显示）；
- **浏览器预览**——按游戏的排版规则画：Unifont 点阵、字宽、折行、叠放顺序都与真机逐像素核对过；
- **静态检查**——越界、重叠、文字被盖住、只在安卓上出现的问题……在进游戏之前就报出来；
- **脚本端运行时**——服务端表单的混合翻页、跨平台软换行；
- **打包**——独立打成 `.mcaddon`（清单、固定 UUID），或嵌入 [sapdon](https://github.com/Meteage/sapdon) 的构建。

> An object-oriented UI framework for Minecraft Bedrock JSON UI: one component tree → JSON UI + a pixel-accurate browser preview + lint,
> plus a script-side runtime (hybrid server-form paging, cross-platform soft wrapping) and `.mcaddon` packaging.
> Documentation is currently in Chinese.

框架里的每一条「游戏怎么画、怎么折行、怎么叠放」的规则，都来自在 PC 与安卓真机上的反复实测（见 [docs/DESIGN.md](docs/DESIGN.md)）。

## 安装

```bash
npm install bedrock-cui
```

需要 Node.js ≥ 20.19 或 ≥ 22.12。发布到 npm 之前，可以从源码使用：

```bash
git clone https://github.com/OneFeiFan/bedrock-cui.git
cd bedrock-cui
npm install && npm run build
```

## 快速开始

[examples/hello-book.mjs](examples/hello-book.mjs) 是一个完整的最小例子：两页的小书、服务端翻页箭头、软换行的正文，界面、脚本、打包都在一个文件里。

```js
import { Anchor, Color, Label, Pages, Panel, Paragraph, Size } from 'bedrock-cui'
import { CuiApp } from 'bedrock-cui/node'

const ID = 'cui_ui:hello_book'                          // 表单标题以它开头时显示这个界面
const pages = new Pages('hb').startAt('p1').setSize(Size.full())
pages.page('p1').add(
    new Paragraph('这是用 CUI 做的一本小书……', 210).setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_LEFT).setOffset(15, 28),
    pages.serverArrow('p1', 'p2', 'next', (hover) => new Label(hover ? '§e>' : '>'), 16, 12).setAnchor(Anchor.BOTTOM_RIGHT),
)
// ……第二页同理
const root = new Panel().setSize(240, 150).add(pages, pages.stayButton())

// 挂界面、导出翻页路由、清单与 UUID、运行时、.mcaddon、脚本类型检查，一步完成
await new CuiApp('hello_book').screen(ID, root).build({ out: 'out', title: 'CUI 小书', scripts: 'scripts' })
```

行为包脚本（`scripts/main.js`）：

```js
import { world } from '@minecraft/server'
import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'           // 构建时生成：界面 id → 翻页路由表

const book = new ServerPagesForm(paging['cui_ui:hello_book'])
    .setButtons(() => ({ 0: 'close|' }))                // 界面自己的表单按钮
    .onSelect((player, index) => { /* 点了非翻页按钮 */ })
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:book') book.open(e.source) })
```

```bash
node examples/hello-book.mjs out      # 克隆本仓库时先 npm install && npm run build
```

## 在 sapdon 项目里使用

bedrock-cui 可以嵌入 [sapdon](https://github.com/Meteage/sapdon) 的构建：项目结构、清单、UUID、脚本打包、部署都由 sapdon 负责，bedrock-cui 只登记界面。

```ts
// main.ts（sapdon 项目的入口）
import * as sapdon from '@sapdon/core'
import { CuiApp } from 'bedrock-cui/node'
import { buildBook } from './ui/book.js'

new CuiApp('my_book').screen('cui_ui:my_book', buildBook()).useSapdon(sapdon)
```

- 界面 JSON 在 sapdon 的提交前钩子里登记进注册表，`_ui_defs` 交给 `UISystemRegistry` 合并；
- 翻页路由表写成 `scripts/cui.generated.js`（附 `.d.ts`），行为包脚本的写法与上面完全相同，sapdon 的 rollup 会连同 `bedrock-cui/runtime` 一起打包；
- 字形图写进 `res/`（`res/` 在项目代码运行之前同步，字形图变了需要再构建一次）；
- 不要同时使用 sapdon 自带的服务端表单界面（`ServerFormUI`）：两者都改写 `ui/server_form.json`，会报错提示。

完整的接入步骤见 [examples/sapdon-project](examples/sapdon-project)（已在 sapdon 3.7.1 上实测）。

## 核心概念

### 组件树与面向对象 API

元素就是类的实例：`Panel`、`Image`、`Label`、`Button`、`Toggle`、`Stack`、`Grid`、`Row` / `Column`（弹性布局）、`Scroll`、
`CollectionItem`，以及组件 `Pages`、`Paragraph`、`Text`（行内图标）、`FormButton`、`FormGate`。

- 构造函数只收必要的参数；尺寸、锚点、颜色用有类型的值（`Size`、`Length`、`Anchor`、`Color`、`Insets`、`Texture`、`TextStyle`）。
- **每个选项都有同名属性与链式 `setXxx()`**，`set({...})` 一次设置多项（自动转换类型）：

  ```js
  label.color = Color.WHITE
  label.setColor(Color.WHITE).setLayer(2)
  label.set({ color: Color.WHITE, layer: 2, shadow: true })
  ```
- 自定义组件 = 继承内置类；一个元素只能有一个父元素（要出现在两处用 `clone()`）。
- 动态内容用表达式：`form.title`、`form.text`、`form.buttonText`（服务端表单的标题、正文、按钮文字）、`toggleState(name)`，
  支持 `contains()`、`minus()`、`not()` 等，编译成 JSON UI 绑定。

### 挂到服务端表单

`serverForm({ namespace, panelId, content })` 生成界面 JSON 与对原版 `server_form.json` 的改写：脚本 `new ActionFormData().title(panelId…)` 打开表单时，
显示你的界面而不是原版长表单。一个命名空间可以挂多个界面（`panels: [...]`）。缺省是**静态界面**（所有页面一开始就创建；默认聚焦可靠）。

### 翻页：客户端开关 + 服务端箭头（混合翻页）

- **目录、书签、弹层**：`pages.link(key)` / `pages.attach(key, toggle)` —— 开关在客户端即时切换，不关表单。
- **翻页箭头**：`pages.serverArrow(from, to, 'next' | 'prev', art, w, h)` —— 点了关表单，脚本按新页码重开。两个同序号的表单按钮（优先级 10 与 100），
  脚本重开时给刚才点击方向的箭头默认聚焦，**鼠标不动也能连续翻页**；`pages.stayButton()` 接住「当前方向没有箭头」时的点击。
- **脚本端**：`ServerPagesForm`（`bedrock-cui/runtime/server-pages`，复制进行为包后是 `./cui/runtime/serverPages.js`）照真机结论处理一切：
  标题写页码、默认聚焦、原地不动、打开期间锁视角、**翻页过程中不发聊天消息**（否则进入地图后第一次翻页界面会消失一阵子）。
- 预览里用 `ServerPagesPreview`（`bedrock-cui/web`），与脚本端同一套逻辑。

### 文字

- **游戏只在空格处换行**（PC 与安卓都是）：「单词」一整行放得下就整个移到下一行——中英混排时会留下半行。
- **`Paragraph`（缺省软换行）**：交给游戏折行，CUI 只调整汉字与英文 / 数字交界处的间隔（不留 / 不换行空格 / 普通空格），
  按 PC 与安卓的折行模拟择优：游戏用**当前平台的真实字宽**逐字排满，标点不落到行首。`setWrap('hard')` = CUI 按 PC 字宽排好每一行。
- **运行期文字**（脚本生成）：`softWrap(text, width)`（`bedrock-cui/runtime`），同一套规则，在 QuickJS 上一段十几毫秒，结果有缓存。
- **`Text` + `InlineIcon`**：文字里插图标（图片控件，清晰、颜色正确、与文字同高）；换行按最宽的平台算，各段位置交给游戏。
- **`GlyphSheet`**（emoji 字形页 E2–F8）：服务端运行期文字里显示图标，配合 `setLineSpacing(6)`。

### 跨平台字宽

PC 的汉字是 Unifont 点阵（汉字 8.5、全角逗号 2）；**安卓是平滑字体（全宽字符 9、粗体每字 +1）**。字宽档案 `'pc'` / `'android'`
（`setMetricsProfile`、`withMetricsProfile`）用于排版、静态检查与预览；静态检查缺省按两个平台各排一次。预览地址加 `?platform=android` 看安卓上的折行。

### 静态检查

`serverForm` / `compileNamespace` 返回 `issues`。规则：

`bad-size` `collection-index` `collection-item-size` `collection-ref-outside` `collection-through-toggle` `duplicate-name`
`engine-wrap-short-line` `flex-overflow` `glyph-line-overlap` `grow-outside-flex` `inline-icon-in-label` `keep-ratio` `mixed-sources`
`nineslice-too-small` `obfuscated-unifont` `out-of-bounds` `runtime-text-unbounded` `scroll-in-collection` `stack-cross-c`
`text-covered` `text-overflow` `text-overlap` `toggle-index` `toggle-name-unique`

例如 `text-covered`：游戏同一层里**按材质分批画，先在控件树里出现的批先画**——文字的层级不高于与它重叠的图片、且这种贴图先出现，文字就会被盖住。

### 浏览器预览

```bash
npm install
node scripts/fetch-fonts.mjs     # 准备预览字体（GNU Unifont 与 Java 版 ascii.png；只在本机使用，不随源码分发）
npm run dev                      # 预览：?scale=5 放大、?platform=android 安卓字宽、?demo=responsive 响应式演示
```

在你自己的页面里：`mountPreview(element, { root, textures, title, formButtons, ... })`（`bedrock-cui/web`）。

### 打包

**`CuiApp`**（`bedrock-cui/node`）：`screen(界面 id, 根元素)` 挂界面，`setTextures()` 给贴图信息，`glyphSheet()` 生成字形图；然后二选一——
`build({ out, title, version, uuidFile, scripts, resources })` 独立打包成 `.mcaddon`（清单、固定 UUID、运行时、脚本里 `bedrock-cui/runtime…` 改写成包内相对路径、
`cui.generated.js`、脚本类型检查），或 `useSapdon(sapdon)` 嵌入 sapdon 的构建。`compile()` 只编译不写文件（界面文件、翻页路由、检查结果）。

底层工具：`Addon`（清单、UUID 文件、`pack()`；不依赖第三方压缩库）、`checkScripts(行为包目录)`（TypeScript 编译器接口做类型检查）、
`textureInfoFrom()`（读贴图尺寸与九宫格）、`renderGlyphSheet()`（生成字形图）。构建工具与测试在 Windows、macOS、Linux 上都只要 Node.js。

## 真机规则摘要

| 方面 | 结论 |
|---|---|
| 挂载 | 原版 `main_screen_content` 是 0×0；CUI 把它与工厂面板设成 100%、左上锚点，百分比布局才生效 |
| 翻页 | 静态界面 + 混合翻页；路由界面的默认聚焦不可靠 |
| 叠放 | 先按层级；同一层按材质分批，先出现的批先画；文字缺省比底板高一层 |
| 折行 | 只在空格处换行；不换行空格判断宽度按 9、画 4；零宽空格、发丝空格显示成方框 |
| 字形 | 8 高的字形在 10 高的行里居中；`line_padding` 每行都多占 n、文字居中 |
| 字宽 | PC：Unifont 点阵、48 个标点与 Unifont 不同；安卓：全宽 9、粗体 +1 |
| 性能 | 脚本跑在 QuickJS 上，一次折行模拟约 0.65 毫秒——脚本端的计算要按这个量级设计 |

## 项目结构

```
src/core        组件、表达式、值类型、字形图标、混合翻页的约定
src/components  Pages、Paragraph、Text、FormButton、Row / Column、Scroll……
src/layout      排版引擎（预览与静态检查共用）
src/font        字宽、折行模拟、软换行、Unifont 字距表
src/mc          JSON UI 编译、服务端表单挂载、静态检查
src/web         浏览器预览（像素字体渲染、ServerPagesPreview）
src/runtime     脚本端运行时（softWrap、ServerPagesForm）
src/node        构建：CuiApp（独立打包 / 嵌入 sapdon）、Addon、checkScripts、字形图、贴图信息
examples        hello-book（最小例子）、sapdon-project（嵌入 sapdon）、toggle-book + build-toggle-test（真机测试包）、responsive-demo
preview-src     预览程序（npm run dev）
docs            DESIGN.md（设计与全部真机测试记录）
```

## 开发

```bash
git clone https://github.com/OneFeiFan/bedrock-cui.git && cd bedrock-cui
npm install
npm test                                   # 编译 + 测试（包括 PC 与安卓折行的真机回归）；CI 在 Ubuntu 与 Windows、Node 20 / 22 上跑
node examples/build-toggle-test.mjs out    # 真机测试包 out/cui_toggle_test.mcaddon（书 = 测试书，纸 = 响应式演示）
```

## 致谢

- **[sapdon](https://github.com/Meteage/sapdon)**（MIT，Meteage）——附加包打包流程与服务端表单的挂载方式借鉴自它。bedrock-cui 也计划作为 sapdon 的 UI 依赖。
- **[GNU Unifont](https://unifoundry.com/unifont/)**（SIL OFL 1.1）——字距表由它的点阵计算；预览用它的字形。
- **[Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples)**——原版界面定义，用于对照 JSON UI 的结构与全局变量。
- **[Bedrock Wiki](https://wiki.bedrock.dev/)**——JSON UI 与脚本 API 的社区文档。
- **[quickjs-emscripten](https://github.com/justjake/quickjs-emscripten)**——在本机实测脚本端运行时的性能。

## 反馈

问题与建议请到 [Issues](https://github.com/OneFeiFan/bedrock-cui/issues)。报告游戏里的显示问题时，附上真机截图、平台（PC / 安卓 / iOS / 主机）与游戏版本最有帮助——
框架里的规则都是这样一条条测出来的。

## 许可证

[MIT](LICENSE)。第三方内容见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

bedrock-cui 与 Mojang Studios、Microsoft 没有关联。"Minecraft" 是 Mojang Synergies AB 的商标。
