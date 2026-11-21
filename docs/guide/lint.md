# 静态检查

静态检查在编译界面时，找出界面在游戏中会出问题的地方：文字越出边界、文字互相重叠、文字被同一层的图片遮挡、只在手机上出现的折行问题等。本节介绍检查的时机、控件路径与检查的范围；各条规则的说明见[静态检查规则](reference/lint.md)。

## 检查时机

静态检查在编译界面时进行。`bedrock-cui dev` 将结果显示在预览下方；构建时，`useSapdon()` 将结果输出到终端：

```
[bedrock-cui] 警告 out-of-bounds root/panel0/card/intro：越出 root/panel0/card 的安全区（右 70 像素）
```

每一项依次为级别、规则名、控件路径与说明。错误使构建失败，警告不影响构建。各规则的说明见[静态检查规则](reference/lint.md)。

在脚本中获取检查结果时，使用 `CuiApp.fromConfig(配置).compile()`：

```js
import { CuiApp } from 'bedrock-cui/node'
import config from './cui.config.mjs'

const { issues } = CuiApp.fromConfig(config).compile()
for (const i of issues) console.log(i.level, i.rule, i.path, i.message)
```

## 控件路径

路径由各级控件的名称组成，以 `/` 分隔。未设置名称的控件按类型与顺序自动命名（`panel0`、`label1`），为需要定位的控件设置名称后，路径更易读。

## 边界检查

越界检查只针对用 `setContain()` 声明了边界的容器，用法见[尺寸与位置 · 声明边界](layout.md#声明边界)。

## 多种屏幕与字宽

使用百分比尺寸的界面，在多种屏幕尺寸下分别排版检查，默认为 400×300 与 240×135 两种。

与文字排版有关的规则，按 PC 与安卓的字宽各检查一次。只在安卓上出现的问题，说明末尾注明「安卓字宽」。

## 贴图信息

与贴图尺寸有关的检查（如 `keep-ratio`、`nineslice-too-small`）需要贴图信息，由配置的 `textures` 提供，见[贴图的信息从哪里来](images.md#贴图的信息从哪里来)。
