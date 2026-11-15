# bedrock-cui/web

浏览器预览。

本页由 `scripts/gen-api-reference.mjs` 生成并与源码核对。详细用法见指南中的相关章节。

## 预览

| 名称 | 种类 | 说明 |
|---|---|---|
| `mountPreview` | 函数 | 在网页元素中按游戏的规则绘制界面。 |
| `ServerPagesPreview` | 类 | 在预览中模拟服务端翻页。 |
| `mountDevtools` | 函数 | 预览的调试面板：控件边框、表单数据。 |
| `loadPixelFonts` | 函数 | 加载预览使用的点阵字体。 |

## 类型

| 名称 | 种类 | 说明 |
|---|---|---|
| `PreviewOptions` | 接口 | mountPreview() 的选项。 |
| `PreviewTexture` | 接口 | 预览使用的贴图：地址与贴图信息。 |
| `Preview` | 接口 | mountPreview() 的返回值：表单数据的信号、resetToggles() 等。 |
