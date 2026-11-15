# 叠放

## 层级

`setLayer()` 设置控件的层级，层级高的控件绘制在上面。层级相对于父控件累加：父控件在第 1 层、子控件设置 `setLayer(2)` 时，子控件实际位于第 3 层。

```js
import { Image, Label, Panel, Size } from 'bedrock-cui'

const row = new Panel().setSize(110, 18)
row.add(
    new Image('textures/ui/purpleBorder').setSize(Size.full()),   // 第 0 层
    new Label('钻石'),                                             // 文字默认在第 1 层
)
```

文字控件默认位于第 1 层，图片默认位于第 0 层，因此文字总是显示在同一容器的背景之上。

## 同一层内的绘制顺序

同一层内的控件不按书写顺序绘制。游戏将同一层的控件按材质分批：所有文字为一批，每种贴图各为一批。各批按其在控件树中首次出现的顺序绘制，先出现的批次先绘制。

因此，文字与图片位于同一层时，谁在上面取决于整个界面中这一层是先出现文字还是先出现该贴图，与这两个控件的书写顺序无关：

```js
import { Anchor, Image, Label, Panel, Size } from 'bedrock-cui'

const page = new Panel().setSize(200, 100)
page.add(
    new Label('标题').setLayer(0).setAnchor(Anchor.TOP_CENTER),     // 第 0 层：文字这一批先出现
    new Panel().setSize(110, 18).add(
        new Image('textures/ui/purpleBorder').setSize(Size.full()),
        new Label('钻石').setLayer(0),                              // 被同一层后出现的图片批次盖住
    ),
)
```

在上面的示例中，「钻石」虽然写在背景图之后，但由于这一层的文字批次早于该贴图的批次出现，背景图会盖住文字。

该规则由真机测试得出，测试方法见[真机规则](reference/rules.md)。

## 静态检查

文字与一张图片重叠，且图片的层级更高、或位于同一层而该贴图的批次晚于文字出现时，静态检查报告 `text-covered`，并指出遮挡它的图片。判断时只考虑会同时显示的控件，位于其他页的控件不计入。

保持文字的默认层级（比背景高一层）可以避免这类问题。
