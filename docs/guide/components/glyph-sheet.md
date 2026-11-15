# GlyphSheet

`GlyphSheet` 对应一张字形图（emoji 页 `E2`–`F8`），用于在运行期文字中显示图标。图标由 `icon()` 登记，转换为字符串即其字符。

```js
import { GlyphSheet } from 'bedrock-cui'

export const GLYPHS = new GlyphSheet('E2')
export const GI = {
    DIAMOND: GLYPHS.icon('diamond', 'textures/items/diamond', { ink: [2, 12] }),
}
```

字形图在构建时生成，需要在配置的 `glyphs` 中登记。用法与限制见[字形图标](../glyph-icons.md)。

## API

<!-- api: GlyphSheet -->
**创建**

- `new GlyphSheet(page: string | number = 'E2', options?: { kind?: string })`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `page` | 只读 | `number` |  |
| `glyphs` | 只读 | `Glyph[]` |  |
| `fileName` | — | `string` | 资源包里的文件名 |

**方法**

| 方法 | 说明 |
|---|---|
| `icon(name: string, texture: Texture \| string, options: GlyphIconOptions = {})` | 加一个图标（16×16 贴图） |
| `GlyphSheet.lookup(char: string)` | 某个字符是不是字形图标（预览画图标用） |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
