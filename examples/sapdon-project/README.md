# 在 sapdon 项目里用 bedrock-cui

bedrock-cui 嵌入 [sapdon](https://github.com/Meteage/sapdon) 的构建：项目结构、清单、UUID、脚本打包、部署都由 sapdon 负责，bedrock-cui 只登记界面。
这个目录是一个 sapdon JavaScript 项目里需要改的两个文件（其余文件来自 sapdon 的项目模板）。

1. 建一个 sapdon 项目（`npx sapdon create <名字>`），在项目里 `npm install bedrock-cui`（安装后 sapdon 的 postinstall 会生成 `@sapdon/core`）。
2. 入口文件 `main.mjs`：用 bedrock-cui 搭界面，`new CuiApp(命名空间).screen(界面 id, 根元素).useSapdon(sapdon)`，最后照常 `registry.submit()`。
3. 行为包脚本 `scripts/index.js`：从 `bedrock-cui/runtime`、`bedrock-cui/runtime/server-pages` 导入运行时，从 `./cui.generated.js` 导入翻页路由表
   （构建时生成，附 `.d.ts`；可以加进 .gitignore）。
4. `npx sapdon build ./`（或 `npx sapdon compile`）。

构建时 bedrock-cui 会：在 sapdon 的提交前钩子里编译界面、打印静态检查结果（有错误就构建失败），把界面 JSON 登记进注册表、`_ui_defs` 交给 `UISystemRegistry` 合并，
写出 `scripts/cui.generated.js`；sapdon 的 rollup 再把它连同 bedrock-cui 的运行时一起打包进行为包脚本（`@minecraft/*` 仍是外部模块）。

已在 sapdon 3.7.1 上实测：资源包里有界面文件与 `server_form.json`，`_ui_defs.json` 与 sapdon 自己的界面正确合并；行为包脚本里打包了运行时与路由表。

不要同时使用 sapdon 自带的服务端表单界面（`ServerFormUI`）：两者都改写 `ui/server_form.json`，构建时会报错提示。
