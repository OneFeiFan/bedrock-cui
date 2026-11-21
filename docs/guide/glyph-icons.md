# 字形图标

## 用途

行为包脚本在运行时生成的文字（例如按玩家背包拼出的物品列表），内容在构建时未知，无法使用[文字中的图标](text.md#文字中的图标)。这类文字中的图标通过字形实现：将物品贴图放入资源包的字形图（`font/glyph_XX.png`），文字中写入对应的字符，游戏绘制该字符时显示图标。

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

字形图在构建时生成，需要在配置的 `glyphs` 中登记：

```js
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'
import { GLYPHS } from './ui/glyphs.mjs'

export default defineConfig({
    // ……
    textures: ['res'],
    glyphs: [GLYPHS],
})
```

图标的贴图从 `textures` 列出的目录中查找。

## 在运行期文字中使用

图标对象转换为字符串即其字符，可以直接拼接在脚本生成的文字中：

```js
// 行为包脚本：作为界面的数据传入
bag.open(player, { info: `${GI.DIAMOND} 钻石 ×3\n${GI.SWORD} 钻石剑 ×1` })
```

显示这段文字的 `Label` 应设置行距：

```js
import { defineUI, Label, Page } from 'bedrock-cui'

const bag = defineUI({
    id: 'cui_ui:bag',
    props: { info: { type: String } },
    page({ info }) {
        return new Page().setSize(130, 60).add(new Label(info).setSize(110, 40).setLineSpacing(6))
    },
})
```

字形图标按 1:1 绘制，高 16 像素，以 8 像素高的文字行为中心，上下各超出 4 像素。行距设为 6 时，相邻两行的图标不会重叠。未设置行距的多行文字中出现字形图标时，静态检查报告 `glyph-line-overlap`。

## 限制

- **只能使用构建时打包的图标**。字形图在构建时由项目中的贴图生成，打包进资源包；运行时无法加入新的图标，也无法显示其他附加包中物品的图标。
- **字形页是全局共享的**。游戏中每个字形页只有一张图。另一个附加包若也使用了同一页（例如 `E2`），优先级较高的包会覆盖另一个，图标随之错乱。应选用不常见的页，并在发布说明中注明。
- DDUI（Ore UI）的界面不读取字形图，字形图标在其中显示为方框。

字形图标适用于图标夹在一段运行期文字中间的场合。在界面中的固定位置显示图标时，使用 `Image` 即可；图标由脚本在运行时决定时（例如显示其他附加包的物品），使用带图标的数据（`type: Item`），见[数据（props）](props.md)。
