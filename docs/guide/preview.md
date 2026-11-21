# 浏览器预览

浏览器预览按游戏的排版规则绘制界面，并运行界面的逻辑，修改代码后自动刷新，不需要每次进入游戏。本节介绍预览服务器、与游戏联动、预览的设置与字体、预览与游戏的差异，以及把预览嵌入其他网页的方法。

## bedrock-cui dev

```bash
npm run dev          # 即 bedrock-cui dev
```

预览服务器读取 `cui.config.mjs`，在浏览器中显示项目的全部界面：

- 左侧是界面列表；
- 中间是按游戏规则绘制的预览，下方是静态检查的结果；
- 界面在浏览器中运行它的[逻辑](logic.md)：点击按钮调用方法，状态变化后重新显示，页面跳转与定时器照常工作；发出的事件与 `this.player.sendMessage()` 的消息写进日志（预览中没有行为包脚本处理事件）；
- 动画按时间播放，界面重新显示时从头开始（见[动画](animation.md#在浏览器中)）。

修改界面代码并保存后，预览自动刷新。`--port` 指定端口，默认为 5173。

## 与游戏联动

浏览器预览之外，`bedrock-cui dev --game` 还可以让游戏随着保存自动更新：

1. 运行 `npm run dev:game`（即 `bedrock-cui dev --game`；`--game 端口` 指定端口，默认 19135）；
2. 在游戏中输入 `/connect localhost:19135`，连接成功后终端显示「游戏已连接」；
3. 修改 `ui/`、`res/`、`scripts/` 中的文件或项目配置并保存：bedrock-cui 自动构建，然后让游戏执行 `reload all`，重新加载资源包与行为包。

`/connect` 是游戏连接外部 WebSocket 服务器的命令。连接前，需要在游戏的设置中关闭「要求加密的 WebSocket」。构建结果由 sapdon 复制到游戏的开发包目录，只在 Windows 上自动进行。

以下两点尚待真机确认：使用 `/connect` 是否需要开启作弊；`reload all` 之后，正在显示的界面是否立即采用新的界面文件（可能需要重新打开界面）。

## 预览的数据与设置

预览界面文件时，数据取 `props` 的默认值，以及逻辑运行后计算出的值（见[数据（props）](props.md)）。

模拟的屏幕尺寸在配置的 `preview` 中设置：

```js
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'

export default defineConfig({
    namespace: 'book',
    screens: [ /* …… */ ],
    preview: { viewport: [320, 200] },     // 模拟的屏幕尺寸（界面像素）
})
```

贴图取自配置的 `textures` 目录（默认为 `res`），尺寸与九宫格信息读自 PNG 及其同名的 `.json`。内置的纯白贴图 `Texture.SOLID` 由预览服务器提供。

## 字体

预览按游戏的字形与字宽绘制文字，使用两种点阵字体：GNU Unifont（汉字等）与 Minecraft 默认字体 `ascii.png`（英文）。首次运行 `bedrock-cui dev` 时，两者被下载到 `~/.cache/bedrock-cui/font`：Unifont 从其官方站点下载，`ascii.png` 从本机的 Minecraft Java 版客户端提取，找不到客户端时从 Mojang 官方下载。字体只在本机使用。

环境变量 `BEDROCK_CUI_FONT_DIR` 可以指定其他目录。

## 预览与游戏的差异

- 预览中的点击按位置判断。游戏中鼠标不移动时，点击交给获得默认焦点的控件，[页面](pages.md)中的「原地不动」依赖这一行为，预览中无法模拟。
- 原版贴图（`textures/ui/...` 等）不在项目的 `res` 目录中，预览无法显示。
- 预览默认按 PC 的字宽排版。安卓上的折行见[跨平台](cross-platform.md)。

## 在网页中嵌入预览

预览服务器使用的两个函数可以把预览嵌入其他网页，本手册的在线示例即如此。它们在 `bedrock-cui/web` 中：

- `mountPreview(元素, 选项)` 在元素中画出一棵组件树；
- `runScreenInBrowser(界面, 选项)` 在浏览器中运行界面文件的逻辑。

只显示组件树时，使用 `mountPreview()`：

```js
import { Image, Panel, Size } from 'bedrock-cui'
import { mountPreview } from 'bedrock-cui/web'

const card = new Panel().setSize(120, 40).add(new Image('textures/cui_example/panel').setSize(Size.full()))

mountPreview(document.getElementById('app'), {
    root: card,                          // 根控件，或返回根控件的函数
    viewport: [320, 200],                // 模拟的屏幕尺寸（界面像素）
    scale: 3,                            // 放大倍数
    textures: { 'textures/cui_example/panel': { url: '/res/textures/cui_example/panel.png', size: [16, 16], nineslice: 4 } },
    fonts: { unifont: '/font/unifont.hex.gz' },     // 像素字体的地址；不给时用系统字体
})
```

预览界面文件时，两个函数一起使用。界面的数据写在表单的标题与按钮文字中（见[工作原理](how-it-works.md)），两个函数通过三个信号共享它们：`runScreenInBrowser()` 每次「打开表单」时写入，`mountPreview()` 据此显示。信号由 `signal(初始值)` 创建，值改变时预览随之重画。预览中的点击，由 `onFormButton` 交回运行时：

```js
import { signal } from 'bedrock-cui'
import { mountPreview, runScreenInBrowser } from 'bedrock-cui/web'
import shop from './ui/shop.screen.mjs'

const { root, manifest } = shop.build()
// 表单的标题、按钮文字、按钮图标
const form = { title: signal(''), formButtons: signal([]), formButtonIcons: signal([]) }

let runner
mountPreview(document.getElementById('app'), {
    root, viewport: [320, 200], scale: 3, ...form,
    onFormButton: (i) => runner.click(i),         // 点击了第 i 个表单按钮：交给运行时
})
runner = runScreenInBrowser(shop, {
    manifest, paging: shop.paging(), ...form,
    log: (message) => console.log(message),       // 点击了什么、调用了哪个方法
})
```

各选项见 [API 参考](reference/api-web.md)。
