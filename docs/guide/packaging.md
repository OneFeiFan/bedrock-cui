# 构建与打包

## 构建

```bash
npm run build        # 即 bedrock-cui build，调用 sapdon compile
npm run pack         # 构建后打包为 .mcaddon
```

构建由 sapdon 完成，结果写入 `dev/`：

```
dev/
├─ my_ui_BP/           # 行为包
├─ my_ui_RP/           # 资源包
└─ my_ui.mcaddon       # npm run pack 时生成
```

构建依次进行以下工作：

1. sapdon 生成清单，UUID 取自 `mod.info`；
2. 复制 `res/` 到资源包；
3. 运行构建入口 `main.mjs`：bedrock-cui 编译界面、输出静态检查结果（存在错误时构建失败），登记界面文件，并生成 `scripts/cui.generated.js`；
4. sapdon 用 rollup 将 `scripts/index.js` 打包到行为包，`bedrock-cui/runtime` 随之打包，`@minecraft/*` 保持为外部模块；
5. 在 Windows 上，将两个包复制到游戏的开发包目录。

## 构建入口

`main.mjs` 是 sapdon 的构建入口。bedrock-cui 通过 `useSapdon()` 接入：

```js
// main.mjs
import { GRegistry, registry } from '@sapdon/core'
import { UISystemRegistry } from '@sapdon/ui'
import { useSapdon } from 'bedrock-cui/node'
import config from './cui.config.mjs'

useSapdon(config, { GRegistry, UISystemRegistry })

registry.submit()
```

项目中的其他 sapdon 内容（物品、方块等）也在这个文件中登记，最后统一提交。

## 字形图

配置了 `glyphs`（见[字形图标](glyph-icons.md)）时，字形图写入 `res/font/`。由于 `res/` 在运行构建入口之前复制，字形图发生变化后需要再构建一次，构建时会给出提示。

## UUID

游戏通过 UUID 识别附加包。`mod.info` 中的 UUID 在创建项目时生成，应提交到版本库；UUID 改变后，游戏会将其视为另一个附加包。

## 脚本的类型检查

`checkScripts(项目目录)`（`bedrock-cui/node`）用 TypeScript 编译器检查行为包脚本，返回错误信息的数组，例如拼错的方法名、少传的参数。项目目录中有 `cui.config.mjs` 时，它检查 `scripts/` 下的脚本，连同脚本导入的界面文件。需要在项目中安装 `typescript`（`npm i -D typescript`）；`@minecraft/server`、`@minecraft/server-ui` 的类型由新建的项目自带。

```js
import { checkScripts } from 'bedrock-cui/node'

const errors = await checkScripts('.')
for (const e of errors) console.log(e)      // 例：scripts/index.js:3:6 Property 'opne' does not exist on type 'Screen'.
```

不打包、用 `copyRuntime()` 的项目，传入行为包目录（例如 `checkScripts('my_pack_BP')`），检查其中 `scripts/` 下的脚本。

