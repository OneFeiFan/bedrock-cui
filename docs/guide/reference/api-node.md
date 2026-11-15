# bedrock-cui/node

构建工具，只在 Node 中使用。

本页由 `scripts/gen-api-reference.mjs` 生成并与源码核对。详细用法见指南中的相关章节。

## 构建

| 名称 | 种类 | 说明 |
|---|---|---|
| `CuiApp` | 类 | 挂载界面、导出翻页路由、生成字形图；build() 独立打包，useSapdon() 接入 sapdon 的构建。 |
| `Addon` | 类 | 附加包：清单、UUID 文件、资源包与行为包的文件、打包为 .mcaddon。 |
| `PackFiles` | 类 | 一个包中的文件。 |
| `checkScripts` | 函数 | 对行为包中的脚本做类型检查，返回错误信息。 |

## 资源

| 名称 | 种类 | 说明 |
|---|---|---|
| `textureInfoFrom` | 函数 | 从资源包目录读取贴图的尺寸与九宫格信息。 |
| `renderGlyphSheet` | 函数 | 生成字形图，并核对各图标的墨迹。 |
| `copyRuntime` | 函数 | 将脚本端运行时复制到指定目录。 |

## 类型

| 名称 | 种类 | 说明 |
|---|---|---|
| `CuiBuildOptions` | 接口 | CuiApp.build() 的选项。 |
| `CuiCompiled` | 接口 | CuiApp.compile() 的结果。 |
| `SapdonCore` | 接口 | useSapdon() 所需的 sapdon 模块成员。 |
