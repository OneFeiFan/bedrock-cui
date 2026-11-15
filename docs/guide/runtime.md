# 脚本端

## 运行时模块

bedrock-cui 提供两个可在行为包脚本中使用的模块：

| 模块 | 内容 | 依赖 |
|---|---|---|
| `bedrock-cui/runtime` | `softWrap()` 等文字处理函数 | 无 |
| `bedrock-cui/runtime/server-pages` | `ServerPagesForm`、`lockCamera()` | `@minecraft/server`、`@minecraft/server-ui` |

`bedrock-cui/runtime` 不依赖游戏的脚本接口，也可以在 Node 和浏览器中使用。

## 放入行为包

游戏的脚本环境不支持 `import 'bedrock-cui/runtime'` 这样的模块名，运行时的文件需要放入行为包，并以相对路径导入。按使用方式不同：

- **bedrock-cui 的项目（sapdon）**：sapdon 用 rollup 打包脚本，运行时随之打包进脚本文件。脚本按模块名书写即可。
- **其他构建方式**：`copyRuntime(目录)`（`bedrock-cui/node`）将运行时复制到指定目录，脚本以相对路径导入：

```js
import { copyRuntime } from 'bedrock-cui/node'

copyRuntime('my_pack_BP/scripts/cui')
```

```js
// 行为包脚本
import { softWrap } from './cui/runtime/index.js'
import { ServerPagesForm } from './cui/runtime/serverPages.js'
```

运行时约 90 KB，其中大部分是 Unifont 的字宽表。

## softWrap

`softWrap(文字, 宽度)` 对运行期生成的文字做与 [`Paragraph`](text.md#paragraph) 相同的处理，返回交给游戏折行的文字：

```js
import { softWrap } from 'bedrock-cui/runtime'

const text = softWrap('背包里一共 11 种物品，其中钻石有 3 个。', 110)
```

第三个参数为选项：

| 选项 | 说明 |
|---|---|
| `scale` | 字号倍数，与显示该文字的控件的 `setFontScale()` 一致。默认 1。 |
| `autoSpace` | 是否在汉字与英文、数字之间留空。默认 `true`。 |
| `spacing` | 交界处的间隔：`'auto'`（默认，按模拟结果择优）、`'nbsp'`（一律不换行空格）、`'none'`（一律不留）。 |
| `effort` | 择优的方式：`'fast'`（默认）只修正出现问题的交界；`'full'` 尝试每一处交界的每一种间隔。 |

`softWrap()` 缓存最近 64 次的结果，同样的文字与宽度直接返回缓存。

`preWrap(文字, 宽度)` 按 PC 的字宽计算每一行，返回以换行符连接的文字。只在 PC 上精确，适用于确定只在 PC 上运行的场合。

## ServerPagesForm

见[翻页](paging.md#脚本端)。
