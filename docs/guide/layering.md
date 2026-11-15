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

位于同一层的控件，绘制顺序与代码中的书写顺序无关。游戏按以下步骤绘制一层：

1. 找出这一层的全部控件，按它们在控件树中出现的顺序排列。
2. 按材质分组：所有文字为一组，每种贴图各为一组。组的先后，由组内最早出现的那个控件决定。
3. 按组的先后依次绘制。后绘制的组盖在先绘制的组之上。

下面的示例中，「标题」、背景图和「钻石」都位于第 0 层：

```js preview=page 220x80
import { Anchor, Image, Label, Panel, Size } from 'bedrock-cui'

const page = new Panel().setSize(200, 60)
page.add(
    new Label('标题').setLayer(0).setAnchor(Anchor.TOP_CENTER),
    new Panel().setSize(110, 18).setAnchor(Anchor.BOTTOM_CENTER).add(
        new Image('textures/ui/purpleBorder').setSize(Size.full()),
        new Label('钻石').setLayer(0),
    ),
)
```

按上面的步骤：

1. 第 0 层的控件依次为：「标题」（文字）、背景图（紫框贴图）、「钻石」（文字）。
2. 分为两组：文字组包含「标题」与「钻石」，由于「标题」最先出现，文字组排在第一；紫框贴图组排在第二。
3. 先绘制文字组，再绘制紫框贴图组。背景图在「钻石」之后绘制，因此盖住了「钻石」。

「钻石」虽然写在背景图之后，但它与「标题」同属文字组，随文字组一起先于背景图绘制。

将「标题」移到背景图之后，这一层最先出现的变为背景图，紫框贴图组排在第一，「钻石」随文字组之后绘制，显示在背景图之上：

```js preview=page 220x80 {9}
import { Anchor, Image, Label, Panel, Size } from 'bedrock-cui'

const page = new Panel().setSize(200, 60)
page.add(
    new Panel().setSize(110, 18).setAnchor(Anchor.BOTTOM_CENTER).add(
        new Image('textures/ui/purpleBorder').setSize(Size.full()),
        new Label('钻石').setLayer(0),
    ),
    new Label('标题').setLayer(0).setAnchor(Anchor.TOP_CENTER),
)
```

该规则由真机测试得出，测试方法见[真机规则](reference/rules.md)。

## 实际编写时

不需要推算同一层内各组的顺序，只需让文字的层级高于与它重叠的图片。文字默认位于第 1 层，比默认在第 0 层的图片高一层，因此保持默认层级时不会出现上述情况。以上示例将文字设为第 0 层，仅用于演示该规则。

## 静态检查

文字与一张图片重叠，且图片的层级更高、或位于同一层而该贴图的批次晚于文字出现时，静态检查报告 `text-covered`，并指出遮挡它的图片。判断时只考虑会同时显示的控件，位于其他页的控件不计入。

保持文字的默认层级（比背景高一层）可以避免这类问题。
