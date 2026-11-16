# 在 sapdon 中使用

## 两种方式

- **新建项目**：`npx bedrock-cui create <名字>` 生成的就是一个 sapdon 项目，已经配置好，见[快速上手](quick-start.md)。
- **已有的 sapdon 项目**：按本节的步骤接入。

sapdon 负责项目结构、清单、UUID、脚本打包与部署，bedrock-cui 负责界面与预览。

## 接入已有的项目

安装 bedrock-cui：

```bash
npm install bedrock-cui
```

在项目根目录添加配置 `cui.config.mjs`：

```js
import { defineConfig } from 'bedrock-cui'
import { buildBook } from './ui/book.mjs'

export default defineConfig({
    namespace: 'book',
    screens: { 'cui_ui:book': () => buildBook() },
    textures: ['res'],
})
```

在构建入口（`main.mjs` 或 `main.ts`）中，提交之前调用 `useSapdon()`：

```js
import { GRegistry, registry } from '@sapdon/core'
import { UISystemRegistry } from '@sapdon/ui'
import { useSapdon } from 'bedrock-cui/node'
import config from './cui.config.mjs'

// ……项目中其他 sapdon 内容的登记

useSapdon(config, { GRegistry, UISystemRegistry })
registry.submit()
```

行为包脚本的写法与新建的项目相同：

```js
import './cui.generated.js'
import book from '../ui/book.screen.mjs'

book.open(player)
```

预览使用 `npx bedrock-cui dev`。

## useSapdon 做的事

`useSapdon()` 在 sapdon 注册表的提交前钩子中执行：

- 编译界面，输出静态检查结果，存在错误时构建失败；
- 将界面文件登记到注册表，`_ui_defs.json` 交由 `UISystemRegistry`（`@sapdon/ui`）与 sapdon 的其他界面合并；
- 将 `cui.generated.js` 与其类型声明写入配置的 `scripts` 目录（默认为 `scripts/`）；
- 将字形图写入 `res/`。

`cui.generated.js` 与 `cui.generated.d.ts` 每次构建时重新生成，可以加入 `.gitignore`。

## 注意事项

- 不应同时使用 `@sapdon/ui` 中的服务端表单界面（`ServerFormUI`、`SapdonFormUI`、`SapdonGuideBook`）。它们与 bedrock-cui 都改写 `ui/server_form.json`，构建时报错。
- sapdon 3 中 `GRegistry` 与 `UISystemRegistry` 都在 `@sapdon/core`，写作 `import * as sapdon from '@sapdon/core'` 与 `useSapdon(config, sapdon)`。

完整的示例见仓库的 `examples/sapdon-project`（已在 sapdon 4.0.0 与 3.7.1 上实测）。
