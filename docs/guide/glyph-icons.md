# 字形图标

## 用途

服务端脚本在运行时生成的文字（例如按玩家背包拼出的物品列表），内容在构建时未知，无法使用[行内图标](inline-icons.md)。这类文字中的图标通过字形实现：将物品贴图放入资源包的字形图（`font/glyph_XX.png`），文字中写入对应的字符，游戏绘制该字符时显示图标。

## 定义字形

`GlyphSheet` 对应一张字形图，`icon()` 在其中登记一个图标：

```js
import { GlyphSheet } from 'bedrock-cui'

export const GLYPHS = new GlyphSheet('E2')
export const GI = {
    DIAMOND: GLYPHS.icon('diamond', 'textures/items/diamond', { ink: [2, 12] }),
    SWORD: GLYPHS.icon('diamond_sword', 'textures/items/diamond_sword'),
}
```

`GlyphSheet` 的参数是字形页，取值 `E2` 到 `F8`（原版使用 `E0` 与 `E1`）。每页最多 256 个图标，第 n 个图标对应字符 `U+XX00 + n`。

`ink` 是图标在 16×16 贴图中的墨迹范围（左边第一列与宽度），决定字距。构建时 bedrock-cui 读取贴图核对墨迹，与代码不符时报告正确的值。

字形图在构建时生成：

```js
// 接上例
import { CuiApp } from 'bedrock-cui/node'

new CuiApp('book').glyphSheet(GLYPHS, (texture) => `res/${texture}.png`)
```

第二个参数将贴图路径转换为本机的 PNG 文件。

## 在运行期文字中使用

图标对象转换为字符串即其字符，可以直接拼接在脚本生成的文字中：

```js
// 行为包脚本
actionForm.button(`info|${GI.DIAMOND} 钻石 ×3\n${GI.SWORD} 钻石剑 ×1`)
```

显示这段文字的 `Label` 应设置行距：

```js
import { Label, Length, form } from 'bedrock-cui'

new Label(form.buttonText.minus('info|')).setSize(110, Length.auto()).setLineSpacing(6)
```

字形图标按 1:1 绘制，高 16 像素，以 8 像素高的文字行为中心，上下各超出 4 像素。行距设为 6 时，相邻两行的图标不会重叠。未设置行距的多行文字中出现字形图标时，静态检查报告 `glyph-line-overlap`。

::: warning
DDUI（Ore UI）的界面不读取字形图，字形图标在其中显示为方框。
:::
