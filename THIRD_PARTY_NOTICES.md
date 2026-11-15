# 第三方声明（Third-Party Notices）

bedrock-cui 本身以 MIT 许可证发布（见 [LICENSE](LICENSE)）。下面列出它借鉴或包含的第三方内容。

## sapdon（MIT）

- 项目：<https://github.com/Meteage/sapdon>　作者：Meteage
- 借鉴的内容：
  - **附加包打包流程**（`src/node/addon.ts`）：首次构建生成 UUID 并存进项目文件、之后不变；生成资源包与行为包的清单；
    资源包与行为包放进同一个 `.mcaddon`。参照 sapdon 的 `src/cli/build.js`、`src/cli/pack.js`、`src/core/addon/manifest.ts`，
    按 bedrock-cui 的面向对象写法重写，压缩改用 Node 自带的 zlib（不依赖 archiver）。
  - **服务端表单的挂载方式**（`src/mc/serverForm.ts`）：改写原版 `server_form.json` 的 `third_party_server_screen`
    （去掉滑入动画）与 `main_screen_content`、按表单标题显示自定义界面——思路来自 sapdon 的 `serverFormUI`。

```
MIT License

Copyright (c) 2025 Meteage

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## GNU Unifont（SIL Open Font License 1.1）

- 项目：<https://unifoundry.com/unifont/>　许可：GNU GPLv2+（含字体嵌入例外）或 SIL OFL 1.1 双许可，本项目按 **SIL OFL 1.1** 使用。
- 包含的内容：`src/font/unifontWidths.ts`——由 GNU Unifont 16.0.04 的点阵计算出的**字距表**（只有宽度，不含字形）。
- 不随源码分发：预览用的 `unifont.hex.gz`，由 `scripts/fetch-fonts.mjs` 在开发者本机下载。
- OFL 全文：<https://openfontlicense.org/open-font-license-official-text/>

## Minecraft（Mojang Studios）

bedrock-cui 是第三方工具，与 Mojang Studios、Microsoft 没有关联，也未经其认可。"Minecraft" 是 Mojang Synergies AB 的商标。

- `src/font/gameGlyphs.ts`：48 个全角标点 / 符号的 16×16 点阵，**由开发者在自己的游戏里截图逐格还原**（游戏的这些字形与 GNU Unifont 不同），
  用于让浏览器预览与字宽计算和游戏一致。字形来自游戏的渲染结果。
- 不随源码分发：预览用的 `ascii.png`（Minecraft 默认字体），由 `scripts/fetch-fonts.mjs` 从开发者本机的 Minecraft Java 版客户端（或 Mojang 官方下载）提取，只在本机使用。
- 参考资料：Mojang 的 [bedrock-samples](https://github.com/Mojang/bedrock-samples)（原版界面定义，用于对照 JSON UI 的结构与变量）。

## 开发工具（不随包分发）

TypeScript（Apache-2.0）、Vite（MIT）、@minecraft/server 与 @minecraft/server-ui 的类型声明（MIT）只用于开发与类型检查；
脚本端运行时的性能用 [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten)（MIT）在本机实测过，它不是本项目的依赖。
