# Toggle

`Toggle` 是可以选中的开关。同一组（`group`）的开关互斥，序号（`index`）标识组内的每个开关。外观由 `unchecked`、`checked`、`uncheckedHover`、`checkedHover` 四个状态面板组成。用法见[选项卡](../tabs.md#toggle)。

```js preview=card 200x60
import { Color, Image, Label, Panel, Row, Size, Texture, Toggle } from 'bedrock-cui'

const tab = (name, i) => {
    const t = new Toggle('tabs', i).setName(`tab_${i}`).setSize(50, 16)
    t.unchecked.add(new Label(name).setColor(Color.hex('#3c2814')))
    t.uncheckedHover.add(new Label(`§n${name}`).setColor(Color.hex('#3c2814')))
    t.checked.add(new Image(Texture.SOLID).setColor(Color.hex('#c8b48c')).setSize(Size.full()), new Label(`§l${name}`).setColor(Color.hex('#3c2814')))
    return t.setDefaultSelected(0)     // 同一组的开关都设置：默认选中第 0 个
}
const card = new Panel().setSize(180, 40).add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()), new Row().setGap(4).add(tab('物品', 0), tab('方块', 1), tab('生物', 2)))
```

点击后切换，表单不关闭。读取开关状态使用 `toggleState(开关名)`；几块内容之间的切换使用 [`Tabs`](tabs.md)。

## API

<!-- api: Toggle -->
**创建**

- `new Toggle(group: string, index: number)`

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `unchecked` | 只读 | `Panel` |  |
| `checked` | 只读 | `Panel` |  |
| `uncheckedHover` | 只读 | `Panel` |  |
| `checkedHover` | 只读 | `Panel` |  |
| `group` | `setGroup()` | `string` | 单选组名 |
| `index` | `setIndex()` | `number` | 组里的序号 |
| `radio` | `setRadio()` | `boolean \| undefined` | 单选（缺省 true） |
| `defaultSelected` | `setDefaultSelected()` | `number \| undefined` | 单选组初始选中的序号（同组应一致） |
| `defaultState` | `setDefaultState()` | `boolean \| undefined` | 非单选时的初始状态 |
| `lockedVisible` | `setLockedVisible()` | `boolean \| undefined` | 禁用（locked）时是否照常显示 |
| `focusPrecedence` | `setFocusPrecedence()` | `number \| undefined` | 默认聚焦优先级 |
| `stateFrom` | `setStateFrom()` | `Expr \| undefined` | 用表达式设定开关状态（只读全局绑定的条件 → 开关状态，别处再按开关名读） |

**方法**

| 方法 | 说明 |
|---|---|
| `slots()` | 状态面板（按钮 / 开关覆盖） |

另有所有控件共有的属性与方法，见 [Element](element.md)。
<!-- /api -->
