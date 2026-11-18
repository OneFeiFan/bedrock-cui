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
| `Raw` | 类 | 原样输出的 JSON UI 元素。 |

## 组件

| 名称 | 种类 | 说明 |
|---|---|---|
| `Paragraph` | 类 | 较长的文字。默认软换行：交给游戏折行，调整汉字与英文、数字交界处的间隔。 |
| `Text` | 类 | 可插入行内图标的文字，由 bedrock-cui 排版。 |

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

## 界面（defineScreen）

| 名称 | 种类 | 说明 |
|---|---|---|
| `defineUI` | 函数 | 定义一个界面：id、props、state、computed、methods、生命周期与根页面 page（页面函数）。返回的对象有 open / close / isOpen / on / off。 |
| `PageFunction` | 类型 | 页面函数：参数是使用者在 props、state、computed、methods 中定义的名字，返回这一页的内容（通常是 Page）。 |
| `Page` | 类 | 一页内容；放在页面组中时缺省铺满页面组。 |
| `Router` | 类 | 一组子页面，由服务端切换（界面以那一页重新打开，鼠标不动也能连续点击）；startAt(名称)。每个界面最多一个。 |
| `Tabs` | 类 | 一组子页面，由客户端切换（表单不关闭）；startAt(名称)。界面重新打开后回到起始的一块。 |
| `Link` | 类 | 跳转元素：到某个子页面（new Link(名称) 或 new Link(组名:名称)）；selected 为目标页正在显示时的外观。 |
| `Back` | 类 | 跳转元素：返回上一次所在的页（Router）；没有历史时自动隐藏。 |
| `Prev` | 类 | 跳转元素：按定义的顺序到上一页；没有上一页时自动隐藏。 |
| `Next` | 类 | 跳转元素：按定义的顺序到下一页；没有下一页时自动隐藏。 |
| `NavButton` | 类 | Link、Back、Prev、Next 的共同父类：按钮的三个状态与 selected。 |
| `Close` | 类 | 关闭界面的按钮。 |
| `PropSpec` | 接口 | props 中一项的声明：{ type, default, of, max }（同 Vue 的 props）。 |
| `Item` | 类 | props 声明中的类型：文字与图标 { text, icon }。 |
| `MethodRef` | 接口 | 视图中方法的引用（从视图参数中解构得到），用于 button().onClick(方法, …参数)。 |
| `Screen` | 类 | defineScreen() 返回的界面对象：id；行为包脚本中的 open(玩家, props)、close(玩家)、isOpen(玩家)、on(事件名, 处理函数) / off()；构建时的 build()、previewForm()。 |

## 计时显示

| 名称 | 种类 | 说明 |
|---|---|---|
| `defineTimerHud` | 常量 | 定义独立的计时 HUD，支持最多三个计时器与标题通道管理。 |
| `TimerHud` | 类 | 计时 HUD：open / update / close / isOpen / showTitle。 |
| `EventProgressBar` | 类 | 计时 HUD 的进度条，由客户端在剩余时长内播放剩余宽度。 |
| `Timer` | 类 | 计时器：只记开始时刻与总时长；idle / of / start / pause / resume / reset；remaining、progress。驱动 ProgressBar 与 Countdown。 |
| `ProgressBar` | 类 | 进度条：随计时器匀速前进，界面重新打开时从当时的进度接着走，在右端准确停下；setHead() 末端的竖条。 |
| `Countdown` | 类 | 倒计时数字：剩余的整秒数，进行中时匀速滚动；setBackground() 有底色时在 0 处准确停下。 |

## 动画

| 名称 | 种类 | 说明 |
|---|---|---|
| `Anim` | 类 | 动画（客户端播放）：alpha、offset、size、color、clip（裁剪比例）、wait；then() 串成动画链，loop() 循环，setEasing() 设置缓动。用 setAnims() 加到任何控件上。 |

## 项目配置

| 名称 | 种类 | 说明 |
|---|---|---|
| `defineConfig` | 函数 | 定义项目配置（cui.config.mjs）：命名空间、界面、贴图目录、预览数据。bedrock-cui dev 与 useSapdon() 共用。 |
| `screenOf` | 函数 | 取出配置中一个界面的构建函数与选项。 |

## 表达式与响应式

| 名称 | 种类 | 说明 |
|---|---|---|
| `toggleState` | 常量 | 某个开关是否选中的表达式。 |
| `Expr` | 类 | 表达式。编译为 JSON UI 的绑定，由游戏在运行时求值。 |
| `signal` | 常量 | 创建一个信号（可观察的值），用于向浏览器预览提供数据。 |
| `Signal` | 类 | 信号。 |
| `computed` | 函数 | 由其他信号计算得出的信号。 |
| `effect` | 常量 | 信号变化时执行的回调。 |

## 编译与检查

| 名称 | 种类 | 说明 |
|---|---|---|
| `compileNamespace` | 函数 | 将控件树编译为一个 JSON UI 命名空间。 |
| `lint` | 函数 | 对控件树做静态检查。 |
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

## 类型

| 名称 | 种类 | 说明 |
|---|---|---|
| `ServerPaging` | 接口 | 一个界面的翻页路由表。 |
| `ServerArrowRoute` | 接口 | 路由表中的一个翻页箭头。 |
| `LintIssue` | 接口 | 静态检查的一项结果：rule、level、path、message。 |
| `TextureInfo` | 接口 | 贴图信息：size、nineslice、baseSize。 |
| `MetricsProfile` | 类型 | 字宽档案：'pc' 或 'android'。 |
| `SoftWrapOptions` | 接口 | softWrapText() 的选项。 |
| `WrapOptions` | 接口 | wrapText() 的选项。 |
| `PaginateOptions` | 接口 | paginate() 的选项。 |
| `CuiConfig` | 接口 | 项目配置。 |
| `CuiPreviewForm` | 接口 | 预览中某个界面的表单数据：title、text、buttons。 |
| `CuiScreen` | 类型 | 配置中的一个界面：返回根控件的函数，或 { build, routed }。 |
| `ScreenOptions` | 接口 | defineScreen() 的选项。 |
| `TimerHudOptions` | 接口 | defineTimerHud() 的选项。 |
| `TimerHudTransport` | 类型 | 计时 HUD 的传输方式：title（原版中央标题，缺省）或 actionbar（与原版标题、字幕同屏）。 |
| `TimerHudManifest` | 接口 | 计时 HUD 的槽位、协议与默认标题策略清单。 |
| `TimerHudRef` | 类 | 计时 HUD 视图中的单个计时器引用。 |
| `HudTitleOptions` | 接口 | 共享标题的时长、副标题与策略。 |
| `HudTitlePolicy` | 类型 | 共享标题策略：priority 或 actionbar。 |
| `HudTitleText` | 类型 | 普通标题或提示的文字与翻译消息。 |
| `AnimType` | 类型 | 动画的类型。 |
| `AnimEasing` | 类型 | 动画的缓动方式。 |
| `ScreenManifest` | 接口 | 界面的清单：props 与按钮的名字及其对应的表单按钮序号。 |
| `PropItem` | 类型 | 一个 prop 的值：文字，或 { text, icon }。 |
| `PropSlot` | 接口 | 一个 prop 占用的表单按钮：序号与标记。 |
| `TextMetrics` | 接口 | measureText() 的结果：lines、width、height。 |
| `LengthLike` | 类型 | 数字（像素）或 Length。 |
| `ExprLike` | 类型 | 表达式，或字符串、数字、布尔等字面值。 |
| `TextAlign` | 类型 | 文字对齐：'left'、'center'、'right'。 |
| `InlineIconSize` | 类型 | 行内图标的尺寸：8 或 16。 |
| `GlyphIconOptions` | 接口 | GlyphSheet.icon() 的选项。 |
| `LintOptions` | 接口 | 静态检查的选项：贴图信息、屏幕尺寸、字宽档案。 |
