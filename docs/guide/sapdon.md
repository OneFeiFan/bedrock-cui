# 在 sapdon 中使用

## 分工

[sapdon](https://github.com/Meteage/sapdon) 是一个基岩版附加包开发框架。在 sapdon 项目中，项目结构、清单、UUID、脚本打包与部署由 sapdon 负责，bedrock-cui 只负责界面。

## 安装

```bash
npx sapdon create my_addon
cd my_addon
npm install bedrock-cui
```

sapdon 项目安装依赖后，会自动运行 `sapdon lib` 生成 `@sapdon/core`。

## 入口文件

在 sapdon 项目的入口文件（`main.mjs` 或 `main.ts`）中，用 `useSapdon()` 将界面接入 sapdon 的构建：

```js
import * as sapdon from '@sapdon/core'
import { CuiApp } from 'bedrock-cui/node'
import { buildBook } from './ui/book.js'

new CuiApp('my_book').screen('cui_ui:my_book', buildBook()).useSapdon(sapdon)

sapdon.registry.submit()
```

`useSapdon()` 在 sapdon 注册表的提交前钩子中执行以下操作：

- 编译界面，输出静态检查结果，存在错误时构建失败；
- 将界面文件登记到注册表，`_ui_defs.json` 交由 `UISystemRegistry` 与 sapdon 的其他界面合并；
- 将 `cui.generated.js` 与其类型声明写入项目的 `scripts/` 目录；
- 将字形图写入 `res/`。

## 行为包脚本

脚本的写法与独立打包时相同：

```js
// scripts/index.js
import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'

const book = new ServerPagesForm(paging['cui_ui:my_book'])
```

sapdon 用 rollup 打包脚本时，`bedrock-cui/runtime` 一并打包进脚本文件，`@minecraft/*` 保持为外部模块。

`cui.generated.js` 与 `cui.generated.d.ts` 每次构建时重新生成，可以加入 `.gitignore`。

## 注意事项

- 字形图写入 `res/`。由于 sapdon 在运行入口文件之前同步 `res/`，字形图发生变化后需要再构建一次。构建时会给出提示。
- 不应同时使用 sapdon 自带的服务端表单界面（`ServerFormUI`）。两者都改写 `ui/server_form.json`，构建时报错。

完整的示例见仓库的 `examples/sapdon-project`。
