# 静态检查

## 检查时机

静态检查在编译界面时进行。`CuiApp.build()` 与 `useSapdon()` 将结果输出到终端：

```
[bedrock-cui] 警告 out-of-bounds root/panel0/card/intro：越出 root/panel0/card 的安全区（右 70 像素）
```

每一项依次为级别、规则名、控件路径与说明。错误使构建失败，警告不影响构建。各规则的说明见[静态检查规则](reference/lint.md)。

不打包、只检查时，使用 `compile()`：

```js
import { Panel } from 'bedrock-cui'
import { CuiApp } from 'bedrock-cui/node'

const { issues } = new CuiApp('book').screen('cui_ui:book', new Panel()).compile()
for (const i of issues) console.log(i.level, i.rule, i.path, i.message)
```

## 控件路径

路径由各级控件的名称组成，以 `/` 分隔。未设置名称的控件按类型与顺序自动命名（`panel0`、`label1`），为需要定位的控件设置名称后，路径更易读。

## 边界检查

越界检查只针对声明了边界的容器。`setContain()` 声明子控件不得越出该容器（含内边距）：

```js
import { Insets, Panel } from 'bedrock-cui'

new Panel().setSize(116, 160).setPadding(Insets.of(3, 0, 3, 9)).setContain()
```

本来就位于容器之外的控件（提示框、弹出层），调用 `setOverflow()` 后不参与检查。

## 多种屏幕与字宽

使用百分比尺寸的界面，在多种屏幕尺寸下分别排版检查，默认为 400×300 与 240×135 两种。

与文字排版有关的规则，按 PC 与安卓的字宽各检查一次。只在安卓上出现的问题，说明末尾注明「安卓字宽」。

## 贴图信息

与贴图尺寸有关的检查（如 `keep-ratio`、`nineslice-too-small`）需要贴图信息，通过 `CuiApp.setTextures()` 提供，见[贴图信息](images.md#贴图信息)。
