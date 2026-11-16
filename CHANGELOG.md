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
- `bedrock-cui/dom`：将控件树输出为普通网页。
- 预览（`bedrock-cui dev`）：字宽切换、缩放、控件边框；图片染色（`setColor()`）。
- 手册网站，含在线示例、组件页与 API 参考；适配手机阅读。

### 修复

- `set({ name })` 没有改变控件的名字（`name` 是字段，先前只写进了内部属性）。
- 使用字形图标时，第一次构建的包缺少字形图。
- 预览中的界面会盖住宿主页面的元素（`z-index`）。

0.25.0 之前的变化见 [docs/DESIGN.md](docs/DESIGN.md)。
