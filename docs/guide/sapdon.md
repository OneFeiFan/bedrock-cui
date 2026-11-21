# 在 sapdon 中使用

bedrock-cui 通过 [sapdon](https://github.com/Meteage/sapdon) 构建附加包。本节介绍在已有的 sapdon 项目中接入 bedrock-cui 的步骤，以及接入之后构建时发生的事。

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
import book from './ui/book.screen.mjs'

export default defineConfig({
    namespace: 'book',
    screens: [book],          // 项目中的界面（界面文件的写法见「界面文件」一章）
    textures: ['res'],        // 存放资源包文件的目录
})
```

在构建入口（`main.mjs` 或 `main.ts`）中，提交之前调用 `useSapdon()`：

```js
import { GRegistry, addPacketResolver, registry } from '@sapdon/core'
import { UISystemRegistry } from '@sapdon/ui'
import { useSapdon } from 'bedrock-cui/node'
import config from './cui.config.mjs'

// ……项目中其他 sapdon 内容的登记

useSapdon(config, { GRegistry, UISystemRegistry, addPacketResolver })
registry.submit()
```

`addPacketResolver` 可以省略：传入时，bedrock-cui 编译出的 JSON UI 文件写成紧凑的 JSON；省略时由 sapdon 按缩进写出，内容相同，但文件大得多（嵌套很深的组件树中，缩进约占八成）。

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
- 将编译出的 JSON UI 文件登记到注册表，与 sapdon 的其他界面合并；
- 将 `cui.generated.js` 与其类型声明写入配置的 `scripts` 目录（默认为 `scripts/`）；
- 将字形图写入 `res/`。

`cui.generated.js` 与 `cui.generated.d.ts` 每次构建时重新生成，可以加入 `.gitignore`。

## 注意事项

- 不应同时使用 `@sapdon/ui` 中的服务端表单界面（`ServerFormUI`、`SapdonFormUI`、`SapdonGuideBook`）。它们与 bedrock-cui 都改写 `ui/server_form.json`，构建时报错。

bedrock-cui 依赖 sapdon 4。完整的示例见仓库的 `examples/sapdon-project`。
