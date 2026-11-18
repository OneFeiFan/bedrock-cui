# 服务端表单

## 挂载方式

bedrock-cui 的界面显示在服务端表单（`@minecraft/server-ui` 的 `ActionFormData`）上。构建时，bedrock-cui 改写原版的 `ui/server_form.json`：

- 表单标题以前缀（默认 `cui_ui:`）开头时，隐藏原版的按钮列表；
- 表单标题包含某个界面 id 时，显示该界面。

界面在配置的 `screens` 中登记：

```js
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'
import book from './ui/book.screen.mjs'
import shop from './ui/shop.screen.mjs'

export default defineConfig({
    namespace: 'book',
    screens: [book, shop],
})
```

同一个命名空间中可以挂载多个界面，脚本调用界面的 `open()` 打开其中之一。标题与按钮数据由运行时填写：

```js
shop.open(player)
```

标题在界面 id 之后可以附加其他内容，例如[服务端翻页](paging.md)在标题中写入页码：`cui_ui:book|P:sword;`。

界面的根控件铺满整个屏幕。根控件中使用百分比尺寸时，按屏幕尺寸计算。

## 静态界面与路由界面

默认情况下，界面是静态的：表单打开时，命名空间中的所有界面都被创建，按标题决定显示哪一个。

将配置中的界面写成 `{ build, routed: true }` 时，界面改为路由方式：只在标题与界面 id 完全相同时创建。

```js
screens: { 'cui_ui:shop': { build: () => buildShop(), routed: true } }
```

::: warning
路由界面存在两个已知问题（真机测试）：默认焦点不可靠，鼠标不移动时连续点击翻页会跳到错误的页；界面中的百分比尺寸不按屏幕计算。只在界面使用固定像素尺寸、且不依赖默认焦点时使用路由方式。
:::

## 表单按钮

界面文件使用 `button().onClick(方法)` 创建可点击区域。`close` 是内置的关闭方法：

```js
import { Anchor, Label, Panel, defineScreen } from 'bedrock-cui'

const book = defineScreen({
    id: 'cui_ui:book',
    view({ button, close }) {
        const exit = button().onClick(close).setSize(14, 14).setAnchor(Anchor.TOP_RIGHT).setOffset(-4, 4)
        exit.default.add(new Label('§4x'))
        exit.hover.add(new Label('§cx'))
        return new Panel().setSize(200, 100).add(exit)
    },
})
```

点击表单按钮时，表单关闭，游戏通过 `selection` 将按钮序号传给运行时。bedrock-cui 调用绑定的方法，方法完成后以最新的数据重新打开界面；调用 `close` 时结束界面。按钮的外观由 `default`、`hover`、`pressed` 三个状态面板组成。

表单按钮也用于传递界面数据，序号与标记由框架分配，见[工作原理](how-it-works.md#按钮在-bedrock-cui-中的用途)。使用方式见[数据（props）](props.md)与[逻辑](logic.md)。
