# bedrock-cui

[![test](https://github.com/OneFeiFan/bedrock-cui/actions/workflows/test.yml/badge.svg)](https://github.com/OneFeiFan/bedrock-cui/actions/workflows/test.yml)
[![docs](https://github.com/OneFeiFan/bedrock-cui/actions/workflows/docs.yml/badge.svg)](https://onefeifan.github.io/bedrock-cui/)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

用 JavaScript 编写 Minecraft 基岩版的界面：一棵控件树，编译成游戏的 JSON UI，在浏览器中按游戏的排版规则预览，构建时检查常见问题。

> An object-oriented UI framework for Minecraft Bedrock JSON UI, with a pixel-accurate browser preview, build-time lint and a runtime for server forms. Documentation is in Chinese.

- **对象式的界面描述**：控件即对象，属性有类型，不需要手写 JSON UI。
- **与游戏一致的预览**：字形、字宽、折行与叠放顺序，均与 PC 及安卓设备的实际显示核对过。
- **构建时的静态检查**：文字越界、被图片遮挡、只在手机上出现的折行问题等，给出控件路径与偏差的像素数。
- **服务端表单的运行时**：鼠标不动也能连续翻页，运行期文字的跨平台折行，按钮图标。
- **与 sapdon 配合**：新建或接入 [sapdon](https://github.com/Meteage/sapdon) 项目，清单、UUID 与打包由 sapdon 负责。

## 快速开始

需要 Node.js 22.12 或更高版本。

```bash
npx bedrock-cui create my_ui
cd my_ui
npm install
npm run dev      # 在浏览器中预览
npm run build    # 构建附加包；npm run pack 同时打包为 .mcaddon
```

界面写在 `ui/` 中：

```js
import { Anchor, Image, Label, Pages, Panel, Paragraph, Size } from 'bedrock-cui'

export function buildBook() {
    const pages = new Pages('book').startAt('p1').setSize(Size.full())
    pages.page('p1').add(
        new Paragraph('正文按游戏的规则折行，PC 与手机上都排得整齐。', 210).setAnchor(Anchor.TOP_LEFT).setOffset(15, 28),
        pages.serverArrow('p1', 'p2', 'next', (hover) => new Label(hover ? '§e>' : '>'), 16, 12).setAnchor(Anchor.BOTTOM_RIGHT),
    )
    pages.page('p2').add(new Label('第 2 页'))
    return new Panel().setSize(240, 150).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), pages, pages.stayButton())
}
```

行为包脚本打开它：

```js
import { world } from '@minecraft/server'
import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'

const book = new ServerPagesForm(paging['cui_ui:book'])
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:book') book.open(e.source) })
```

已有的 sapdon 项目也可以接入，见手册[在 sapdon 中使用](https://onefeifan.github.io/bedrock-cui/sapdon.html)。

## 文档

手册：<https://onefeifan.github.io/bedrock-cui/>

- [快速上手](https://onefeifan.github.io/bedrock-cui/quick-start.html)：创建项目、预览、构建并在游戏中打开；
- [工作原理](https://onefeifan.github.io/bedrock-cui/how-it-works.html)：原版的服务端表单，以及 bedrock-cui 怎样在它上面显示界面；
- [组件](https://onefeifan.github.io/bedrock-cui/components/panel.html)：每个组件的示例与全部属性、方法；
- [真机规则](https://onefeifan.github.io/bedrock-cui/reference/rules.html)：框架所依据的、在真机上测得的游戏行为。

## 参与开发

见 [CONTRIBUTING.md](CONTRIBUTING.md)。问题与建议请提交到 [Issues](https://github.com/OneFeiFan/bedrock-cui/issues)，报告显示问题时请附上截图、平台与游戏版本。

## 致谢

- [sapdon](https://github.com/Meteage/sapdon)（MIT）：项目结构、构建与打包；服务端表单的挂载方式借鉴自它。
- [GNU Unifont](https://unifoundry.com/unifont/)（SIL OFL 1.1）：字距表与预览字形。
- [Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples)：原版界面定义，用于对照 JSON UI 的结构。

## 许可证

[MIT](LICENSE)。第三方内容见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。bedrock-cui 与 Mojang Studios、Microsoft 没有关联，"Minecraft" 是 Mojang Synergies AB 的商标。
