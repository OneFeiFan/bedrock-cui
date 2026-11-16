# 图片与贴图

## Image

`Image` 显示一张贴图。参数是资源包中的贴图路径，不含扩展名：

```js
import { Image } from 'bedrock-cui'

new Image('textures/items/diamond').setSize(16, 16)
```

默认情况下，图片保持贴图的宽高比，在控件范围内按比例缩放并居中。需要拉伸铺满时（例如纯色或渐变的贴图），关闭保持宽高比：

```js
import { Image, Length, Size, Texture } from 'bedrock-cui'

new Image(Texture.SOLID).setKeepRatio(false).setSize(Length.pct(100), 1)   // 一条横线
```

## 九宫格

九宫格贴图将四角保持原样，四边和中间拉伸，适合做边框和底板。游戏从贴图同名的 `.json` 文件中读取 `nineslice_size`。在 bedrock-cui 中，九宫格的边宽也可以直接在控件上设置：

```js
import { Image, Size } from 'bedrock-cui'

new Image('textures/ui/purpleBorder').setNineslice(4).setSize(Size.full())
```

::: warning
九宫格图片的尺寸小于左右（或上下）边宽之和时，游戏中的绘制结果与预览不同：四角会画到控件范围之外，颜色也会变深。静态检查对此报告 `nineslice-too-small`。
:::

## 贴图信息

静态检查和浏览器预览需要知道贴图的尺寸和九宫格边宽。配置的 `textures` 列出存放贴图的资源包目录，bedrock-cui 从中读取 PNG 的尺寸和同名 `.json` 中的九宫格信息：

```js
// cui.config.mjs
export default defineConfig({
    // ……
    textures: ['res'],
})
```

在这些目录中找不到的贴图（例如原版贴图），静态检查跳过与其尺寸相关的判断，浏览器预览中显示为紫黑格。

## 颜色与透明度

`setColor()` 对贴图染色，`setAlpha()` 设置不透明度（0 到 1）：

```js
import { Color, Image, Texture } from 'bedrock-cui'

new Image(Texture.SOLID).setColor(Color.hex('#5b3a1c')).setAlpha(0.8)
```

## 取样区域与按比例裁剪

`setUV(u, v, 宽, 高)` 只显示贴图中的一块区域，单位是贴图像素。

`setClipRatio(方向, 比例)` 按比例裁去图片的一部分，比例可以是数字或[表达式](bindings.md)，常用于进度条。方向与比例的含义同 JSON UI 的 `clip_direction` 与 `clip_ratio`：

```js
import { Image } from 'bedrock-cui'

new Image('textures/ui/experience_bar_full_white').setSize(100, 5).setClipRatio('left', 0.4)
```
