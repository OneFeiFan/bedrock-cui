# 叠放

控件重叠时，哪一个画在上面，由层级决定。本节先给出实际编写时的做法，再介绍层级的规则，以及同一层内的绘制顺序。

## 实际编写时

保持文字的默认层级即可：文字默认位于第 1 层，比默认位于第 0 层的图片高一层，所以文字总是显示在同一容器的背景图之上。只有需要调整时，才用 `控件.setLayer(层级)` 指定层级。

下文的规则只在多个控件位于同一层、彼此重叠时才起作用。

## 层级

`控件.setLayer(层级)` 设置控件的层级，层级高的控件画在上面。层级相对于父控件累加：父控件在第 1 层、子控件设置 `setLayer(2)` 时，子控件实际位于第 3 层。

```js preview=row 140x40
import { Image, Label, Panel, Size } from 'bedrock-cui'

const row = new Panel().setSize(110, 18).add(
    new Image('textures/ui/purpleBorder').setSize(Size.full()),   // 图片默认在第 0 层
    new Label('钻石'),                                             // 文字默认在第 1 层：画在图片之上
)
```

## 控件树中的顺序

控件在组件树中的顺序，由代码中 `add()` 的顺序决定，按深度优先排列：先是容器的第一个子控件及其全部子孙，再是第二个子控件及其全部子孙，依此类推。例如：

```js
import { Image, Label, Panel } from 'bedrock-cui'

const page = new Panel().add(
    new Label('标题'),                       // 第 1 个
    new Panel().add(
        new Image('textures/ui/purpleBorder'),   // 第 2 个
        new Label('钻石'),                   // 第 3 个
    ),
)
```

## 同一层内的绘制顺序

同一层的控件，并不按控件树中的顺序逐个绘制，也不是「同一个容器内先来后到」。为了减少绘制的次数，游戏把同一层的控件按材质分组后再画（真机）：

1. 找出这一层的全部控件，按它们在控件树中的顺序排列。
2. 按材质分组：所有文字为一组，每种贴图各为一组。组的先后，由组内最早出现的那个控件决定。
3. 按组的先后依次绘制。后绘制的组盖在先绘制的组之上。

由于分组的范围是整个界面的同一层，不同容器中的控件也会互相影响。

下面的示例有意把两段文字都设为第 0 层，与背景图同层，以演示这条规则。第 0 层的控件依次为：「标题」（文字）、背景图（紫框贴图）、「钻石」（文字）：

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

1. 分为两组：文字组包含「标题」与「钻石」；由于「标题」最先出现，文字组排在第一，紫框贴图组排在第二。
2. 先绘制文字组，再绘制紫框贴图组。背景图在「钻石」之后绘制，盖住了「钻石」。

「钻石」虽然写在背景图之后，但它与「标题」同属文字组，随文字组一起先于背景图绘制。

把「标题」移到背景图之后（第 9 行），这一层最先出现的变为背景图，紫框贴图组排在第一，「钻石」随文字组在之后绘制，显示在背景图之上：

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


## 静态检查

文字与一张图片重叠，而图片的层级更高，或位于同一层、该贴图的组排在文字组之后时，静态检查报告 `text-covered`，并指出遮挡它的图片。只考虑会同时显示的控件，位于其他页的控件不计入。

保持文字的默认层级（比背景高一层），可以避免这类问题。
