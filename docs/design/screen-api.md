# 界面模型：单文件、选项式（设计）

状态：已与用户确认方向（2026-11）。**阶段 A 已完成并经真机确认**（测试包 1.36.0）；**阶段 B 已实现**（待真机确认，测试包 1.37.0）；阶段 C–E 未开始。

## 1. 要求（来自用户）

1. 控件仍是面向对象的（`new Label(…)`、`setXxx()`）；不要像 JSON 那样纯数据驱动。
2. **一个界面写在一个文件里**：视图与逻辑在同一个文件中，但分成清楚的几块、互不耦合（类似 Vue 的单文件组件）。选项式（Vue 2）为主，以后可以加组合式（`setup()`）。
3. 使用者**接触不到按钮序号与标记**：按钮用名字，由框架映射序号。
4. 不用全局的 `form` 对象：数据的来源与归属要一眼可见。
5. 引入更健康的写法：响应式状态、生命周期、视图与逻辑分离。

## 2. 讨论过、被否定的方案

| 方案 | 否定的原因 |
|---|---|
| 全局 `form`（`form.text`、`form.button(n)`） | 不知道它是哪个表单、和哪个界面绑在一起；按钮相关的读取只在特定容器内有效，写法上看不出 |
| `defineScreen((form) => …)` 里用 `form.value(名字)` 返回一个「装着值的容器」 | 把游戏的技术限制（按钮数据只能在对应的容器内读取）暴露给使用者；`form.value` 是什么讲不清 |
| 在函数顶部用 `form.text('x')` 声明数据 | 新手想不到要先在 `form` 上声明，会直接写普通变量 |
| 隐式 props（用到 `props.x` 就算定义） | 不知道界面接收哪些数据；界面里拼错名字会悄悄多出一个 prop |
| `defineScreen(fn).defineProps({…})` 链式 | 定义、视图、按钮挤在一个调用里 |
| 界面类（`class Shop extends Screen`）＋ 脚本端的逻辑类，分两个文件 | 视图与逻辑跨文件，不好沟通 |

## 3. 运行时间与地点（决定了设计的边界）

| | 视图（`view`） | 逻辑（`state`、`computed`、`methods`、生命周期） |
|---|---|---|
| 何时运行 | **构建时**运行一次，编译为 JSON UI | **游戏运行时** |
| 在哪里运行 | Node（构建工具）；编译结果在客户端显示，客户端不能运行 JavaScript | 行为包脚本（QuickJS） |
| 能用什么 | `props`（占位，编译为绑定）、`button(名字)`、`pages(组名)`、控件 | 状态、玩家对象、游戏的脚本 API |

两者之间唯一的通道是服务端表单：逻辑 → 视图是打开表单时的标题、正文与按钮；视图 → 逻辑是玩家点击了哪个按钮。表单打开后内容不能修改，**更新 = 关闭后以新内容重新打开**（翻页已验证可做到鼠标不动连续点击）。

不能做到的：表单打开期间实时更新内容、实时的双向绑定（只有 DDUI 能做到，见 §9）。

## 4. 写法

```js
// ui/shop.screen.js
import { defineScreen, Anchor, Image, Label, Panel } from 'bedrock-cui'

export default defineScreen({
    id: 'cui_ui:shop',

    // ———— 数据：视图接收的 props 与默认值 ————
    props: {
        greeting: '欢迎光临',                                         // 文字
        item: { text: '钻石', icon: 'textures/items/diamond' },        // 文字与图标
    },

    // ———— 逻辑：在游戏中运行 ————
    state() { return { coins: 10 } },
    computed: {
        greeting() { return `金币：${this.coins}` },                  // 与 props 同名：由状态计算该 prop
    },
    methods: {
        buy() { this.coins -= 1 },                                    // view 中 button('buy') 被点击时调用
    },
    onOpen() { },
    onClose() { },

    // ———— 视图：返回控件树（构建时运行） ————
    view({ props, button, pages }) {
        return new Panel().setSize(200, 120).add(
            new Label(props.greeting).setSize(180, 10).setAnchor(Anchor.TOP_LEFT),
            new Image(props.item).setSize(16, 16),
            new Label(props.item).setSize(120, 10).setOffset(20, 0),
            button('buy').setSize(60, 18).setAnchor(Anchor.BOTTOM_RIGHT),
        )
    },
})
```

```js
// cui.config.mjs
import shop from './ui/shop.screen.js'
export default defineConfig({ namespace: 'shop', screens: [shop] })
```

```js
// scripts/index.js：只决定什么时候打开
import shop from '../ui/shop.screen.js'
world.afterEvents.itemUse.subscribe((e) => shop.open(e.source))
```

## 5. 各部分的规则

### 5.1 `id`
界面 id，必须以 `cui_ui:` 开头。

### 5.2 `props`
- 定义视图接收的数据，值为默认值。默认值的类型决定 prop 的种类：字符串（文字）；`{ text, icon }`（文字与图标）；数组（列表，元素为前两种之一，长度为最大项数）；布尔值（是否显示）。
- 一个 prop 的值，按以下顺序取第一个有的：`computed` 中的同名项 → `open(玩家, { … })` 传入的值 → 默认值。
- 浏览器预览使用默认值。

### 5.3 视图 `view({ props, button, pages })`
- 构建时调用一次，返回控件树。不能访问 `state`、`methods`。
- `props.x` 是占位（表达式），可用于：`Label` 的文字（取 prop 的文字）、`Image` 的贴图（取 prop 的图标）、`setVisible()`（prop 有值时显示）。列表用 `props.items[i]`。
- 使用 `props` 中没有定义的名字 → 静态检查报错（例：拼成 `props.greting`）。
- 显示 prop 的控件需要**像素尺寸**（读取按钮数据的方式决定），否则静态检查报错。
- 一个控件只用一个 prop（同时用两个 → 静态检查报错，提示拆成嵌套的两个控件）。
- `button(名字)` 返回可点击的按钮（`default`、`hover`、`pressed` 三个状态面板）。名字必须在 `methods` 中有同名方法，否则构建报错；同一名字只能创建一次。
- `pages(组名)` 返回 `Pages`；其中的服务端翻页箭头由框架处理，不需要在 `methods` 中写任何东西。

### 5.4 逻辑
- `state()` 返回初始状态。**每个玩家一个实例**：`shop.open(玩家)` 时创建（已打开则复用），关闭时销毁（`onClose` 之后）。
- `this`：可以读写状态（`this.coins`）、读 `computed`、调用 `methods`、`this.player`（当前玩家）、`this.close()`。
- `computed` 只用于计算 props（与 props 同名）；不同名的 computed 视为辅助值。
- `methods` 中与 `button()` 同名的方法在点击时调用；其他方法是普通的辅助方法。
- 生命周期：`onOpen()`（第一次打开前）、`onUpdate()`（点击按钮、方法执行完之后，重新打开之前）、`onClose()`（玩家按 Esc 关闭，或调用 `this.close()`）。
- **状态变化 → 重新打开**：方法或生命周期执行完后，若状态有变化，重新计算 props 并重新打开表单；同一轮的多次修改只重新打开一次。重新打开时，刚才点击的按钮获得默认焦点（与翻页相同的做法：每个按钮编译为普通版与聚焦版两个同序号按钮），鼠标不动也能连续点击。
- 遵守已知的真机规则：重新打开的过程中不向聊天栏发消息、不重复设置输入权限。

## 6. 编译：名字到序号

每个界面一个分配器：先按 props 定义的顺序分配（每个 prop 一个按钮，列表每项一个）；之后按创建的先后分配给 `button()`、翻页箭头与「原地不动」。构建生成的清单（写进 `cui.generated.js`）：

```js
{ id: 'cui_ui:shop', props: [{ name: 'greeting', index: 0, kind: 'text' }, { name: 'item', index: 1, kind: 'item' }],
  buttons: [{ name: 'buy', index: 2 }], paging: null }
```

- prop 的按钮文字为 `「标记」+ 文字`，标记由框架生成（例：`p0|`），视图显示时去掉；图标即按钮的图标。
- 视图中使用 prop 的控件，编译时自动包上读取对应按钮的容器（现在的 `CollectionItem` 编译方式，已真机验证），容器的尺寸与位置取自该控件。
- 使用者看不到 `form_buttons`、序号、标记、`CollectionItem`、`FormButton`、`ServerPagesForm`；它们成为内部实现。

## 7. 运行时

- `bedrock-cui/runtime/screens`：`defineScreen()` 在行为包中返回界面对象（`open`、`close`、`isOpen`）。打开时按清单生成 `ActionFormData`：标题 = 界面 id（翻页时附页名），正文为空，按钮按序号填入 props 的值与按钮的标记。
- 清单由 `cui.generated.js` 注册（脚本入口需要导入一次；构建时检查）。
- `bedrock-cui` 主入口的控件类会随视图代码进入行为包（视图不在运行时执行）。体积与 QuickJS 的加载耗时需实测；必要时在构建时去掉视图部分（见 §9）。

## 8. 预览

`bedrock-cui dev` 用 props 的默认值显示视图。逻辑是普通的 JavaScript，也可以在浏览器中运行：点击按钮 → 调用方法 → 状态变化 → 重新计算 props → 预览更新，在浏览器中就能试完整的交互。

## 9. 未决的问题

- **视图代码进入行为包**：sapdon 的 rollup 配置不由 CUI 控制，无法直接加去掉视图的转换。先实测体积与加载耗时，再决定（可能请 sapdon 提供插件钩子）。
- **输入控件**：`ModalFormData`（文本框、滑块、下拉框、开关）的值在提交时传回脚本。能否像 `ActionFormData` 一样改写外观，需研究原版界面定义并真机测试。
- **实时更新与双向绑定**：只有 DDUI（`CustomForm`、`ObservableString` 等，`@minecraft/server-ui` 2.2.0 起）能做到，外观由 Ore UI 绘制。可评估为 DDUI 另做一层类 Vue 的写法。
- **组合式**：`setup()` 写法在选项式稳定后再加。
- **界面内部的状态**（标签页、展开折叠）：用开关在客户端切换，不经过脚本。写法（类似 `v-model` / `v-show`）待设计。

## 10. 迁移

- 删除公开的全局 `form`、`form.button(n)`、`FormGate`（由 `props` 的显示条件代替）；`FormButton`、`CollectionItem`、`ServerPagesForm` 转为内部。
- 配置的 `screens` 改为界面对象的数组（`id` 在界面中）。
- 手册的服务端部分按新模型重写（在实现完成之后）。

## 11. 阶段与验证

| 阶段 | 内容 | 验证 |
|---|---|---|
| A ✅ 已实现 | `defineScreen` 的视图部分：`props` 占位、`button(名字)`、分配器、自动包容器、静态检查规则、清单生成 | 单元测试 5 条；`npm run dev` 预览；真机测试包 1.34.0 的 props 演示（绿宝石右键） |
| B | 运行时：`open` / `close`、按名字填按钮、点击调用方法、`computed`、生命周期 | 真机：点击后方法被调用、props 正确 |
| C | 状态变化自动重新打开、点击的按钮保持焦点 | 真机：连续点击、无闪烁、无「消失几秒」 |
| D | 预览中运行逻辑 | 无头浏览器 |
| E | 迁移示例与模板、删除旧的公开 API、重写手册 | 手册检查、端到端 |

## 12. 阶段 A 的实现记录

- `src/core/expr.ts`：集合来源可带 `index`；`PropRef`（本身是「按钮文字去掉标记」的表达式；`.icon` 取图标、`.present` 为「包含标记」）；`propIndices()`。
- `src/core/element.ts`：`Image.texture` 收到 `PropRef` 取 `.icon`，`visible` 收到 `PropRef` 取 `.present`；快照时 `wrapProp()` 给使用 prop 的控件包上 `collection_item` 容器（位置与尺寸移到容器，控件改为填满容器、路径加 `/value`；一个控件用两个 prop 时报错）。
- `src/core/screen.ts`：`defineScreen` / `Screen`（`build()` 返回控件树与清单；`previewForm()`）；标记为 `@p序号|`（prop）与 `@b序号|`（按钮）。
- `FormButton` 改尺寸时同步内部按钮；`Pages._useAllocator()` 与界面共用分配器；`collection-item-size` 改为错误。
- `CuiApp.addScreen()`；配置的 `screens` 可以是界面数组，映射写法中的值也可以是界面对象；`cui.generated.js` 增加 `screens`（清单，附翻页路由表）。
- `bedrock-cui dev`：defineScreen 的界面用 props 的默认值预览，点击按钮时日志显示名字。
- 分配顺序：先 props（定义顺序），之后按创建的先后（与原设计「按钮 → 翻页」不同，示例中先创建 pages 时翻页箭头先拿到序号）。

### 阶段 A 真机测试（1.34.0）

- 行为完全符合预期（用户确认）。
- 发现：点得多或点得快时，有概率整个表单直接关闭。推测：点击后表单关闭、脚本立刻 `show()` 新表单时，上一个表单还没关完，游戏以 `UserBusy` 取消；
  测试脚本把所有取消都当作玩家关闭。处理（1.35.0）：运行时新增 `showForm()`，`UserBusy` 时每 2 刻重试、最多约 1.5 秒；`ServerPagesForm` 与测试脚本改用；
  仍被取消且原因不是 `UserClosed` 时，测试脚本在聊天栏打印原因（待真机确认）。阶段 B 的运行时一律通过 `showForm()` 打开。
- 待办：`checkScripts()` 在 sapdon 流程中应检查项目的 `scripts/` 源码（打包产物已内联运行时，检查会误报）；缺省入口已从 `scripts/main.js` 改为 `scripts/` 下全部 `.js`，用法需重新验证并改手册。
- 1.35.0「没用」（用户）：重试 UserBusy 不能解决。重新对照真机规则后的推测：表单重新打开后鼠标没动，点击交给默认焦点（游戏只在鼠标移动时重新判断悬停），
  演示界面没有为「点我」设置默认焦点，连续点击落到了「close」上——测试脚本对 close 不打印，所以聊天栏没有任何提示。
  处理（1.36.0）：`button()` 返回 `ScreenButton`，内部是同一序号的普通版（优先级 10）与聚焦版（100，标记 `@b序号|F`），与服务端翻页箭头相同；
  清单的按钮增加 `focusTag`；因点击而重新打开时，脚本给刚才点击的按钮发送聚焦标记。原计划在阶段 C 的「点击的按钮保持焦点」提前到阶段 A。
  诊断：表单因点击而关闭时，测试脚本打印按钮名字（重新打开的过程中不打印）。`showForm()` 的 UserBusy 重试保留（无害）。
- **1.36.0 真机确认（用户：「完全正常了」）**：快速连点不再关闭。结论：凡是「点击后关闭、随即重新打开」的表单，刚才点击的按钮都必须获得默认焦点（推广了服务端翻页时的规则）；
  已记入手册的真机规则。`showForm()` 的 UserBusy 重试是否必要未经证实，保留（无害）。

## 13. 阶段 B 的实现记录

- `src/runtime/screenRuntime.ts`：与平台无关的运行时（`ScreenRuntime`，平台接口 `FormPlatform`：show / close / lockCamera）。每个玩家一个实例；
  `this`（Proxy）：读写状态、读 computed、调用方法、`this.player`、`this.close()`；prop 的值依次取 computed、`open()` 传入的值、默认值；
  点击按钮 → 同名方法（可为异步，等待完成）→ `onUpdate` → 重新打开，刚才点击的按钮写聚焦标记；方法中 `this.close()` 后不再打开；翻页按钮交给路由表；
  取消（Esc）→ `onClose`、解除视角锁定、实例销毁。
- `src/runtime/screens.ts`（`bedrock-cui/runtime/screens`）：注入游戏的 `ActionFormData`、`uiManager.closeAllForms`、`showForm`、`lockCamera`，注册运行时。
- 核心 `Screen` 增加 `open()`、`close()`、`isOpen()`，转交给注册的运行时；没有注册时提示在脚本入口导入 `./cui.generated.js`。
- `cui.generated.js` 有界面时自动导入 `bedrock-cui/runtime/screens` 并 `registerScreens(screens)`。
- 测试：模拟平台 4 条（共 97 条）。
- 测试包 1.37.0：演示的逻辑移进界面文件（state、computed、methods、onClose），脚本只负责打开。行为包脚本 177 KB（1.36.0 约 108 KB）：
  多出的是界面文件的视图代码与控件类（游戏中不运行）。加载耗时待测（QuickJS），见 §9。
- 尚未做：脚本以外的状态变化（例如定时器）触发更新（阶段 C）。
