# 更新记录

## 0.25.0

### 不兼容的变化

- 底层接口移出公开入口 `bedrock-cui`：`form`、`FormButton`、`FormGate`、`buttonPayload`、`CollectionItem`、`Pages`、`serverForm` / `serverTitle`，以及翻页的标记函数（`pagingButtons` 等）；`bedrock-cui/web` 的 `ServerPagesPreview`。
  删除 `bedrock-cui/runtime/server-pages`（`ServerPagesForm`、`lockCamera`、`showForm`）。
  界面请用界面文件编写：数据用 props，按钮用 `button().onClick()`，多页用 `pages`，客户端切换用 `Tabs`。
  它们仍在 `bedrock-cui/internal`（`ServerPagesForm` 在 `bedrock-cui/internal/server-pages`）中，供框架内部与测试使用，不出现在手册中，也不保证稳定。

### 不兼容的改动

- 构建与打包完全交给 sapdon：移除 `CuiApp.build()`、`Addon`、`PackFiles`。新建项目用 `bedrock-cui create`，已有的 sapdon 项目用 `useSapdon(config, { GRegistry, UISystemRegistry })`。
- 需要 Node.js 22.12 或更高版本（sapdon 4 用到了 `JSON.rawJSON`）。
- 移除参数对象写法：各控件只接受位置参数（`new Label('文字')`、`new Grid(3, 2)`），其余属性用 `setXxx()` 或 `set({ … })`；
  `pages.page()`、`link()`、`blocker()` 不再接受选项对象（改为返回控件后链式设置），`toggleOptions()` 删除；`ImageOptions` 等选项接口删除。
- 移除别名 `setGridPosition()`（用 `setGridPos()`）与 `Paragraph.scale`（用 `fontScale`）。

### 新增

- 命令行 `bedrock-cui create`、`dev`、`build`；项目配置 `defineConfig()`（`cui.config.mjs`），界面可写成 `{ build, routed }`。
- `form.buttonTexture`：图片显示表单按钮的图标，可显示任意已加载的贴图。
- `form.button(n)`：表单的第 n 个按钮，返回读取该按钮内容的容器（代替 `new CollectionItem('form_buttons', n)`）。
- 界面文件 `defineScreen({ id, props, state, computed, methods, onOpen, onUpdate, onClose, view })`：一个界面的数据、逻辑与视图写在一个文件中；
  props 显式声明 `{ type, default }`；视图从一个对象中解构 props、state、computed 与 methods（名字不能重复）；`button().onClick(方法, …参数)` 显式绑定，内置 `close`；
  深层响应式；逻辑中 `this.mc` 即 `@minecraft/server`；多页 `pages` / `layout` 与 `link` / `next` / `prev` / `back`；脚本中 `界面.open(玩家, props)`；
  事件 `this.emit()` / `界面.on()`；定时器 `this.setInterval()` / `this.setTimeout()`；状态变化时合并刷新。
- 选项卡 `Tabs`（客户端切换，原 `Pages` 的客户端用法）。
- 动画 `Anim`（alpha、offset、size、color、clip、wait；then、loop、setEasing），任何控件 `setAnims()`。
- `bedrock-cui create` 的模板改用界面文件。
- 浏览器预览：`bedrock-cui dev` 运行界面的逻辑（点击、状态、翻页、定时器；事件与聊天消息写进日志）；预览播放动画。
- 静态检查：带动画的文字不报 `text-overlap`；新规则 `decimal-arith`。`checkScripts()` 支持项目目录（原地检查 `scripts/`）。
- 表达式：`gte` / `lte` 编译为 `not <` / `not >`（`>=` 作为 `and` 的一边时游戏解析出错）；常量表达式编译为固定值。
- `Texture.SOLID` 未指定 `setKeepRatio()` 时拉伸铺满。
- 计时显示：`Timer`、`ProgressBar`（`setHead()`）、`Countdown`（`setBackground()`）：数值定起点、动画匀速走、裁剪封顶与遮挡，暂停、继续、重新打开后都在终点准确停下，计时期间与结束时都不刷新（没有底色的倒计时在结束时刷新一次，可用 `timerEndRefresh: false` 关闭）；位置绑定支持垂直方向。`Timer.of({ seconds, elapsed, running })` 由已有的数据构造计时器（绑定游戏中的对象）；传入的总时长与构建时不同时提示。
- 表达式：`not` 规范到表达式开头（消去双重否定，德摩根律）；预览中绑定的运算为整数除法（与游戏一致）。
- 界面文件写成紧凑的 JSON（`useSapdon` 传入 `addPacketResolver` 时；测试包的界面文件 3716 KB → 606 KB）。
- `bedrock-cui dev --game`：与游戏联动，`/connect` 后保存即构建并让游戏 `reload all`；新项目加 `npm run dev:game`。
- 行为包脚本更小：Unifont 字宽表改为游程编码（新建项目：开发模式约 160 KB，生产模式约 80 KB）。
- 手册网站：代码块复制按钮；在线示例的「代码 / 预览」标签页、修改并运行、参数滑块；「搭建界面」各章按读者反馈重写，「行内图标」并入「文字」。
- 手册：新增「界面文件」「数据（props）」「逻辑」「动画」，重写「工作原理」「快速上手」「翻页」「表达式」「脚本端」；
  底层 API（`form`、`FormButton`、`FormGate`、`CollectionItem`、`ServerPagesForm`）不再出现在手册与参考中，由界面文件代替。
- `Texture.SOLID`：内置纯白贴图，用到时构建自动写进资源包。原版的 `textures/ui/white` 四周有 2 像素黑边，不能当作纯色。
- `bedrock-cui/dom`：将控件树输出为普通网页。
- 预览（`bedrock-cui dev`）：字宽切换、缩放、控件边框；图片染色（`setColor()`）。
- 手册网站，含在线示例、组件页与 API 参考；适配手机阅读。

### 修复

- `set({ name })` 没有改变控件的名字（`name` 是字段，先前只写进了内部属性）。
- 使用字形图标时，第一次构建的包缺少字形图。
- 预览中的界面会盖住宿主页面的元素（`z-index`）。

0.25.0 之前的变化见 [docs/DESIGN.md](docs/DESIGN.md)。
