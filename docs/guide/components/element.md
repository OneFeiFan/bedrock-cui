# Element

`Element` 是所有控件的基类。尺寸、位置、层级、显示条件、名称等属性，以及 `add()`、`remove()`、`clone()` 等方法，所有控件都可以使用。

```js
import { Anchor, Label, Panel } from 'bedrock-cui'

const panel = new Panel().setName('card').setSize(120, 40)
const label = new Label('钻石')
    .setAnchor(Anchor.TOP_LEFT)      // 位置：锚点与偏移
    .setOffset(4, 4)
    .setLayer(2)                     // 层级
    .setVisible(true)                // 显示条件，也可以是表达式
panel.add(label)
```

属性可以直接赋值，也可以通过 `setXxx()` 链式设置，或用 `set({ ... })` 一次设置多项，见[控件与组件树](../elements.md#属性)。

## API

<!-- api: Element -->
`Element` 是所有控件的基类，不直接创建。

**属性**

| 属性 | 设置方法 | 类型 | 说明 |
|---|---|---|---|
| `name` | `setName()` | `string \| undefined` |  |
| `props` | — | `Record<string, any>` |  |
| `children` | 只读 | `Element[]` |  |
| `parent` | — | `Element \| undefined` |  |
| `size` | `setSize(size: SizeValue)`<br>`setSize(width: LengthLike, height: LengthLike)` | `Size \| undefined` | 尺寸 |
| `offset` | `setOffset(offset: Vec2)`<br>`setOffset(x: LengthLike \| Expr, y: LengthLike \| Expr)` | `Vec2 \| undefined` | 偏移 |
| `anchorFrom` | `setAnchorFrom()` | `Anchor \| undefined` | 父控件上的锚点 |
| `anchorTo` | `setAnchorTo()` | `Anchor \| undefined` | 自身的锚点 |
| `layer` | `setLayer()` | `number \| undefined` | 层级（相对父控件） |
| `className` | `setClassName()` | `string \| undefined` | CSS 类名（只用于网页输出 bedrock-cui/dom；编译 JSON UI 时忽略） |
| `visible` | `setVisible()` | `boolean \| Expr \| undefined` | 是否显示：布尔或表达式（表达式 → 绑定） |
| `alpha` | `setAlpha()` | `number \| undefined` | 透明度 0–1 |
| `padding` | `setPadding()` | `Insets \| undefined` | 内边距（安全区） |
| `minSize` | `setMinSize(size: SizeValue)`<br>`setMinSize(width: LengthLike, height: LengthLike)` | `Size \| undefined` |  |
| `maxSize` | `setMaxSize(size: SizeValue)`<br>`setMaxSize(width: LengthLike, height: LengthLike)` | `Size \| undefined` |  |
| `grow` | `setGrow()` | `boolean` | 在 Row / Column 里沿主轴伸展 |
| `anchor` | `setAnchor()` | `Anchor \| undefined` | 锚点（父控件上与自身上用同一个点；分开指定用 anchorFrom / anchorTo） |
| `clip` | `setClip()` | `boolean` | 裁掉越出自身的子控件（clips_children） |
| `enabled` | `setEnabled()` | `boolean \| Expr \| undefined` | 能否交互（按钮 / 开关）：布尔或表达式 |
| `contain` | `setContain()` | `boolean` | 子孙不得越出本元素（含内边距）：静态检查 out-of-bounds |
| `overflow` | `setOverflow()` | `boolean` | 允许越界（提示框、弹出物）：contain 检查跳过 |
| `gridPos` | `setGridPos()` | `[number, number] \| undefined` | 在 grid 里的格位 [列, 行] |
| `variables` | `setVariables()` | `Record<string, unknown> \| undefined` | JSON UI 变量（$name → 值） |
| `anims` | `setAnims()` | `(string \| Anim)[] \| undefined` | 动画：Anim（编译时生成定义），或已有动画定义的引用（例如 '@my_ns.fade_in'） |

**方法**

| 方法 | 说明 |
|---|---|
| `add(...items: Addable[])` | 加子元素（字符串 = Label） |
| `clone()` | 深拷贝（子元素、状态面板、实例上引用的子元素都换成新副本；表达式是不可变的，共用） |
| `remove(el: Element)` |  |
| `set(props: Record<string, unknown>)` | 一次设置多项：`el.set({ size: Size.full(), layer: 2, color: Color.WHITE })` |
| `setWidth(w: LengthLike)` |  |
| `setHeight(h: LengthLike)` |  |
| `setPlacement(from: AnchorValue, to: AnchorValue)` | 分别指定父控件上的点（from）与自身上的点（to）：例如 from 右上、to 左上 = 贴在父控件右边外侧 |
| `allowOverflow(on = true)` | 同 setOverflow |
| `setVariable(name: string, value: unknown)` | JSON UI 变量（$name） |
| `setRaw(key: string, value: unknown)` | 逃生口：原样并入输出 JSON 的属性 |
| `setBindingAlways(on = true)` | 本元素的绑定一律 binding_condition: always（要在别的控件后来才出现时重新读取，例如读路由界面里的标记） |
| `find(name: string)` | 按名字找后代 |
| `slots()` | 状态面板（按钮 / 开关覆盖） |
<!-- /api -->
