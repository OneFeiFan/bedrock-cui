# bedrock-cui/runtime

在行为包脚本中使用的运行时。放入行为包的方式见指南「脚本端」。

本页由 `scripts/gen-api-reference.mjs` 生成并与源码核对。详细用法见指南中的相关章节。

## 文字

| 名称 | 种类 | 说明 |
|---|---|---|
| `softWrap` | 函数 | 软换行：返回交给游戏折行的文字。结果缓存。 |
| `preWrap` | 函数 | 按 PC 字宽计算每一行，返回以换行符连接的文字。 |
| `paginate` | 函数 | 长文本分页：按每页可用的高度切分，返回各页的文字；默认按安卓字宽折行。 |
| `PaginateOptions` | 接口 | paginate() 的选项：height（必需）、firstHeight、profile，以及折行的选项。 |
| `wrapText` | 函数 | 按当前字宽计算每一行。 |
| `autoSpace` | 函数 | 在汉字与英文、数字之间加空格。 |
| `measureText` | 函数 | 模拟游戏的折行。 |
| `textWidth` | 函数 | 一段文字的宽度。 |
| `setMetricsProfile` | 函数 | 切换全局的字宽档案。 |
| `withMetricsProfile` | 函数 | 在回调期间使用指定的字宽档案。 |

## 类型

| 名称 | 种类 | 说明 |
|---|---|---|
| `SoftWrapOptions` | 接口 | softWrap() 的选项。 |
| `WrapOptions` | 接口 | preWrap() 的选项。 |
| `MetricsProfile` | 类型 | 字宽档案：'pc' 或 'android'。 |
