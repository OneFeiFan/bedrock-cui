# 浏览器预览

## bedrock-cui dev

```bash
npm run dev          # 即 bedrock-cui dev
```

预览服务器读取 `cui.config.mjs`，在浏览器中显示项目的全部界面：

- 左侧是界面列表；
- 中间是按游戏规则绘制的预览，下方是静态检查的结果；
- 界面文件（`defineScreen`）的界面在浏览器中运行它的[逻辑](logic.md)：点击按钮调用方法，状态变化后重新显示，翻页与定时器照常工作；发出的事件与 `this.player.sendMessage()` 的消息写进日志（预览中没有行为包脚本处理事件）；
- 动画按时间播放，界面重新显示时从头开始（见[动画](animation.md#在浏览器中)）。

修改界面代码并保存后，预览自动刷新。`--port` 指定端口，默认为 5173。

## 预览的数据

界面文件的界面，预览中的数据就是 `props` 的默认值，以及逻辑运行后计算出的值（见[数据（props）](props.md)）。

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

- 预览中的点击按位置判断。游戏中鼠标不移动时，点击交给获得默认焦点的控件，[翻页](paging.md)中的「原地不动」依赖这一行为，预览中无法模拟。
- 原版贴图（`textures/ui/...` 等）不在项目的 `res` 目录中，预览无法显示。
- 预览默认按 PC 的字宽排版。安卓上的折行见[跨平台](cross-platform.md)。

## 在网页中嵌入预览

`mountPreview()`（`bedrock-cui/web`）是预览服务器所使用的底层接口，可以将预览嵌入其他网页，例如本手册的在线示例：

```js
import { mountPreview } from 'bedrock-cui/web'
import { buildBook } from './ui/book.mjs'

mountPreview(document.getElementById('app'), {
    root: buildBook,                       // 根控件，或返回根控件的函数
    viewport: [320, 200],
    scale: 3,
    textures: { 'textures/cui_example/panel': { url: '/res/textures/cui_example/panel.png', size: [16, 16], nineslice: 4 } },
    fonts: { unifont: '/font/unifont.hex.gz', ascii: '/font/ascii.png' },
})
```

表单数据通过 `title`、`formText`、`formButtons` 三个信号（`signal()`）提供；使用服务端翻页的界面，用 `ServerPagesPreview` 处理翻页。各选项见 [API 参考](reference/api-web.md)。
