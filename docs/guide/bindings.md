# 表达式与绑定

## 表达式

界面中随运行时数据变化的部分用表达式描述。表达式在编译时转换为 JSON UI 的绑定，由游戏在运行时求值。

服务端表单提供三个数据来源：

| 表达式 | 内容 |
|---|---|
| `form.title` | 表单标题（`ActionFormData.title()`） |
| `form.text` | 表单正文（`ActionFormData.body()`） |
| `form.buttonText` | 当前表单按钮的文字，只能在 `FormButton` 或 `CollectionItem` 内部使用 |

表达式可以作为文字，也可以作为显示条件：

```js
import { Label, form } from 'bedrock-cui'

new Label(form.text)                                       // 显示表单正文
new Label('已解锁').setVisible(form.text.contains('#unlocked'))   // 正文包含 #unlocked 时显示
```

## 运算

表达式通过方法组合，每个方法返回一个新的表达式：

| 方法 | 含义 |
|---|---|
| `contains(x)` | 是否包含 x |
| `minus(x)` | 对字符串：去掉其中的 x；对数字：减法 |
| `plus(x)`、`times(x)`、`div(x)`、`mod(x)` | 拼接或算术运算 |
| `eq(x)`、`ne(x)`、`gt(x)`、`lt(x)`、`gte(x)`、`lte(x)` | 比较 |
| `and(x)`、`or(x)`、`not()` | 逻辑运算 |
| `isEmpty()` | 是否为空字符串 |

`minus()` 常用于去掉用作标记的前缀：

```js
import { Label, form } from 'bedrock-cui'

// 按钮文字为 'info|钻石 ×3' 时，显示 '钻石 ×3'
new Label(form.buttonText.minus('info|'))
```

## 读取表单按钮的文字

`ActionFormData` 的按钮文字除了显示在按钮上，也可以作为向界面传递数据的通道。`CollectionItem('form_buttons', 序号)` 读取第几个按钮，其内部的 `form.buttonText` 即该按钮的文字：

```js
import { CollectionItem, Label, Length, form } from 'bedrock-cui'

new CollectionItem('form_buttons', 5).setSize(110, 10).add(
    new Label(form.buttonText.minus('txt|')).setSize(110, Length.auto()),
)
```

`FormGate(标记)` 是一个容器，表单正文包含该标记时才显示其中的内容。

## 开关的状态

`toggleState(开关名)` 读取一个开关是否选中，用于显示条件：

```js
import { Label, toggleState } from 'bedrock-cui'

new Label('§a已选中').setVisible(toggleState('show_details'))
```

开关按名称查找，范围是整个界面。传入 `{ siblingScope: true }` 时，只在兄弟控件中查找。

::: warning
以下行为由真机测试得出：

- 绑定读取不到数据时（例如按钮序号超出了脚本实际发送的按钮数），目标属性保持默认值，不会报错。
- 开关状态的变化与一个全局绑定使用相同的表达式时，该全局绑定不会因开关变化而重新计算。
:::
