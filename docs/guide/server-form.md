# 服务端表单

## 挂载方式

bedrock-cui 的界面显示在服务端表单（`@minecraft/server-ui` 的 `ActionFormData`）上。构建时，bedrock-cui 改写原版的 `ui/server_form.json`：

- 表单标题以前缀（默认 `cui_ui:`）开头时，隐藏原版的按钮列表；
- 表单标题包含某个界面 id 时，显示该界面。

界面在配置的 `screens` 中登记，键为界面 id：

```js
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'
import { buildBook } from './ui/book.mjs'
import { buildShop } from './ui/shop.mjs'

export default defineConfig({
    namespace: 'book',
    screens: {
        'cui_ui:book': () => buildBook(),
        'cui_ui:shop': () => buildShop(),
    },
})
```

同一个命名空间中可以挂载多个界面，脚本按标题打开其中之一：

```js
new ActionFormData().title('cui_ui:shop').body('').show(player)
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

`FormButton(序号, 标记, 宽, 高)` 是界面中的一个可点击区域，对应 `ActionFormData` 的第几个按钮。按钮的文字包含该标记时，按钮显示：

```js
import { Anchor, FormButton, Label } from 'bedrock-cui'

const close = new FormButton(0, 'close|', 14, 14).setAnchor(Anchor.TOP_RIGHT).setOffset(-4, 4)
close.default.add(new Label('§4x'))
close.hover.add(new Label('§cx'))
```

```js
// 行为包脚本：第 0 个按钮的文字包含 'close|'
new ActionFormData().title('cui_ui:book').body('').button('close|').show(player).then((r) => {
    if (r.selection === 0) player.sendMessage('已关闭')
})
```

点击表单按钮时，表单关闭，脚本通过 `selection` 得知点击的是第几个按钮。按钮的外观由 `default`、`hover`、`pressed` 三个状态面板组成。

按钮的文字不显示在界面上，可以携带数据：`'info|钻石 ×3'` 中，`info|` 用于判断是否显示，其余部分可通过 [`form.buttonText`](bindings.md) 读取。

::: tip
标记的判断方式是「包含」。标记不应是另一个按钮文字的一部分，例如 `prev|` 会误中 `no_prev|`。
:::
