# bedrock-cui/dom

网页输出：将控件树渲染为 HTML。

本页由 `scripts/gen-api-reference.mjs` 生成并与源码核对。详细用法见指南中的相关章节。

## 渲染

| 名称 | 种类 | 说明 |
|---|---|---|
| `renderHtml` | 函数 | 将控件树渲染为 HTML 字符串。 |
| `cssLength` | 函数 | 将 JSON UI 的尺寸写法转换为 CSS 长度。 |
| `formatCodesToHtml` | 函数 | 将含 § 格式码的文字转换为 HTML。 |

## 网页专用的元素

| 名称 | 种类 | 说明 |
|---|---|---|
| `Link` | 类 | 链接。 |
| `Html` | 类 | 原样插入的 HTML 片段。 |

## 类型

| 名称 | 种类 | 说明 |
|---|---|---|
| `RenderHtmlOptions` | 接口 | renderHtml() 的选项：assetUrl。 |
