# 脚本端

行为包脚本是在游戏中运行的 JavaScript。使用 bedrock-cui 时，脚本负责两件事：决定什么时候打开界面，以及处理界面发出的事件（见[界面文件](screens.md)与[逻辑](logic.md#通知行为包脚本)）。本节介绍脚本中用到的文件与模块。

## 构建生成的文件

每次构建时，bedrock-cui 在项目的 `scripts/` 中写入 `cui.generated.js`（以及类型声明 `cui.generated.d.ts`）。它记录每个界面的数据与按钮怎样经由服务端表单传递，并在被导入时登记这些信息。脚本的入口需要导入它一次：

```js
// scripts/index.js
import './cui.generated.js'
import shop from '../ui/shop.screen.mjs'
```

导入之后，界面的 `open()`、`close()` 等方法即可使用。这个文件由构建覆盖，不要手动修改。

## 运行时模块

| 模块 | 内容 | 依赖 |
|---|---|---|
| `bedrock-cui/runtime/screens` | 界面的运行时（打开、点击、刷新、事件）；由 `cui.generated.js` 自动导入 | `@minecraft/server`、`@minecraft/server-ui` |
| `bedrock-cui/runtime` | `softWrap()` 等文字处理函数 | 无 |

`bedrock-cui/runtime` 不依赖游戏的脚本接口，也可以在 Node 和浏览器中使用。

## 脚本的大小

新建的项目由 sapdon 用 rollup 打包行为包脚本，脚本中按模块名导入即可（`import { softWrap } from 'bedrock-cui/runtime'`），不需要另外处理。脚本导入界面文件时，页面部分与控件代码也会打包进去（构建工具、静态检查与排版引擎等只在构建时用到的部分不会进入），新建项目的行为包脚本约 200 KB，其中包括排版用的字宽表。

发布时，把 sapdon 的构建模式设为生产模式，脚本会被压缩（新建项目约 95 KB）：

```
// build.config
{ "buildOptions": { "buildMode": "prod" } }
```

## 不使用 sapdon 时

不使用 sapdon、也不使用界面文件，只想在自己的行为包脚本中使用[运行期文字](text.md#运行期文字)的函数时，可以不打包：游戏的脚本环境不支持 `import 'bedrock-cui/runtime'` 这样的模块名，`copyRuntime(目录)`（`bedrock-cui/node`）把 `bedrock-cui/runtime` 复制到指定目录，脚本以相对路径导入：

```js
import { copyRuntime } from 'bedrock-cui/node'

copyRuntime('my_pack_BP/scripts/cui')
```

```js
// 行为包脚本
import { softWrap } from './cui/runtime/index.js'
```

界面文件依赖 bedrock-cui 的控件代码，只能打包使用。

## 运行期文字

`softWrap()`、`paginate()` 等处理运行期文字的函数，见[文字 · 运行期文字](text.md#运行期文字)。
