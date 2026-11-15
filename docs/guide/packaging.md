# 打包

## CuiApp.build()

`CuiApp.build()` 将界面、脚本与资源打包为附加包：

```js
import { CuiApp } from 'bedrock-cui/node'

await new CuiApp('book')
    .screen('cui_ui:book', root)
    .setTextures(['res'])
    .build({
        out: 'out',
        title: '物品图鉴',
        version: [1, 0, 0],
        uuidFile: 'book.uuid.json',
        scripts: 'scripts',
        resources: 'res',
    })
```

| 选项 | 说明 |
|---|---|
| `out` | 输出目录。生成 `<命名空间>_RP`、`<命名空间>_BP` 与 `<命名空间>.mcaddon`。 |
| `title` | 游戏中显示的包名，后面自动加上 RP、BP。默认为命名空间。 |
| `description` | 包的描述。 |
| `version` | 版本号，`[主, 次, 修订]`。 |
| `uuidFile` | 存放 UUID 的文件，不存在时生成。默认为 `<out>/<命名空间>.uuid.json`。 |
| `scripts` | 脚本目录，或「文件名 → 内容」的对象。入口为 `main.js`。 |
| `resources` | 复制到资源包的目录，或「包内路径 → 本机文件」的对象。 |
| `dependencies` | 脚本模块依赖。默认 `@minecraft/server` 2.0.0 与 `@minecraft/server-ui` 2.2.0。 |
| `check` | 是否对脚本做类型检查。默认 `true`。 |

`build()` 依次完成：编译界面并输出静态检查结果；生成清单；写入界面文件、字形图与资源；复制脚本与运行时，并改写运行时的导入路径；生成 `cui.generated.js`；打包为 `.mcaddon`；对脚本做类型检查。返回 `.mcaddon` 的路径。

## UUID

游戏通过 UUID 识别附加包。首次构建时生成的 UUID 写入 `uuidFile`，此后的构建沿用。UUID 文件应提交到版本库；UUID 改变后，游戏会将其视为另一个附加包。

## 类型检查

类型检查使用 TypeScript 编译器与 `@minecraft/server`、`@minecraft/server-ui` 的类型声明，需要将它们安装为开发依赖：

```bash
npm install -D typescript @minecraft/server @minecraft/server-ui
```

未安装 `typescript` 时，跳过类型检查并给出提示。单独检查一个行为包，使用 `checkScripts(行为包目录)`，它返回错误信息的数组。

## Addon

`Addon`（`bedrock-cui/node`）是 `build()` 所使用的底层工具，用于需要自行组织文件的场合：

```js
import { Addon } from 'bedrock-cui/node'

const addon = new Addon('book').setTitle('物品图鉴').setVersion(1, 0, 0).useUuidFile('book.uuid.json')
addon.resources.add('ui/book.json', { namespace: 'book' })
addon.behavior.add('scripts/main.js', 'console.log("loaded")')
addon.setScript('scripts/main.js')
addon.pack('out')
```

`resources` 与 `behavior` 的 `add()` 接受字符串、二进制数据或对象（按 JSON 写出），`addFrom(本机路径, 包内路径)` 复制本机的文件或目录。
