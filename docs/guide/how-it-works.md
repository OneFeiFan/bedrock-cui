# 工作原理

bedrock-cui 编写的界面，显示在 Minecraft 基岩版的「服务端表单」上。本节介绍原版的服务端表单，以及 bedrock-cui 怎样利用它。后续章节中的「界面」「界面 id」「表单数据」都以本节为基础。

## 原版的服务端表单

基岩版的附加包可以包含**行为包脚本**：用 JavaScript 编写、在游戏中运行的程序。脚本通过游戏提供的模块 `@minecraft/server-ui` 向玩家显示表单。这种表单由脚本发起，称为服务端表单。

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
3. 行为包脚本照常用 `ActionFormData` 打开表单，只是把标题写成界面 id。

以下三个词在本手册中有确定的含义：

| 术语 | 含义 |
|---|---|
| 界面 | 用 bedrock-cui 编写、显示在服务端表单上的一整棵控件树。一个项目可以有多个界面，在项目配置 `cui.config.mjs` 的 `screens` 中登记。 |
| 界面 id | 登记界面时使用的名字，也是打开表单时写在标题里的文字，例如 `cui_ui:shop`。必须以 `cui_ui:` 开头，原版的按钮列表据此隐藏；冒号之后的部分自行命名。 |
| 页 | `Pages` 组件中的一页。页属于某个界面的内部，用于在界面中切换内容（见[开关与分页](pages.md)），不是另一个界面。 |

在配置中登记界面，在脚本中打开它：

```js
// cui.config.mjs（项目配置）
import { defineConfig } from 'bedrock-cui'
import { buildShop } from './ui/shop.mjs'

export default defineConfig({
    namespace: 'shop',
    screens: { 'cui_ui:shop': () => buildShop() },   // 界面 id → 返回界面的函数
})
```

```js
// 行为包脚本：标题写成界面 id，游戏显示 buildShop() 返回的界面
new ActionFormData().title('cui_ui:shop').body('').show(player)
```

## 界面怎样读取表单的内容

原版的服务端表单在显示时，向界面内部提供它的内容：标题、正文、每个按钮的文字与图标。bedrock-cui 的界面显示在服务端表单内部，所以能读取这些内容。

bedrock-cui 用 `form` 对象（从 `'bedrock-cui'` 导入）表示「当前打开的服务端表单的内容」。`form` 本身不含数据：写进界面后，它被编译为 JSON UI 的绑定，游戏显示界面时从当前表单取值。

| 脚本中（`ActionFormData`） | 界面中（bedrock-cui） |
|---|---|
| `.title('cui_ui:shop')` | `form.title` |
| `.body('今天的特价：钻石')` | `form.text` |
| 第 n 个 `.button(文字, 图标)` | 在 `form.button(n)` 内部，用 `form.buttonText`、`form.buttonTexture` |

下面的界面用一个 `Label` 显示表单的正文。示例中的 `data` 模拟脚本打开表单时传入的内容，只用于本页的预览：

```js preview=card 220x60 form=data
import { Color, Image, Label, Length, Panel, Size, form } from 'bedrock-cui'

// 相当于脚本中的 .title('cui_ui:shop').body('今天的特价：钻石')
const data = { title: 'cui_ui:shop', text: '今天的特价：钻石' }

const card = new Panel().setSize(200, 40).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    new Label(form.text).setColor(Color.hex('#3c2814')).setSize(180, Length.auto()),
)
```

`form` 的全部用法见[表达式与绑定](bindings.md)。

## 按钮在 bedrock-cui 中的用途

界面上的内容全部由 bedrock-cui 绘制，原版的按钮列表不再显示。脚本仍然可以添加按钮，这些按钮在 bedrock-cui 中有两种用途。这是 bedrock-cui 的用法，不是原版的特性：

1. **向界面传递数据**：按钮的文字与图标可以被界面读取，显示在界面的任意位置。例如脚本添加三个按钮，文字分别为三种物品的名称与数量，界面把它们排成一个列表。读取第 n 个按钮的内容使用 `form.button(n)`，它返回一个容器，本身不可点击（见[表达式与绑定](bindings.md#读取表单按钮的文字)）。
2. **接收点击**：界面中的 `FormButton(n, …)` 是一块可点击的区域，对应第 n 个按钮。玩家点击它时，效果与点击原版的第 n 个按钮相同：表单关闭，脚本得到序号 n（见[服务端表单](server-form.md#表单按钮)）。

## 更新界面上的内容

表单打开后内容不能修改。要更新界面上显示的数据，脚本需要关闭表单，再以新的内容重新打开。bedrock-cui 的[服务端翻页](paging.md)就是这样实现的。

不需要脚本参与的切换，例如目录、标签页、弹出层，使用开关（`Toggle`、`Pages`）在界面内部完成，表单不关闭（见[开关与分页](pages.md)）。

## 附加包的组成

| 部分 | 内容 | 与 bedrock-cui 的关系 |
|---|---|---|
| 资源包 | 贴图、界面定义（`ui/*.json`）等，由游戏客户端读取 | bedrock-cui 编译出的界面文件、对 `ui/server_form.json` 的改写 |
| 行为包 | 游戏逻辑，包括脚本（`scripts/`） | 打开表单的脚本；bedrock-cui 的脚本端运行时（翻页等）随脚本打包 |
| 附加包（`.mcaddon`） | 资源包与行为包打包在一起 | 由 sapdon 构建与打包 |

每个包都有一个清单（`manifest.json`），用 UUID 标识自己，由 sapdon 生成；UUID 保存在项目的 `mod.info` 中，不应修改，否则游戏会把它当作另一个附加包。
