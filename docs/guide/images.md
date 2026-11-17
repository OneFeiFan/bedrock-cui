# 图片与贴图

`Image` 显示资源包中的一张贴图。本节介绍图片的缩放方式、九宫格、bedrock-cui 怎样读取贴图的信息，以及染色、取样区域与按比例裁剪。

## Image

`new Image(贴图路径)` 创建一张图片。路径是资源包中的贴图路径，不含扩展名：

```js
import { Image } from 'bedrock-cui'

new Image('textures/items/diamond').setSize(16, 16)
```

默认情况下，图片保持贴图的宽高比：在控件的范围内按比例缩放，并居中显示。需要把贴图拉伸到铺满控件时（例如用渐变的贴图做背景），调用 `图片.setKeepRatio(false)` 关闭保持宽高比：

```js
import { Image, Length } from 'bedrock-cui'

new Image('textures/ui/gradient').setKeepRatio(false).setSize(Length.pct(100), 8)
```

画纯色的矩形时，使用内置的纯白贴图 `Texture.SOLID`，再用 `setColor()` 染色。它未指定 `setKeepRatio()` 时自动拉伸铺满：

```js preview=bar 200x30
import { Color, Image, Panel, Texture } from 'bedrock-cui'

const bar = new Panel().setSize(180, 12).add(
    new Image(Texture.SOLID).setColor(Color.hex('#5b8c3a')).setSize(180, 4),     // 一条横线
)
```

原版的 `textures/ui/white` 不是纯色：它四周有 2 像素的黑边，拉伸后两端各有一段黑色（真机）。

## 九宫格

把一张带边框的贴图拉伸到很宽时，边框也会被拉宽、变形。九宫格把贴图分成九块：四个角保持原样，四条边只沿一个方向拉伸，中间向两个方向拉伸，边框因此保持粗细不变。它与安卓的「点 9 图」（9-patch）是同一种做法：

<figure class="nine-fig">
  <div class="nine-grid">
    <span class="c">角</span><span class="e">上边<small>横向拉伸</small></span><span class="c">角</span>
    <span class="e">左边<small>纵向拉伸</small></span><span class="m">中间<small>两个方向拉伸</small></span><span class="e">右边<small>纵向拉伸</small></span>
    <span class="c">角</span><span class="e">下边<small>横向拉伸</small></span><span class="c">角</span>
  </div>
  <figcaption>九宫格：角不拉伸，边沿一个方向拉伸，中间向两个方向拉伸</figcaption>
</figure>

`图片.setNineslice(边宽)` 设置角的大小（单位是贴图像素）。下面把同一张带边框的贴图拉伸到 160 × 24：上面不用九宫格（`setNineslice(0)`），边框被拉宽；下面用九宫格，边框保持原样：

```js preview=cmp 200x80
import { Image, Panel } from 'bedrock-cui'

const cmp = new Panel().setSize(180, 64).add(
    new Image('textures/ui/purpleBorder').setNineslice(0).setKeepRatio(false).setSize(160, 24).setOffset(0, -15),
    new Image('textures/ui/purpleBorder').setNineslice(4).setSize(160, 24).setOffset(0, 15),
)
```

::: warning
九宫格图片的尺寸小于左右（或上下）边宽之和时，游戏中的绘制结果与预览不同：四角会画到控件范围之外，颜色也会变深（真机）。静态检查对此报告 `nineslice-too-small`。
:::

## 贴图的信息从哪里来

静态检查和浏览器预览需要知道贴图的像素尺寸与九宫格的边宽。bedrock-cui 从项目中的贴图文件读取这些信息：

- 项目配置的 `textures` 列出存放资源包文件的目录。新建的项目中是 `res/`，构建时它的内容会复制进资源包，所以 `res/textures/ui/panel.png` 在游戏中的路径是 `textures/ui/panel`；
- 像素尺寸读自 PNG 文件本身；
- 九宫格的边宽读自与 PNG 同名的 `.json` 文件，例如 `panel.png` 旁边的 `panel.json`。游戏也从这个文件读取九宫格：

```
res/
└─ textures/
   └─ ui/
      ├─ panel.png
      └─ panel.json        { "nineslice_size": 4, "base_size": [16, 16] }
```

```js
// cui.config.mjs
import { defineConfig } from 'bedrock-cui'

export default defineConfig({
    namespace: 'book',
    screens: [ /* …… */ ],
    textures: ['res'],
})
```

在这些目录中找不到的贴图（例如原版的贴图），静态检查跳过与尺寸有关的判断，浏览器预览中显示为紫黑格（游戏中正常显示）。

## 颜色与透明度

`图片.setColor(颜色)` 给贴图染色，`图片.setAlpha(不透明度)` 设置不透明度（0 透明，1 不透明）：

```js preview=card 200x40
import { Color, Image, Panel, Texture } from 'bedrock-cui'

const card = new Panel().setSize(180, 24).add(
    new Image(Texture.SOLID).setColor(Color.hex('#5b3a1c')).setAlpha(0.6).setSize(180, 24),
)
```

## 取样区域

`图片.setUV(u, v, 宽, 高)` 只显示贴图中的一块区域，单位是贴图像素。例如一张 64 × 16 的贴图中横排着四个图标，`setUV(16, 0, 16, 16)` 只显示第二个：

```js
import { Image } from 'bedrock-cui'

new Image('textures/ui/icons').setUV(16, 0, 16, 16).setSize(16, 16)
```

## 按比例裁剪

`图片.setClipRatio(方向, 比例)` 按比例裁去图片的一部分，常用于进度条。比例为 0 时完整显示，为 1 时全部裁掉；方向表示可见部分靠在哪一侧，`'left'` 即可见部分靠左、从左往右填满：

```js preview=bar 200x30
import { Color, Image, Panel, Texture } from 'bedrock-cui'

const bar = new Panel().setSize(160, 8).add(
    new Image(Texture.SOLID).setColor(Color.hex('#cfc3a3')).setSize(160, 8),
    // 裁去 60%：左边 40% 可见
    new Image(Texture.SOLID).setColor(Color.hex('#3fa04a')).setSize(160, 8).setClipRatio('left', 0.6),
)
```

裁剪比例可以随时间变化（见[动画](animation.md)中的进度箭头）。它也可以绑定到数据，但绑定的运算只有整数，算出的比例只能是 0 或 1（真机，见[表达式](bindings.md#限制)）。
