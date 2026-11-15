# 参与开发

## 环境

Node.js 22.12 或更高版本，Windows、macOS、Linux 均可。

```bash
git clone https://github.com/OneFeiFan/bedrock-cui.git
cd bedrock-cui
npm ci
npm test
```

## 目录

| 目录 | 内容 |
|---|---|
| `src/core` | 控件、表达式、值类型、字形图标、混合翻页的约定 |
| `src/components` | `Pages`、`Paragraph`、`Text`、`FormButton` 等组件 |
| `src/layout` | 排版引擎（预览与静态检查共用） |
| `src/font` | 字宽、折行模拟、软换行、Unifont 字距表 |
| `src/mc` | JSON UI 编译、服务端表单挂载、静态检查 |
| `src/web` | 浏览器预览 |
| `src/dom` | 生成普通网页 |
| `src/runtime` | 行为包脚本中使用的运行时 |
| `src/node`、`src/cli` | 构建工具与命令行 |
| `templates` | `bedrock-cui create` 的项目文件、`bedrock-cui dev` 的页面 |
| `examples/cui_toggle_test` | 真机测试包（sapdon 项目） |
| `examples/sapdon-project` | 接入已有 sapdon 项目的示例 |
| `docs/guide` | 手册；`docs/DESIGN.md` 是设计与真机测试的记录 |
| `tests` | 测试 |

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm test` | 编译并运行测试（缺少的原版贴图会自动下载） |
| `npm run dev` | 在浏览器中预览真机测试包的界面 |
| `npm run test-pack` | 构建真机测试包 `examples/cui_toggle_test/dev/cui_toggle_test.mcaddon` |
| `npm run e2e` | 端到端：`bedrock-cui create` 新建项目并构建 |
| `npm run docs:check` | 检查手册的链接，运行并类型检查其中的代码块 |
| `npm run docs:api` | 由源码生成 API 参考与组件页的属性表 |
| `npm run docs:site` | 生成手册网站到 `site-dist/` |

## 真机测试

游戏的排版与绘制规则只能在真机上确认。修改与之相关的代码时：

1. 在 `examples/cui_toggle_test/ui/toggle-book.mjs` 中加一页测试；
2. `npm run test-pack`，在 PC 与安卓上打开测试书（手持书右键）；
3. 将结论记入 `docs/DESIGN.md`，并更新手册中的[真机规则](docs/guide/reference/rules.md)。

## 手册

手册的写法见 [docs/guide/WRITING.md](docs/guide/WRITING.md)。修改公开 API 后运行 `npm run docs:api`；持续集成会检查 API 参考是否与源码一致、代码块能否运行。

## 不随源码分发的资源

字体（GNU Unifont、Minecraft 的 `ascii.png`）与原版贴图不在仓库中，由 `scripts/fetch-fonts.mjs` 与 `scripts/fetch-vanilla-textures.mjs` 下载到本机，只在本机使用。
