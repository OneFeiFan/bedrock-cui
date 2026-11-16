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

把这块面板写进一个界面文件后，行为包脚本打开这个界面时，游戏在服务端表单上显示的就是它，而不是原版的按钮列表（见[工作原理](how-it-works.md)）。

bedrock-cui 的主要特点：

- **对象式的界面描述**：每个控件是一个类的实例，属性通过 `setXxx()` 方法或直接赋值修改，不需要手写 JSON。
- **带类型的值**：尺寸、锚点、颜色分别由 `Size`、`Anchor`、`Color` 表示，拼写错误会在编辑器中提示。
- **界面文件**：一个界面的数据、逻辑与视图写在一个文件中；按钮用名字联系逻辑，行为包脚本只决定什么时候打开界面（见[界面文件](screens.md)）。
- **客户端动画**：透明度、位置、尺寸、裁剪比例的动画由游戏客户端播放，不需要脚本刷新（见[动画](animation.md)）。

::: tip 预备知识
文档默认读者已了解 JavaScript（ES 模块与类）以及基岩版附加包的基本结构（资源包、行为包、脚本 API）。相关资料：[MDN JavaScript 指南](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide)、[Minecraft 创作者文档](https://learn.microsoft.com/minecraft/creator/)。
:::

## 预览与静态检查

浏览器预览按游戏的排版规则绘制：字形点阵、字宽、折行和同一层内的绘制顺序均与 PC 及安卓设备的实际显示核对过。修改界面后预览自动刷新；界面的逻辑在浏览器中运行，动画按时间播放，不需要每次进入游戏。

静态检查在构建时进行，报告文字越出边界、文字互相重叠、文字被同一层的图片遮挡、仅在手机上出现的折行问题等，并给出控件路径和偏差的像素数。

各项规则的测试方法与结果见[真机规则](reference/rules.md)。

## 使用方式

bedrock-cui 与 [sapdon](https://github.com/Meteage/sapdon) 配合使用：bedrock-cui 负责界面与预览，sapdon 负责项目结构、清单与打包。

- **新建项目**：`npx bedrock-cui create <名字>` 生成一个已配置好的 sapdon 项目，附带示例界面。
- **已有的 sapdon 项目**：安装 bedrock-cui，添加配置文件，在构建入口中调用 `useSapdon()`。

两种方式使用同一份配置（`cui.config.mjs`），都用 `bedrock-cui dev` 在浏览器中预览。

## 适用范围

bedrock-cui 只用于服务端表单界面，不修改 HUD、物品栏等原版界面。DDUI（Ore UI 的数据驱动界面）目前不受支持。

## 学习路径

- [工作原理](how-it-works.md)：原版的服务端表单是什么，bedrock-cui 怎样在它上面显示界面。
- [快速上手](quick-start.md)：创建项目、在浏览器中预览、构建并在游戏中打开。
- 搭建界面：从[控件与组件树](elements.md)开始，介绍控件、布局、文字与图片。
- 界面文件：从[界面文件](screens.md)开始，介绍数据、逻辑、翻页与动画。
- 参考：[各模块的 API](reference/api-core.md)、[静态检查规则](reference/lint.md)与[真机规则](reference/rules.md)。
