# 生成普通网页

`bedrock-cui/dom` 把组件树渲染为普通网页的 HTML，同一套控件既可以编译为游戏的 JSON UI，也可以输出为网页；本手册网站的页面外框就是这样生成的。本节介绍渲染的方法、控件与 HTML 的对应关系和限制。

::: tip
本节介绍的不是游戏界面的预览。按游戏的字形与折行查看界面，使用[浏览器预览](preview.md)。
:::

## renderHtml

`renderHtml(控件)` 返回 HTML 字符串：

```js
import { Column, Panel, Row } from 'bedrock-cui'
import { Html, Link, renderHtml } from 'bedrock-cui/dom'

const nav = new Row().setGap(16).setClassName('topbar').add(
    new Link('index.html', 'bedrock-cui').setClassName('brand'),
    new Panel().setGrow(),
    new Link('introduction.html', '指南'),
)
const html = renderHtml(new Column().add(nav, new Html('<p>正文</p>', 'article')))
```

## 映射规则

| bedrock-cui | HTML 与 CSS |
|---|---|
| `Row`、`Column`、`Stack` | `display: flex`；`setGap()`、`setJustify()`、`setAlign()` 对应 `gap`、`justify-content`、`align-items` |
| `setGrow()`、`Length.fill()` | `flex: 1 1 0` |
| `Scroll` | 纵向 flex，`overflow-y: auto` |
| `Panel` 的子控件 | 按锚点与偏移绝对定位 |
| 数字尺寸、`Length.pct()` | `px`、`%` |
| `Length.pct(100).minus(6)` | `calc(100% - 6px)` |
| `Length.children()` | `fit-content` |
| `Label` | `<span>`；颜色、`setFontScale()`、阴影；§ 格式码转换为颜色、粗体、斜体 |
| `Image` | `<img>`；`setKeepRatio(false)` 对应 `object-fit: fill` |
| `setLayer()`、`setAlpha()`、`setPadding()` | `z-index`、`opacity`、`padding` |
| `setClassName()` | `class` 属性 |

文字由浏览器排版，可以选中和搜索，不使用游戏的字体与折行规则。按游戏的样子显示界面，应使用[浏览器预览](preview.md)。

## 网页专用的元素

| 元素 | 说明 |
|---|---|
| `Link(地址, 文字)` | 链接。不传文字时，内容由子控件组成。它从 `bedrock-cui/dom` 导入，与界面文件中跳转用的 `Link`（`bedrock-cui`）不是同一个。 |
| `Html(片段, 标签)` | 原样插入的 HTML，标签默认为 `div`。 |

这两种元素无法编译为 JSON UI，在游戏界面中使用时，静态检查报告 `web-only` 错误。`setClassName()` 只影响网页输出，编译 JSON UI 时忽略。

## 限制

`renderHtml()` 输出的是静态的 HTML：表达式（界面的数据、`toggleState()` 等）不求值，开关与选项卡不响应点击。贴图路径默认转换为 `<路径>.png`，可通过 `assetUrl` 选项指定：

```js
// 接上例
renderHtml(nav, { assetUrl: (texture) => `/assets/${texture}.png` })
```
