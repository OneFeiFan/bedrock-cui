# 第三方声明（Third-Party Notices）

bedrock-cui 本身以 MIT 许可证发布（见 [LICENSE](LICENSE)）。下面列出它借鉴或包含的第三方内容。

## sapdon（MIT）

- 项目：<https://github.com/Meteage/sapdon>　作者：Meteage
- 借鉴的内容：
  - **构建与打包**：bedrock-cui 的项目就是 sapdon 项目，清单、UUID 与打包由 sapdon（npm 依赖）完成；`bedrock-cui create` 复制 sapdon 包内的项目模板。
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
- 手册网站（GitHub Pages）的在线示例按 SIL OFL 1.1 原样再发布 `unifont.hex.gz`，附带 `font/LICENSE.txt`。
- OFL 全文：<https://openfontlicense.org/open-font-license-official-text/>

## Minecraft（Mojang Studios）

bedrock-cui 是第三方工具，与 Mojang Studios、Microsoft 没有关联，也未经其认可。"Minecraft" 是 Mojang Synergies AB 的商标。

- `src/font/gameGlyphs.ts`：48 个全角标点 / 符号的 16×16 点阵，**由开发者在自己的游戏里截图逐格还原**（游戏的这些字形与 GNU Unifont 不同），
  用于让浏览器预览与字宽计算和游戏一致。字形来自游戏的渲染结果。
- 不随源码分发：预览用的 `ascii.png`（Minecraft 默认字体），由 `scripts/fetch-fonts.mjs` 从开发者本机的 Minecraft Java 版客户端（或 Mojang 官方下载）提取，只在本机使用。
- 手册网站的在线示例不使用 Mojang 的资源：英文字母也用 Unifont 绘制；界面贴图以 `scripts/build-site.mjs` 生成的近似替代图显示，物品图标以紫黑格占位图显示，不模仿原版的样子。
- 不随源码分发：浏览器预览与测试用到的 12 张原版贴图（物品、`purpleBorder` 等），由 `scripts/fetch-vanilla-textures.mjs` 从 Mojang 的 bedrock-samples 下载，只在本机使用。
- 参考资料：Mojang 的 [bedrock-samples](https://github.com/Mojang/bedrock-samples)（原版界面定义，用于对照 JSON UI 的结构与变量）。

## 开发工具（不随包分发）

TypeScript（Apache-2.0）、Vite（MIT）、@minecraft/server 与 @minecraft/server-ui 的类型声明（MIT）只用于开发与类型检查；
脚本端运行时的性能用 [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten)（MIT）在本机实测过，它不是本项目的依赖。
