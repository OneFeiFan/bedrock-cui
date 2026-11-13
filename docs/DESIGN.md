# CUI 设计说明（v0.4）

## 1. 要解决的问题

写基岩版 JSON UI 的最大成本是**验证**：排版规则不直观（`keep_ratio` 缺省 true、`anchor_from` 是父控件上的点…），动态效果全靠
字符串形式的绑定表达式，任何错误都要进游戏才看得到。GuideBook 开发里连续几轮「改了没用」都出在这里。

CUI 的做法：**一棵对象树，三个出口**——

```
对象树（new Panel({...}).add(...)；自定义组件 = 子类）
   │ finalize()：拍成快照，给没写名字的元素分配确定的名字；Pages 等在此时收尾
   ▼
控件树 RNode ──► 编译器 compileNamespace() ──► JSON UI 命名空间文件（+ 静态检查）
   │
   └──► 排版引擎 layout()（纯函数）──► 浏览器预览 mountPreview()、单元测试
```

## 2. 分层与借鉴

| 层 | 文件 | 借鉴 | 说明 |
|---|---|---|---|
| 对象模型 | `core/element.ts` | Qt / Android View、你的原型 | **纯面向对象**：元素是类的实例，参数是普通对象，`add()` / `set()` / `clone()`；自定义组件 = 子类。没有标签、没有虚拟树包装函数 |
| 表达式 | `core/expr.ts` | Vue / Solid 的 computed；AsaJS 的表达式编译 | 带类型的构造器 → AST → ① 编译成 JSON UI 字符串 ② 预览里按 JSON UI 语义求值（字符串 `-` 去掉所有出现等） |
| 响应式 | `core/reactivity.ts` | Solid 的信号（原型保留） | **只在预览端用**：游戏界面里没有 JS，动态行为全部编译成绑定 |
| 排版 | `layout/units.ts`、`layout/engine.ts` | Yoga（React Native） | 纯函数实现 JSON UI 的排版规则，预览与单测共用 |
| 编译 | `mc/compile.ts` | mcbe-ts-ui、AsaJS | 确定命名；动态属性自动生成绑定；FormButton 用 sapdon 真机验证过的写法 |
| 检查 | `mc/lint.ts` | ESLint | 规则来自 sapdon `known-pitfalls.md` |
| 预览 | `web/index.ts` | Storybook；JsonForge 的画布 | 绝对定位画引擎算出的矩形；悬停 / 按下；开发面板 |

与现有项目的区别：AsaJS、mcbe-ts-ui 是 JSON UI 生成器，没有预览；JsonForge 是可视化编辑器。
CUI 的核心是「**对象模型 + 按游戏规则的预览 + 规则可测试**」。

### 开关分页（Pages，v0.3）

整本书放在一个表单里，翻页由客户端的单选开关完成（继承原版 `common.toggle`：`toggle_name` + `radio_toggle_group` +
`toggle_group_forced_index`），不关表单、不重开——GuideBook「翻页时视角偏转」的根因（两个表单之间的空档）随之消失。

- 每页 `visible` = 「任意一个指向本页的开关被选中」（`toggleState(a) or toggleState(b) …`）。单选组任一时刻只有一个开关选中，
  所以无论引擎会不会把同序号的开关一起选中，结果都对；每页有一个零尺寸锚点开关承载初始选中。
- 别的控件按**开关名**读状态（`source_control_name`，原版 `light_ui_toggle` 就是把开关控件命名为 `$toggle_view_binding_name`），
  所以开关名必须全局唯一（lint）；跨区域读取不写 `resolve_sibling_scope`（原版主界面标签页的写法）。
- 第二个 `Pages`（不同 group）= 独立状态：物品详情做成弹层，关掉后回到原来那页，不需要「历史记录」。
- 运行期数据仍来自表单：正文（`form.text`）与按钮文字（`CollectionItem` 里的 `form.buttonText`）。

### 真机确定的模式（测试包 1.0.0 – 1.0.2）

| 场景 | 做法 | 原因 |
|---|---|---|
| 读开关状态 | `toggleState(名字)`，不加 siblingScope | 缺省全局查找；加 `resolve_sibling_scope` 反而只找兄弟控件 |
| 一页有多个入口 | 每页 visible = 所有指向它的开关的「或」（Pages 自动生成） | 同序号的开关不会一起选中，只有被点的那个选中 |
| 弹层 | 第二个 Pages（独立组）＋ `pages.blocker(弹层所在页)`：透明、无声、指向弹层自己那一页的开关 | 弹层下面的开关能被点穿；拦截层层级更高、先接住点击；点它不改变状态，只有「关闭」才关 |
| 开关里显示表单按钮数据（物品格子悬停提示框） | 把 `CollectionItem` 放进开关的**状态面板里** | 开关内部读不到外层集合项的数据（common.toggle 的绑定遮住上下文）；lint：`collection-through-toggle` |

## 3. 已实现的 JSON UI 规则（排版引擎）

依据：Bedrock Wiki · JSON UI Documentation，以及 sapdon / GuideBook 的真机结论。

- 位置 = 父矩形上的 `anchor_from` 点 + `offset` − 自身的 `anchor_to` 点；缺省 center；百分比偏移相对父控件。
- 尺寸：像素；`%`；`%c`（stack 沿方向求和，其余取最大）；`%cm`；`%x` / `%y`；`fill`（stack 里平分剩余）；`default`（label = 文字尺寸，其它 = 100%）；混合表达式 `'100% - 2px'`。
- stack：沿方向依次摆放，交叉方向按锚点；`visible=false` 的子控件不占位。
- grid：格子 = 网格尺寸 / 行列数；`gridPos` 落格。
- layer 相对父控件累加；`clips_children` 裁剪子孙。
- image：`keep_ratio` 缺省 **true**，按贴图比例缩小居中；九宫格贴图直接拉伸。
- label：中文 8 像素、中文窄标点 3、ASCII 按 Minecraft 字宽表，行高 10；宽度确定时折行。

## 4. 验证状态（重要）

| 内容 | 状态 |
|---|---|
| keep_ratio 缺省 true、1×1 贴图在 116×18 里被画成居中方块 | ✅ 真机（GuideBook），预览复现一致 |
| 动态文字 `text: '#text'` + 声明 `#form_text` / 集合绑定 | ✅ 真机（GuideBook 的物品详情页、提示框） |
| FormButton 写法（common.button、form_button_click、正方形 grid + grid_position + 负偏移、前缀门控） | ✅ 真机（GuideBook） |
| 按钮文字带 RawMessage（附魔名按玩家语言） | ✅ 真机 |
| 字宽：中文 8、窄标点 3 | ✅ 真机截图校准 |
| 开关分页：服务端表单里的单选开关在客户端切换页面 | ✅ 真机（测试包 1.0.0） |
| `source_control_name` 缺省**全局查找**：任何位置都读得到任何位置的开关 | ✅ 真机（1.0.1 探针矩阵：4 个读取位置 × 4 个探针全「是」） |
| `resolve_sibling_scope: true` 把查找**收窄**到兄弟控件 | ✅ 真机（从页面深处加 sibling 读 4 个探针全「否」） |
| 同序号的开关**不会**一起选中，单选组里只有被点的那个选中 | ✅ 真机（1.0.1：只有被点的目录行「是」，同序号的锚点、箭头「否」）——「每页显示 = 任意入口被选中」是必需的 |
| 弹层下面的开关**能被点穿** | ✅ 真机（1.0.1）；1.0.2 垫底板开关后点不穿 ✅ 真机。1.0.3 改为透明、无声、点了不关弹层（`Pages.blocker()`） |
| 开关内部读不到外层集合项（表单按钮）的数据 | ⚠️ 真机现象（1.0.1 提示框没有运行期数据；该版脚本也没算背包数量）。1.0.2 改为在开关状态面板里放集合项并实时计算背包数量，待确认 |
| 文本：引擎自动折行时颜色 / 粗体是否延续到下一行；引擎折行的位置；ASCII / 粗体字宽；运行期长文本高度自动撑开 | ⏳ 测试包 1.1.0「文本测试」章节（折行对比、富文本、字宽标尺、长文本分页、运行期长文本） |
| 1.0.0 诊断页「全是否」 | 更正：不是查找范围问题，而是同序号不同步 + 从箭头进入诊断页（被点的开关不在列表里） |
| `%cm` / `%sm` / `fill` / grid 填充方向 / stack 交叉方向锚点 / 折行算法 | ⚠️ 按文档实现，未逐项真机校准 |

下一步建议做一个「校准屏」：同一份组件同时编译进游戏和在预览里截图，逐项对比，把 ⚠️ 变成 ✅。

## 4.0 长文本与富文本（v0.4）

- **格式码按基岩版**（`font/rich.ts`）：颜色 §0–§f ＋ 基岩版独有 §g（硬币金）与材料色 §h §i §j §m §n §p §q §s §t §u §v（§m / §n 是颜色，
  基岩版没有删除线 / 下划线）；§k 乱码、§l 粗体、§o 斜体、§r 重置；**换颜色不清掉粗体 / 斜体**（Java 版会清）。
- **两种折行**：
  - 静态文字用 `Paragraph` / `wrapText()` **预折行**：按字宽表、避头尾、中英文留空（中文标点后接英文也留，英文后接中文标点不留），
    **每行开头补上延续的样式码**，行宽留 8 像素给挂在行尾的标点 ⇒ 引擎不会再折一次，结果确定。
  - 运行期文字（表单正文、按钮文字）长度事先不知道：交给引擎折行（宽度固定、高度 default）。
- **分页** `paginate()`：预折行后按每页行数切块；孤行控制——页末是段落首行（标题、或段落只剩首行）就挪到下一页，页末不留空行。
- **静态检查** `text-overflow`：宽高都固定的文字框放不下静态文字。

## 4.1 预览精度：哪些和游戏一致、哪些是近似

| 内容 | 状态 |
|---|---|
| 位置、尺寸、图层、裁剪、keep_ratio | 按排版引擎（规则见 §3） |
| 九宫格 | 按贴图 `.json`：`nineslice_size` 的单位是 `base_size` 的格。原版 `cell_image.png` 是 10×10 像素、`base_size` 5×5 ⇒ 切贴图 2 像素、画到界面 1 像素（v0.3.1 之前只切 1 像素，格子边框画错）。切片覆盖整张贴图（`highlight_slot` 1×1）时按整张拉伸 |
| 贴图信息 | 用 `cui/node` 的 `textureInfoFrom([资源包目录…])` 直接读 PNG 宽高与同名 `.json`，不要手抄 |
| 文字位置 | **逐字定位**：每个字占的宽度严格按字宽表（与排版引擎一致），所以预览里的折行位置、文字长度就是引擎算的 |
| 文字字形 | **近似**：bedrock-samples 里没有字体点阵贴图，字形用系统字体（居中放在每个字的格子里） |
| 字宽表本身 | 中文 8、中文窄标点 3 已真机校准；ASCII、粗体 +1、斜体待测试包 1.1.0 的字宽标尺校准 |

## 5. 静态检查规则

| 规则 | 级别 | 出处 |
|---|---|---|
| `keep-ratio`：贴图会被按比例缩小居中（缺省 keep_ratio） | 警告 | known-pitfalls §4.20 |
| `collection-index`：不是合法属性 | 错误 | sapdon-ui.md §7.3 |
| `collection-ref-outside`：在 FormButton 外读 `#form_button_text` | 错误 | — |
| `collection-item-size`：集合项要写像素尺寸 | 警告 | known-pitfalls §4.20 的弯路 |
| `collection-through-toggle`：开关里读外层集合项的数据 | 错误 | 测试包 1.0.1 |
| `toggle-name-unique`：开关名全局唯一 | 错误 | 开关按名字全局查找 |
| `text-overflow`：固定高度的文字框放不下 | 警告 | — |
| `duplicate-name`、`bad-size` | 错误 | — |

## 6. 已知限制与路线图

1. 开关分页的真机结论回来后：确定同序号开关语义、弹层是否需要拦截输入（input_panel / modal）。
2. 模板与引用（`name@namespace.base`、变量覆盖），对原版界面的 `modifications`。
3. factory / 通用集合、scroll_view、文本输入、动画（anim_type）的类型化写法。
4. sapdon 适配器：写文件、维护 `_ui_defs.json`、挂到 server_form 的标题门控。
5. 其它后端：DDUI（server-ui 2.x 的 CustomForm）、Ore UI——JSON UI 已在弃用路线上，组件树与后端解耦就是为此准备。
6. 用 CUI 复刻 GuideBook（开关分页 + 物品详情弹层），作为第一个完整的验收对象。
