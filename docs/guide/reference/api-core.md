# bedrock-cui

控件、组件、值类型、表达式、编译与静态检查、文字排版。

本页由 `scripts/gen-api-reference.mjs` 生成并与源码核对。详细用法见指南中的相关章节。

## 控件

| 名称 | 种类 | 说明 |
|---|---|---|
| `Element` | 类 | 所有控件的基类：名称、尺寸、位置、层级、显示条件，以及 add()、remove()、clone()、find()、set()。 |
| `Panel` | 类 | 容器，没有外观。子控件按各自的锚点与偏移定位。 |
| `Image` | 类 | 图片。支持九宫格、染色、透明度、取样区域与按比例裁剪。 |
| `Label` | 类 | 文字。未设置宽度时不折行，设置宽度后由游戏折行。 |
| `Stack` | 类 | 子控件沿一个方向依次排列。 |
| `Grid` | 类 | 网格。 |
| `Row` | 类 | 横向的弹性布局：间距、主轴分布、交叉轴对齐、伸展。 |
| `Column` | 类 | 纵向的弹性布局。 |
| `Scroll` | 类 | 可滚动的区域，子控件纵向排列。 |
| `Button` | 类 | 按钮。外观由 default、hover、pressed 三个状态面板组成。 |
| `Toggle` | 类 | 开关。同组互斥；外观由四个状态面板组成。 |
| `CollectionItem` | 类 | 集合中的一项，例如第 n 个表单按钮。其内部可读取该项的数据。 |
| `Raw` | 类 | 原样输出的 JSON UI 元素。 |

## 组件

| 名称 | 种类 | 说明 |
|---|---|---|
| `Paragraph` | 类 | 较长的文字。默认软换行：交给游戏折行，调整汉字与英文、数字交界处的间隔。 |
| `Text` | 类 | 可插入行内图标的文字，由 bedrock-cui 排版。 |
| `Pages` | 类 | 多页内容：客户端开关切换，以及服务端翻页箭头。 |
| `FormButton` | 类 | 对应服务端表单第 n 个按钮的可点击区域，按钮文字包含标记时显示。 |
| `FormGate` | 类 | 表单正文包含标记时显示其内容的容器。 |

## 图标

| 名称 | 种类 | 说明 |
|---|---|---|
| `InlineIcon` | 类 | 行内图标，用于 Text。 |
| `GlyphSheet` | 类 | 一张字形图（emoji 页 E2–F8），用于在运行期文字中显示图标。 |
| `Glyph` | 类 | GlyphSheet 中的一个图标，转换为字符串即其字符。 |

## 值类型

| 名称 | 种类 | 说明 |
|---|---|---|
| `Length` | 类 | 一个方向上的尺寸：像素、百分比、子控件之和、填满等，可加减像素。 |
| `Size` | 类 | 宽与高。 |
| `Vec2` | 类 | 二维偏移。 |
| `Anchor` | 类 | 锚点，共九个。 |
| `Color` | 类 | 颜色。 |
| `Insets` | 类 | 内边距：左、上、右、下。 |
| `Texture` | 类 | 贴图路径，可附带尺寸与九宫格信息。 |
| `TextStyle` | 类 | 文字样式：颜色、阴影、字号、对齐。 |
| `Justify` | 枚举 | 弹性布局主轴方向的分布方式。 |
| `Align` | 枚举 | 弹性布局交叉轴方向的对齐方式。 |

## 项目配置

| 名称 | 种类 | 说明 |
|---|---|---|
| `defineConfig` | 函数 | 定义项目配置（cui.config.mjs）：命名空间、界面、贴图目录、预览数据。bedrock-cui dev 与 useSapdon() 共用。 |

## 表达式与响应式

| 名称 | 种类 | 说明 |
|---|---|---|
| `form` | 常量 | 服务端表单的数据：title、text、buttonText。 |
| `toggleState` | 常量 | 某个开关是否选中的表达式。 |
| `Expr` | 类 | 表达式。编译为 JSON UI 的绑定，由游戏在运行时求值。 |
| `signal` | 常量 | 创建一个信号（可观察的值），用于向浏览器预览提供数据。 |
| `Signal` | 类 | 信号。 |
| `computed` | 函数 | 由其他信号计算得出的信号。 |
| `effect` | 常量 | 信号变化时执行的回调。 |

## 编译与检查

| 名称 | 种类 | 说明 |
|---|---|---|
| `serverForm` | 函数 | 将界面挂载到服务端表单，返回界面文件与静态检查结果。 |
| `compileNamespace` | 函数 | 将控件树编译为一个 JSON UI 命名空间。 |
| `lint` | 函数 | 对控件树做静态检查。 |
| `serverTitle` | 函数 | 路由界面的表单标题。 |
| `escapeText` | 函数 | 转义文字中会被游戏特殊处理的开头字符（# 与 $）。 |

## 文字与字宽

| 名称 | 种类 | 说明 |
|---|---|---|
| `measureText` | 函数 | 模拟游戏的折行，返回各行、宽度与高度。 |
| `textWidth` | 函数 | 一段文字的宽度（界面像素）。 |
| `softWrapText` | 函数 | 软换行：返回交给游戏折行的文字。 |
| `wrapText` | 函数 | 按当前字宽计算每一行（硬换行）。 |
| `paginate` | 函数 | 长文本分页，默认按安卓字宽计算。 |
| `autoSpace` | 函数 | 在汉字与英文、数字之间加空格。 |
| `setMetricsProfile` | 函数 | 切换全局的字宽档案：pc 或 android。 |
| `withMetricsProfile` | 函数 | 在回调期间使用指定的字宽档案。 |
| `getMetricsProfile` | 函数 | 当前的字宽档案。 |
| `NBSP` | 常量 | 不换行空格（U+00A0）。 |
| `LINE_HEIGHT` | 常量 | 一行文字的高度：10 像素。 |

## 混合翻页

| 名称 | 种类 | 说明 |
|---|---|---|
| `pageTitle` | 常量 | 某一页的表单标题：<界面 id>\|P:<页名>;。 |
| `pagingButtons` | 函数 | 某一页的全部表单按钮文字。ServerPagesForm 与 ServerPagesPreview 共用。 |
| `pagingResponse` | 函数 | 点击某个按钮后的结果：翻页、原地不动或界面自己的按钮。 |
| `arrowTag` | 常量 | 翻页箭头按钮文字的标记。 |
| `STAY_TAG` | 常量 | 「原地不动」按钮文字的标记。 |

## 类型

| 名称 | 种类 | 说明 |
|---|---|---|
| `ServerPaging` | 接口 | 一个界面的翻页路由表。 |
| `ServerArrowRoute` | 接口 | 路由表中的一个翻页箭头。 |
| `FormButtonSpec` | 类型 | 一个表单按钮：文字，或 { text, icon }。 |
| `LintIssue` | 接口 | 静态检查的一项结果：rule、level、path、message。 |
| `TextureInfo` | 接口 | 贴图信息：size、nineslice、baseSize。 |
| `MetricsProfile` | 类型 | 字宽档案：'pc' 或 'android'。 |
| `SoftWrapOptions` | 接口 | softWrapText() 的选项。 |
| `WrapOptions` | 接口 | wrapText() 的选项。 |
| `PaginateOptions` | 接口 | paginate() 的选项。 |
| `CuiConfig` | 接口 | 项目配置。 |
| `CuiPreviewForm` | 接口 | 预览中某个界面的表单数据：title、text、buttons。 |
| `TextMetrics` | 接口 | measureText() 的结果：lines、width、height。 |
| `LengthLike` | 类型 | 数字（像素）或 Length。 |
| `ExprLike` | 类型 | 表达式，或字符串、数字、布尔等字面值。 |
| `TextAlign` | 类型 | 文字对齐：'left'、'center'、'right'。 |
| `InlineIconSize` | 类型 | 行内图标的尺寸：8 或 16。 |
| `GlyphIconOptions` | 接口 | GlyphSheet.icon() 的选项。 |
| `ServerFormOptions` | 接口 | serverForm() 的选项。 |
| `ServerFormPanel` | 接口 | serverForm() 中的一个界面：panelId、content、routed。 |
| `LintOptions` | 接口 | 静态检查的选项：贴图信息、屏幕尺寸、字宽档案。 |
