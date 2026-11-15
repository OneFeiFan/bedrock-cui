# 在已有的 sapdon 项目里用 bedrock-cui

新建项目时用 `npx bedrock-cui create <名字>` 即可。这个目录演示在**已有的** sapdon 项目中接入 bedrock-cui 需要添加或修改的文件（其余文件来自 sapdon 的项目模板）：

| 文件 | 作用 |
|---|---|
| `cui.config.mjs` | 项目配置：命名空间、界面、贴图目录、预览数据 |
| `ui/book.mjs` | 示例界面：一本两页的小书 |
| `main.mjs` | sapdon 的构建入口：`useSapdon(config, { GRegistry, UISystemRegistry })` |
| `scripts/index.js` | 行为包脚本：`ServerPagesForm` 与构建生成的 `cui.generated.js` |

步骤：`npm install bedrock-cui`，加入上面的文件，`npx bedrock-cui dev` 预览，`npx sapdon compile` 构建。说明见手册「在 sapdon 中使用」。

已在 sapdon 4.0.0 与 3.7.1 上实测。示例界面使用的贴图 `textures/cui_example/panel` 由 `bedrock-cui create` 生成；在已有项目中运行时请换成自己的贴图。
