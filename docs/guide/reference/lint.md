# 静态检查规则

`serverForm()`、`compileNamespace()` 与 `CuiApp.compile()` 返回的 `issues` 中，每一项包含规则名（`rule`）、级别（`level`）、控件路径（`path`）与说明（`message`）。`bedrock-cui dev` 将其显示在预览下方；构建时 `useSapdon()` 将其输出到终端，存在错误时构建失败。

与排版有关的规则按 PC 与安卓两种字宽各检查一次，只在安卓上出现的问题在说明末尾注明「安卓字宽」。

## 错误

| 规则 | 说明 |
|---|---|
| `bad-size` | 尺寸表达式无法解析。 |
| `collection-index` | 使用了不存在的 `collection_index` 属性（bedrock-cui 内部的读取方式出错，使用 props 与 `button()` 时不会出现）。 |
| `collection-ref-outside` | 表单按钮的数据在读取它的容器之外使用（使用 props 时由 bedrock-cui 处理，不会出现）。 |
| `collection-through-toggle` | 开关内部读取开关之外的表单按钮数据（使用 props 时由 bedrock-cui 在控件处读取，不会出现）。 |
| `duplicate-name` | 同一父控件中存在同名的子控件。 |
| `glyph-sheet` | 字形图标的墨迹与贴图不符；说明中给出正确的值。 |
| `inline-icon-in-label` | `InlineIcon` 用在了 `Label` 中。行内图标只能用在 `Text` 中。 |
| `toggle-index` | 开关序号不是非负整数。 |
| `toggle-name-unique` | 两个开关同名。开关按名称读取状态，名称必须在整个界面中唯一。 |

## 警告

| 规则 | 说明 |
|---|---|
| `collection-item-size` | 显示 props 的控件或 `button()` 没有像素尺寸，内容不会显示。用 `setSize(宽, 高)` 设置像素尺寸。 |
| `decimal-arith` | 绑定的运算中有小数常数（例如 `× 0.16`）。运算只有整数（真机），小数会按整数计算；改用整数，或让脚本直接传入算好的整数。 |
| `engine-wrap-short-line` | 由游戏折行的静态文字会在上一行末尾留下大段空白。应改用 `Paragraph`；运行期文字使用 `softWrap()`。 |
| `flex-overflow` | 弹性布局的内容在某种屏幕尺寸下放不下。会变长的内容应放进 `Scroll`，或调大 `setMinSize()`。 |
| `glyph-line-overlap` | 多行文字中的字形图标会压到相邻的行。应设置 `setLineSpacing(6)`。 |
| `grow-outside-flex` | `setGrow()` 用在了非 `Row`、`Column` 直接子控件的控件上，不起作用。 |
| `keep-ratio` | 图片会按贴图的宽高比缩小并居中，而不是铺满控件。需要铺满时调用 `setKeepRatio(false)`。 |
| `mixed-sources` | 一个表达式同时读取全局绑定与开关状态。开关变化时该表达式不会重新计算。 |
| `nineslice-too-small` | 九宫格图片小于其边宽之和，游戏中的绘制结果与预览不同。 |
| `obfuscated-unifont` | `§k` 与汉字在同一个文字控件中，游戏只显示为一串点。 |
| `out-of-bounds` | 控件越出了 `setContain()` 声明的边界；说明中给出方向与像素数。 |
| `runtime-text-unbounded` | 运行期文字的高度未知，可能越出边界。应放进固定高度并调用 `setClip()` 的容器，或 `Scroll`。 |
| `scroll-in-collection` | `Scroll` 放在集合项中，其内容读取不到集合项的数据。应将集合项放进 `Scroll`。 |
| `stack-cross-c` | `Stack` 交叉方向的尺寸使用了子控件之和（`Length.children()`）；要贴合最大的子控件，应使用 `Length.largestChild()`。 |
| `text-covered` | 文字被图片遮挡：图片层级更高，或位于同一层而该贴图的批次晚于文字出现。见[叠放](../layering.md)。 |
| `text-overflow` | 文字折行后的高度超出文字控件的高度。 |
| `text-overlap` | 两个文字控件互相重叠。 |
