# CUI

一棵组件树 → **基岩版 JSON UI** ＋ **浏览器预览**（按游戏的排版规则画）。

```tsx
/** @jsxImportSource cui */
import { FormButton, FormGate, buttonPayload, compileNamespace } from 'cui'

function Row(props: { index: number, icon: string, text: string, y: number }) {
    return <FormButton index={props.index} tag={`l${props.index}|`} size={[116, 18]} anchor="top_left" offset={[0, props.y]}
        hover={<image texture="textures/guide/row_hover" keepRatio={false} size={['100%', '100%']} />}>
        <image texture={props.icon} size={[16, 16]} anchor="left_middle" offset={[3, 0]} />
        <label text={props.text} anchor="left_middle" offset={[23, 0]} />
    </FormButton>
}

const { json, issues } = compileNamespace('my_book', {
    page: <FormGate tag="HOME;"><Row index={4} icon="textures/items/book_normal" text="入门" y={20} /></FormGate>,
})
```

- **组件**：函数组件、Fragment、Context，元素是不可变纯对象（参考 React）；`h()` 或 JSX 都行。
- **绑定表达式**：`form.text.contains('HOME;')`、`buttonPayload('l0|')`——同一个表达式编译成 JSON UI 绑定字符串，也在预览里求值。
- **排版引擎**（纯函数）：锚点、全部尺寸单位（`%` `%c` `%cm` `%x` `%y` `fill` `default`、`'100% - 2px'`）、stack、grid、layer、clip、keep_ratio、文字折行。预览与单测共用。
- **编译器**：名字确定可复现；动态属性自动生成绑定（`text: '#text'`、声明 `#form_text`、字面量提升成变量）；`FormButton` 编译成 sapdon 真机验证过的写法。
- **静态检查**：把真机踩过的坑（keep_ratio、collection_index、集合引用越界…）变成构建期报错 / 警告。
- **预览**：`mountPreview` 按排版引擎结果画，模拟悬停 / 按下；`mountDevtools` 可改表单正文与按钮文字、看检查结果与编译出的 JSON。

## 命令

```bash
npm install
npm test               # tsc + node:test（14 条：表达式 / 排版 / 编译与检查）
npx vite               # 浏览器预览（preview-src/main.tsx：迷你指导书演示）
npx vite build         # 构建预览到 dist-preview/
```

设计说明、实现了哪些 JSON UI 规则、哪些已真机验证、路线图：见 [docs/DESIGN.md](docs/DESIGN.md)。
