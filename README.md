# CUI

纯面向对象的界面框架：**一棵真实的对象树** → **基岩版 JSON UI** ＋ **浏览器预览**（按游戏的排版规则画）。
没有标签、没有包装函数——元素就是类的实例，参数是普通对象。

```js
import { Panel, Image, Label, Toggle, Pages, FormButton, form, serverForm } from 'cui'

// 自定义组件 = 继承内置类
class RowLink extends Toggle {
    constructor(pages, key, { icon, text, y }) {
        super({ ...pages.toggleOptions(key), size: [116, 18], anchor: 'top_left', offset: [0, y] })
        pages.attach(key, this)                       // 点它 = 在客户端翻到 key 页（不经过服务端）
        this.unchecked.add(new Image({ texture: icon, size: [16, 16], anchor: 'left_middle', offset: [3, 0] }))
        this.uncheckedHover.add(new Image({ texture: 'textures/guide/row_hover', keepRatio: false, size: ['100%', '100%'] }))
    }
}

const pages = new Pages({ group: 'book', start: 'home' })
pages.page('home').add(new RowLink(pages, 'sword', { icon: 'textures/items/diamond_sword', text: '钻石剑', y: 20 }))
pages.page('sword').add(new Label({ text: form.text.minus('CUI;|') }))   // 运行期数据来自表单正文

const { files, issues } = serverForm({ namespace: 'my_book', panelId: 'cui_ui:my_book', content: pages })
```

- **对象模型**：`new Panel({...})`、`add()`、`set()`、`find()`、`clone()`；按钮 / 开关的状态是实例上的面板（`toggle.checkedHover.add(...)`）。一个元素只能有一个父元素（加两处会报错）。
- **绑定表达式**：`form.text.contains('HOME;')`、`toggleState('tab_a').or(...)`——编译成 JSON UI 绑定字符串，也在预览里求值。
- **开关分页 `Pages`**：整本书在一个表单里，点开关在客户端翻页（不关表单、没有空档）；再开一个 `Pages` 就是独立的另一组状态（弹层）。
- **字宽**：真机逐像素校准——纯 ASCII 用 Minecraft 字体，含汉字的整段用 Unifont（宽度表随源码，见 NOTICE）。
- **长文本 / 富文本**：基岩版格式码（含 §g–§v 材料色）；`Paragraph` 预折行（避头尾、中英文留空、行首补样式码）；`paginate()` 分页（孤行控制）。
- **排版引擎**（纯函数）：锚点、尺寸单位、stack、grid、layer、clip、keep_ratio、文字折行；预览与单测共用。
- **编译器 + 静态检查**；`serverForm()` 生成挂到原版服务端表单所需的全部文件（`panels` 可放多个按标题区分的界面）。
- **`cui/node`**：`textureInfoFrom([资源包目录])` 读贴图真实信息（PNG 宽高、`.json` 的九宫格与 base_size），给预览、排版与 lint 用。

## 命令

```bash
npm install
npm test                                  # tsc + node:test（35 条）
node scripts/fetch-fonts.mjs              # 预览用像素字体（Unifont + 本机 Java 版的 ascii.png）
npx vite                                  # 浏览器预览：开关翻页测试书
node examples/build-toggle-test.mjs out   # 真机测试包 out/cui_toggle_test.mcaddon
```

设计说明、验证状态、路线图：[docs/DESIGN.md](docs/DESIGN.md)。
