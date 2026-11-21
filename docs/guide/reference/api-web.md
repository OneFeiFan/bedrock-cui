# bedrock-cui/web

浏览器预览。

本页由 `scripts/gen-api-reference.mjs` 生成并与源码核对。详细用法见指南中的相关章节。

## 预览

| 名称 | 种类 | 说明 |
|---|---|---|
| `mountPreview` | 函数 | 在网页元素中按游戏的规则绘制界面。 |
| `runScreenInBrowser` | 函数 | 在浏览器中运行界面文件的逻辑（bedrock-cui dev 与手册网站的预览共用）：点击 → 方法 → 重新显示；游戏 API 为模拟对象。 |
| `ScreenPreviewOptions` | 接口 | runScreenInBrowser 的选项：清单、路由表、预览的表单数据、日志。 |

## 类型

| 名称 | 种类 | 说明 |
|---|---|---|
| `PreviewOptions` | 接口 | mountPreview() 的选项。 |
| `PreviewTexture` | 接口 | 预览使用的贴图：地址与贴图信息。 |
| `Preview` | 接口 | mountPreview() 的返回值：表单数据的信号、resetToggles() 等。 |
