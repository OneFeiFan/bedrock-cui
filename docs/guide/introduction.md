# 简介

## 什么是 bedrock-cui

bedrock-cui 是一个用于编写 Minecraft 基岩版界面的 JavaScript 框架。界面由对象组成的树描述，框架将其编译为游戏使用的 JSON UI，同时提供按游戏规则绘制的浏览器预览和构建时的静态检查。

下面是一个最基本的示例：

```js preview=card 220x120
import { Anchor, Color, Image, Label, Panel, Paragraph, Size } from 'bedrock-cui'

const card = new Panel().setSize(200, 100)
card.add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label('欢迎').setColor(Color.hex('#3c2814')).setAnchor(Anchor.TOP_CENTER).setOffset(0, 8),
    new Paragraph('正文按给定的宽度折行。', 180).setAnchor(Anchor.TOP_LEFT).setOffset(10, 26),
)
```

将该面板挂载到界面 id `cui_ui:hello` 后，脚本以此为标题打开服务端表单时，游戏显示的是这块面板，而不是原版的按钮列表。

上面的示例展示了 bedrock-cui 的两个基本特点：

- **对象式的界面描述**：每个控件是一个类的实例，属性通过 `setXxx()` 方法或直接赋值修改，不需要手写 JSON。
- **带类型的值**：尺寸、锚点、颜色分别由 `Size`、`Anchor`、`Color` 表示，拼写错误会在编辑器中提示。

::: tip 预备知识
文档默认读者已了解 JavaScript（ES 模块与类）以及基岩版附加包的基本结构（资源包、行为包、脚本 API）。相关资料：[MDN JavaScript 指南](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide)、[Minecraft 创作者文档](https://learn.microsoft.com/minecraft/creator/)。
:::

## 预览与静态检查

浏览器预览按游戏的排版规则绘制：字形点阵、字宽、折行和同一层内的绘制顺序均与 PC 及安卓设备的实际显示核对过。修改界面后刷新浏览器即可查看结果，不需要每次进入游戏。

静态检查在构建时进行，报告文字越出边界、文字互相重叠、文字被同一层的图片遮挡、仅在手机上出现的折行问题等，并给出控件路径和偏差的像素数。

各项规则的测试方法与结果见[真机规则](reference/rules.md)。

## 使用方式

bedrock-cui 的各部分可以单独使用：

- 只生成 JSON UI 文件，放入已有的资源包。
- 加上脚本端运行时，使用服务端翻页和运行期文字的软换行。
- 通过 `CuiApp.build()` 直接打包为附加包。
- 作为 [sapdon](https://github.com/Meteage/sapdon) 项目的一部分，由 sapdon 负责项目结构与构建。

在这几种方式之间切换时，界面代码不需要修改。

## 适用范围

bedrock-cui 只用于服务端表单界面，不修改 HUD、物品栏等原版界面。DDUI（Ore UI 的数据驱动界面）目前不受支持。

## 学习路径

- [快速上手](quick-start.md)：从创建项目到在游戏中翻页的完整流程。
- 指南：按[目录](index.md)逐章介绍各项功能，从「搭建界面」开始。
- 参考：各模块 API 的完整说明。
