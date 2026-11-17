# Tabs

`Tabs` 是一组在客户端切换的内容（选项卡）：用开关切换，表单不关闭。用法见[选项卡](../tabs.md)；需要在服务端切换（鼠标不动也能连续点击）时，用界面文件的[页面](../pages.md)。

```js preview=tabs 220x80
import { Anchor, Color, Image, Label, Panel, Size, Tabs, Texture } from 'bedrock-cui'

const INK = Color.hex('#3c2814')
const bag = new Tabs('bag').startAt('items').setSize(200, 40).setAnchor(Anchor.BOTTOM_CENTER)
bag.tab('items').add(new Label('这里是物品').setColor(INK))
bag.tab('blocks').add(new Label('这里是方块').setColor(INK))

const tab = (key, name, x) => {
    const t = bag.link(key).setSize(60, 16).setAnchor(Anchor.TOP_LEFT).setOffset(x, 4)
    t.unchecked.add(new Label(name).setColor(INK))
    t.checked.add(new Image(Texture.SOLID).setColor(Color.hex('#c8b48c')).setSize(Size.full()), new Label(`§l${name}`).setColor(INK))
    return t
}

const tabs = new Panel().setSize(200, 66).add(
    new Image('textures/ui/dialog_background_opaque').setSize(Size.full()),
    tab('items', '物品', 10), tab('blocks', '方块', 74),
    bag,
)
```

| 方法 | 作用 |
|---|---|
| `new Tabs(组名)` | 创建一组选项卡 |
| `选项卡.tab(名称)` | 创建一块内容，返回它的容器 |
| `选项卡.link(名称)` | 返回切换到这一块的开关 |
| `选项卡.startAt(名称)` | 一开始显示的一块（缺省为第一块） |
| `选项卡.showing(名称)` | 「这一块正在显示」的表达式 |
| `选项卡.attach(名称, 开关)` | 把自己编写的开关关联到这一块 |
| `选项卡.blocker(名称)` | 铺满、透明的开关，放在弹出层下面拦截点击 |
