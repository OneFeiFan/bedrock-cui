# Image

`Image` 显示一张贴图。参数是资源包中的贴图路径，不含扩展名。

```js preview=card 220x90
import { Anchor, Color, Image, Panel, Size } from 'bedrock-cui'

const card = new Panel().setSize(200, 70).add(
    // 九宫格：四角不变，四边与中间拉伸
    new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full()),
    // 保持宽高比（默认）：缩放到控件范围内并居中
    new Image('textures/items/diamond').setSize(24, 24).setAnchor(Anchor.CENTER_LEFT).setOffset(12, 0),
    // 拉伸铺满：用于纯色贴图
    new Image('textures/ui/white').setKeepRatio(false).setSize(120, 2).setColor(Color.hex('#a070f0')).setAnchor(Anchor.CENTER_RIGHT).setOffset(-12, 0),
)
```

九宫格、贴图信息、按比例裁剪等见[图片与贴图](../images.md)。

## API

<!-- api: Image -->
**创建**

- `new Image(texture: Texture | string | Expr)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `texture` | `setTexture()` | `Expr \| Texture` | 贴图（Texture、路径或表达式） |
| `keepRatio` | `setKeepRatio()` | `boolean \| undefined` | 保持宽高比（JSON UI 缺省 true；拉伸纯色贴图要关掉） |
| `nineslice` | `setNineslice()` | `number \| [number, number, number, number] \| undefined` | 九宫格边宽（贴图 .json 的 nineslice_size；通常跟着贴图走：Texture.withNineslice） |
| `baseSize` | `setBaseSize()` | `[number, number] \| undefined` | 九宫格的基准尺寸（贴图 .json 的 base_size；通常跟着贴图走：Texture.withBaseSize） |
| `uv` | `setUv()` | `[number, number] \| undefined` | 贴图上取样区域的左上角（像素） |
| `uvSize` | `setUvSize()` | `[number, number] \| undefined` | 贴图上取样区域的大小（像素） |
| `color` | `setColor()` | `Color \| undefined` | 染色 |
| `clipDirection` | `setClipDirection()` | `"left" \| "right" \| "up" \| "down" \| "center" \| undefined` | 按比例裁剪的方向（进度条） |
| `clipRatio` | `setClipRatio(ratio: number \| Expr)`<br>`setClipRatio(direction: 'left' \| 'right' \| 'up' \| 'down' \| 'center', ratio: number \| Expr)` | `number \| Expr \| undefined` | 按比例裁剪的比例（数字或表达式） |
| `anims` | `setAnims()` | `string[] \| undefined` | 动画（JSON UI anims：动画定义的引用，例如 '@my_ns.fade_in'） |

**方法**

| 方法 | 说明 |
|---|---|
| `setUV(u: number, v: number, w: number, h: number)` | 同时设取样区域的位置与大小 |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
