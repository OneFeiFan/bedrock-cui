# 更新记录

## 0.25.0

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
  按钮用名字（`button('buy')` 与 `methods.buy`），序号由 bedrock-cui 分配；脚本中 `界面.open(玩家, props)`；事件 `this.emit()` / `界面.on()`；
  定时器 `this.setInterval()` / `this.setTimeout()`；状态变化时合并刷新。
- 动画 `Anim`（alpha、offset、size、color、clip、wait；then、loop、setEasing），任何控件 `setAnims()`。
- `bedrock-cui create` 的模板改用界面文件。
- 浏览器预览：`bedrock-cui dev` 运行界面的逻辑（点击、状态、翻页、定时器；事件与聊天消息写进日志）；预览播放动画。
- 静态检查：带动画的文字不报 `text-overlap`；新规则 `decimal-arith`。`checkScripts()` 支持项目目录（原地检查 `scripts/`）。
- 表达式：`gte` / `lte` 编译为 `not <` / `not >`（`>=` 作为 `and` 的一边时游戏解析出错）；常量表达式编译为固定值。
- `Texture.SOLID` 未指定 `setKeepRatio()` 时拉伸铺满。
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
