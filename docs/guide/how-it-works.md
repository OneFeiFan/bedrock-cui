# 工作原理

bedrock-cui 编写的界面，显示在 Minecraft 基岩版的「服务端表单」上。本节介绍原版的服务端表单，以及 bedrock-cui 怎样利用它。后续章节中的「界面」「界面 id」「页」都以本节的定义为准。

## 原版的服务端表单

基岩版的附加包可以包含行为包脚本：用 JavaScript 编写、在游戏中运行的程序。脚本通过游戏提供的模块 `@minecraft/server-ui` 向玩家显示表单。这种表单由脚本发起，称为服务端表单。

`ActionFormData` 是其中一种服务端表单，由标题、正文和一列按钮组成。下面是一段行为包脚本，`ActionFormData` 与 `player.sendMessage()` 都属于游戏的脚本 API，不属于 bedrock-cui：

```js
// 行为包脚本
import { ActionFormData } from '@minecraft/server-ui'

new ActionFormData()
    .title('商店')                                   // 标题
    .body('选择要购买的物品')                         // 正文
    .button('钻石', 'textures/items/diamond')        // 第 0 个按钮：文字与图标
    .button('绿宝石')                                 // 第 1 个按钮：只有文字
    .show(player)                                    // 向玩家显示
    .then((r) => {
        if (r.canceled) return                       // 玩家按 Esc 关闭了表单
        player.sendMessage(`选择了第 ${r.selection} 个按钮`)
    })
```

原版的显示效果如下（示意）：

<figure class="mock-form">
  <div class="mock-title">商店</div>
  <div class="mock-body">选择要购买的物品</div>
  <div class="mock-button"><span class="mock-icon"></span>钻石</div>
  <div class="mock-button">绿宝石</div>
  <figcaption>原版的服务端表单（示意）：标题、正文与一列按钮</figcaption>
</figure>

服务端表单有以下特性，bedrock-cui 的工作方式建立在这些特性之上：

1. 表单的内容（标题、正文、每个按钮的文字与图标）在打开时确定，打开之后不能修改。
2. 玩家点击一个按钮时，表单关闭，脚本得到这个按钮的序号（从 0 开始）。
3. 表单的外观由资源包中的界面定义文件（JSON UI 格式的 `ui/server_form.json`）决定，资源包可以改写它。

## bedrock-cui 的做法

bedrock-cui 利用第 3 条特性，改写服务端表单的外观：

1. 用 bedrock-cui 编写界面。构建时，界面被编译为 JSON UI 文件，放进附加包的资源包。
2. 资源包同时改写原版的 `ui/server_form.json`：表单标题以 `cui_ui:` 开头时，隐藏原版的按钮列表；标题中包含某个界面的 id 时，在原处显示这个界面。
3. 行为包脚本调用界面的 `open()`，bedrock-cui 以界面 id 为标题打开服务端表单（内部使用 `ActionFormData`）。

以下三个词在本手册中有确定的含义：

| 术语 | 含义 |
|---|---|
| 界面 | 用 bedrock-cui 编写、显示在服务端表单上的一整棵组件树，写在一个界面文件中。打开一个界面，就是打开一个服务端表单。一个项目可以有多个界面，在项目配置 `cui.config.mjs` 的 `screens` 中登记。 |
| 界面 id | 登记界面时使用的名字，也是打开表单时写在标题里的文字，例如 `cui_ui:shop`。必须以 `cui_ui:` 开头，原版的按钮列表据此隐藏；冒号之后的部分自行命名。 |
| 页 | 一个界面可以有多页（`Router` 中的子页面）。页属于界面的内部，不是另一个界面：切换到另一页时，界面以那一页重新打开（见[页面](pages.md)）。只在客户端切换、表单不关闭的内容区域见[选项卡](tabs.md)。 |

一个界面写在一个界面文件中，在项目配置中登记；行为包脚本打开它时，bedrock-cui 以界面 id 为标题打开一个服务端表单：

```js
// ui/shop.screen.mjs（界面文件）
import { defineUI, Label, Page } from 'bedrock-cui'

export default defineUI({
    id: 'cui_ui:shop',
    page() {
        return new Page().setSize(200, 100).add(new Label('商店'))
    },
})
```

```js
// 行为包脚本：相当于 new ActionFormData().title('cui_ui:shop')……show(player)
shop.open(player)
```

界面文件的写法见[界面文件](screens.md)。

## bedrock-cui 怎样传递数据与点击

服务端表单显示时，它的标题、正文、每个按钮的文字与图标，可以被表单内部的控件读取。bedrock-cui 的界面就显示在表单内部，所以能读取这些数据。

界面上的内容全部由 bedrock-cui 绘制，原版的按钮列表不再显示。bedrock-cui 借用表单的按钮做两件事。这是 bedrock-cui 的做法，不是原版的特性：

1. **传递数据**：界面的每一项[数据（props）](props.md)占用一个表单按钮。脚本打开界面时，bedrock-cui 把数据写进这个按钮的文字与图标；界面中显示这项数据的控件，读取的就是这个按钮。
2. **接收点击**：界面中绑定了方法的每个按钮（`new Button().onClick(方法)`），以及 `Close`、页面跳转用的按钮，都对应一个表单按钮。玩家点击它时，效果与点击原版的按钮相同：表单关闭，脚本得到这个按钮的序号，bedrock-cui 再按序号找到绑定的方法并调用它，或者完成跳转、关闭界面。

哪项数据、哪个按钮对应第几个表单按钮，由 bedrock-cui 在构建时分配，写进构建生成的 `cui.generated.js`。使用者只与数据和方法打交道，接触不到序号。

这个做法带来一些限制，例如显示数据的控件需要像素尺寸（读取按钮数据的方式要求），一个控件只能使用一项数据。这些限制写在[数据（props）](props.md#限制)中。

## 更新界面上的内容

表单打开后内容不能修改。要更新界面上显示的数据，需要关闭表单，再以新的内容重新打开。bedrock-cui 在玩家点击按钮之后、逻辑修改了状态之后这样做（见[逻辑](logic.md#更新显示)），[页面](pages.md)之间的跳转也是这样实现的。

不需要脚本参与的切换，例如目录、标签页、弹出层，使用开关（`Toggle`、`Tabs`）在界面内部完成，表单不关闭（见[选项卡](tabs.md)）。随时间连续变化的显示，由客户端的[动画](animation.md)完成，例如[计时显示](timers.md)中的进度条。

## 附加包的组成

| 部分 | 内容 | 与 bedrock-cui 的关系 |
|---|---|---|
| 资源包 | 贴图、界面定义（`ui/*.json`）等，由游戏客户端读取 | bedrock-cui 编译出的 JSON UI 文件、对 `ui/server_form.json` 的改写 |
| 行为包 | 游戏逻辑，包括脚本（`scripts/`） | 打开表单的脚本；bedrock-cui 的脚本端运行时（处理点击、跳转与刷新）随脚本打包 |
| 附加包（`.mcaddon`） | 资源包与行为包打包在一起 | 由 sapdon 构建与打包 |

每个包的清单（`manifest.json`）与 UUID 由 sapdon 生成，见[构建与打包](packaging.md)。
