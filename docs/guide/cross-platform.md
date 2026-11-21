# 跨平台

## 字宽差异

PC 与安卓使用不同的字体绘制汉字，字宽不同：

| | PC | 安卓 |
|---|---|---|
| 汉字 | 8.5 像素 | 9 像素 |
| 全角逗号 | 2 像素 | 9 像素 |
| 粗体每字增加（汉字） | 0.5 像素 | 1 像素 |

同一段文字，在安卓上通常比 PC 宽 5% 到 10%；全角标点较多时差异更大。按 PC 字宽排好的一行，在安卓上可能超出宽度，被游戏再次折行。

## 字宽档案

bedrock-cui 用字宽档案描述这一差异：`'pc'`（默认）与 `'android'`。排版、折行模拟与预览均按当前档案计算：

```js
import { measureText, withMetricsProfile } from 'bedrock-cui'

const text = '背包里一共11种物品，其中钻石有3个。'
measureText(text, 1, 110).lines.length                                   // PC 下的行数
withMetricsProfile('android', () => measureText(text, 1, 110).lines.length)  // 安卓下的行数
```

`setMetricsProfile(档案)` 切换全局的字宽档案（`'pc'` 或 `'android'`）；`withMetricsProfile(档案, 函数)` 只在函数运行期间切换，结束后恢复原来的档案。

## 框架中的处理

- **静态检查**按两种档案各排版一次，只在安卓上出现的问题注明「安卓字宽」。
- **`Paragraph` 与 `softWrap()`** 将折行交给游戏，由游戏按当前设备的字宽完成；交界处的间隔按两种档案的模拟结果选择。
- **`Text` 与 `paginate()`** 的折行由 bedrock-cui 计算，按较宽的安卓档案进行，因此在 PC 上每一行会略短于可用宽度。

这些函数的用法见[文字 · 运行期文字](text.md#运行期文字)。

## 其他平台

iOS、主机等平台的字宽尚未测试。由游戏完成折行的文字（`Label`、`Paragraph`）在这些平台上同样按其实际字宽折行；由 bedrock-cui 计算折行的 `Text` 与 `paginate()`，若该平台的字宽大于安卓，可能出现超宽。
