# 附加包与服务端表单基础

本节介绍把界面挂到游戏里所涉及的基岩版附加包知识。熟悉附加包开发的读者可以跳过。

## 附加包

基岩版的附加包（`.mcaddon`）由两个包组成：

| 包 | 内容 | bedrock-cui 生成的部分 |
|---|---|---|
| 资源包 | 贴图、声音、界面定义（`ui/*.json`）等，由客户端读取 | 界面文件、对原版 `server_form.json` 的改写 |
| 行为包 | 游戏逻辑，包括脚本（`scripts/`） | 翻页路由表 `cui.generated.js`；运行时随脚本打包 |

每个包都有一个清单（`manifest.json`），用 UUID 标识自己。游戏通过 UUID 识别附加包，所以同一个附加包的 UUID 应保持不变。在 bedrock-cui 的项目中，清单与 UUID 由 sapdon 生成，UUID 保存在 `mod.info` 中。

## 脚本

行为包脚本用 JavaScript 编写，运行在游戏中，通过两个模块与游戏交互：

- `@minecraft/server`：玩家、物品、方块、事件等；
- `@minecraft/server-ui`：向玩家显示表单。

脚本以事件驱动。下面的脚本在玩家使用物品时执行：

```js
import { world } from '@minecraft/server'

world.afterEvents.itemUse.subscribe((e) => {
    // e.source 是使用物品的玩家，e.itemStack 是物品
    if (e.itemStack.typeId === 'minecraft:book') e.source.sendMessage('你使用了一本书')
})
```

修改脚本后，在游戏中执行 `/reload` 即可重新加载；资源包（包括界面）的修改需要重新进入世界后生效。

## 服务端表单

`@minecraft/server-ui` 的 `ActionFormData` 是一种服务端表单：由标题、正文和若干按钮组成，玩家点击按钮后表单关闭，脚本得知点击的是第几个按钮。

```js
import { ActionFormData } from '@minecraft/server-ui'

new ActionFormData()
    .title('商店')
    .body('选择要购买的物品')
    .button('钻石')
    .button('绿宝石')
    .show(player)
    .then((r) => {
        if (r.canceled) return             // 玩家按 Esc 关闭
        player.sendMessage(`选择了第 ${r.selection} 项`)
    })
```

原版将它显示为一列按钮。资源包可以改写表单的界面：bedrock-cui 正是通过这种方式，在标题以界面 id 开头时显示自定义的界面，而不是原版的按钮列表。

## 表单数据与界面

脚本传给表单的内容，就是界面可以读取的数据：

| 脚本 | 界面 |
|---|---|
| `.title('cui_ui:book')` | 标题以界面 id 开头时，显示该界面；标题也可以用 `form.title` 读取 |
| `.body('……')` | 用 `form.text` 读取 |
| `.button('info\|钻石 ×3')` | 用 `CollectionItem` 读取第几个按钮的文字（`form.buttonText`） |
| 玩家点击界面中的 `FormButton(序号, …)` | 表单关闭，脚本中 `r.selection` 为该序号 |

按钮的文字不一定显示为按钮，常用于向界面传递数据，例如物品的数量。读取方式见[表达式与绑定](bindings.md)。

服务端表单每次打开时，数据随之确定；要更新界面上的数据，脚本需要重新打开表单。[翻页](paging.md)就是利用这一点实现的：点击翻页箭头时表单关闭，脚本以新的页码重新打开。

## 开发流程

1. 在 `ui/` 中描述界面，用 `npm run dev` 预览；
2. `npm run build` 构建。在 Windows 上，构建结果自动复制到游戏的开发包目录（`development_behavior_packs` 与 `development_resource_packs`）；
3. 在游戏中新建世界并启用这两个包，测试界面与脚本；
4. 发布时用 `npm run pack` 打包为 `.mcaddon`。
