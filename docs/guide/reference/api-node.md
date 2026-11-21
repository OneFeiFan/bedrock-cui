# bedrock-cui/node

构建工具，只在 Node 中使用。

本页由 `scripts/gen-api-reference.mjs` 生成并与源码核对。详细用法见指南中的相关章节。

## 构建

| 名称 | 种类 | 说明 |
|---|---|---|
| `useSapdon` | 函数 | 按项目配置接入 sapdon 的构建（在 sapdon 项目的入口文件中调用）。 |
| `CuiApp` | 类 | 挂载界面、导出翻页路由、生成字形图；fromConfig() 由项目配置创建，compile() 只编译，useSapdon() 接入 sapdon 的构建。 |
| `checkScripts` | 函数 | 对行为包中的脚本做类型检查，返回错误信息。 |

## 资源

| 名称 | 种类 | 说明 |
|---|---|---|
| `copyRuntime` | 函数 | 将脚本端运行时复制到指定目录。 |

## 类型

| 名称 | 种类 | 说明 |
|---|---|---|
| `CuiCompiled` | 接口 | CuiApp.compile() 的结果。 |
| `SapdonCore` | 接口 | useSapdon() 所需的 sapdon 模块成员。 |
