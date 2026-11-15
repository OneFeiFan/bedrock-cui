# 浏览器预览

## 预览程序

`mountPreview()`（`bedrock-cui/web`）在网页中按游戏的规则绘制界面：

```js
import { mountPreview } from 'bedrock-cui/web'
import { buildBook } from './ui/book.js'

mountPreview(document.getElementById('app'), {
    root: buildBook,                       // 根控件，或返回根控件的函数
    viewport: [300, 220],                  // 模拟的屏幕尺寸（界面像素）
    scale: 3,                              // 放大倍数
    textures: {
        'textures/ui/purpleBorder': { url: '/textures/purpleBorder.png', size: [16, 16], nineslice: 4 },
    },
    fonts: { unifont: '/font/unifont.hex.gz', ascii: '/font/ascii.png' },
})
```

预览页面需要一个支持 ES 模块的开发服务器，例如 Vite。

## 字体

预览使用两种点阵字体：GNU Unifont（汉字等）与 Minecraft 默认字体（`ascii.png`）。两者都不随 bedrock-cui 分发，由 `scripts/fetch-fonts.mjs` 下载到本机：

```bash
node node_modules/bedrock-cui/scripts/fetch-fonts.mjs --out public/font
```

`--out` 指定存放的目录，应位于预览页面可以访问的静态资源目录中。`ascii.png` 从本机的 Minecraft Java 版客户端提取；找不到客户端时，从 Mojang 官方下载。未提供字体或加载失败时，预览改用系统字体，字宽与折行将与游戏不一致。

## 模拟表单数据

界面中的[表达式](bindings.md)读取表单的标题、正文和按钮文字。预览中通过 `title`、`formText`、`formButtons` 三个信号提供这些数据，修改信号的值，界面随之更新：

```js
// 接上例
import { signal } from 'bedrock-cui'

const formButtons = signal(['info|钻石 ×3', 'close|'])
const preview = mountPreview(el, { root, formButtons })

formButtons.value = ['info|钻石 ×5', 'close|']
```

`onFormButton(序号, 文字)` 在点击表单按钮时调用。使用服务端翻页的界面，用 `ServerPagesPreview` 处理翻页：

```js
import { ServerPagesPreview, mountPreview } from 'bedrock-cui/web'

const sim = new ServerPagesPreview(paging, () => ({ 0: 'close|' }))
const preview = mountPreview(el, {
    root, title: sim.title, formButtons: sim.formButtons,
    onFormButton: (i) => sim.press(i, preview),
})
```

## 安卓字宽

预览默认使用 PC 的字宽。在创建界面之前调用 `setMetricsProfile('android')`，预览改用安卓的字宽排版与绘制：

```js
import { setMetricsProfile } from 'bedrock-cui'

setMetricsProfile('android')
```
