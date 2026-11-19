# Raw

`Raw` 原样输出一段 JSON UI，用于 bedrock-cui 没有提供的控件或属性（逃生口；组件树的写法见[控件与组件树](../elements.md)）。只需要给某个控件补一项属性时，用 [`Element`](element.md) 的 `setRaw(属性, 值)` 即可，不必改用 `Raw`。

```js
import { Raw } from 'bedrock-cui'

// 原样输出一个继承原版模板的控件
const slot = new Raw({ size: [18, 18] }, 'common.inventory_icon_panel')
```

`Raw` 的内容不经过 bedrock-cui 的排版、预览与静态检查：浏览器预览中不显示，尺寸、重叠等检查也跳过它。

<!-- api: Raw -->
**创建**

- `new Raw(json: Record<string, unknown>, template?: string)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `json` | `setJson()` | `Record<string, unknown>` | 原样输出的 JSON |
| `template` | `setTemplate()` | `string \| undefined` | 继承的模板（name@模板） |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
