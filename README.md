# CUI

纯面向对象的界面框架：**一棵真实的对象树** → **基岩版 JSON UI** ＋ **浏览器预览**（按游戏的排版规则画）。
没有标签、没有包装函数——元素就是类的实例：构造函数只收必要的参数，其余用有类型的值（`Size`、`Length`、`Anchor`、`Color`……）
和链式的 `setXxx()` 设置。

```js
import { Anchor, Image, Label, Length, Pages, Size, Toggle, form, serverForm } from 'cui'

// 自定义组件 = 继承内置类
class RowLink extends Toggle {
    constructor(pages, key, icon, text) {
        super(pages.group, pages.indexOf(key))        // 点它 = 在客户端翻到 key 页（不经过服务端）
        this.setSize(116, 18).setAnchor(Anchor.TOP_LEFT)
        pages.attach(key, this)
        this.unchecked.add(new Image(icon).setSize(16, 16).setAnchor(Anchor.CENTER_LEFT).setOffset(3, 0))
        this.uncheckedHover.add(new Image('textures/guide/row_hover').setKeepRatio(false).setSize(Size.full()))
    }
}

const pages = new Pages('book').startAt('home')
pages.page('home').add(new RowLink(pages, 'sword', 'textures/items/diamond_sword', '钻石剑').setOffset(0, 20))
pages.page('sword').add(new Label(form.text.minus('CUI;|')).setSize(Length.pct(100), Length.auto()))   // 运行期数据来自表单正文

const { files, issues } = serverForm({ namespace: 'my_book', panelId: 'cui_ui:my_book', content: pages })
```

- **对象模型**：`new Panel()`、`add()`、`find()`、`clone()`、链式 `setXxx()`；按钮 / 开关的状态是实例上的面板（`toggle.checkedHover.add(...)`）。
  一个元素只能有一个父元素（加两处会报错）。早期的参数对象写法（`new Label({ text, color, … })`）仍可用但已弃用——编译结果逐字节相同（有测试）。
- **绑定表达式**：`form.text.contains('HOME;')`、`toggleState('tab_a').or(...)`——编译成 JSON UI 绑定字符串，也在预览里求值。
- **分页 `Pages`**：目录 / 书签 / 弹层用开关在客户端即时切换；翻页箭头用表单按钮走服务端（`useServerPages()`，鼠标不动也能连点，真机验证）——混合翻页。
- **字宽**：真机逐像素校准——纯 ASCII 用 Minecraft 字体，含汉字的整段用 Unifont（宽度表随源码，见 NOTICE）。
- **长文本 / 富文本**：基岩版格式码（含 §g–§v 材料色）；`Paragraph` 预折行（避头尾、中英文留空、行首补样式码）；`paginate()` 分页（孤行控制）。
- **排版引擎**（纯函数）：锚点、尺寸单位、stack、grid、layer、clip、keep_ratio、文字折行；预览与单测共用。
- **编译器 + 静态检查**；`serverForm()` 生成挂到原版服务端表单所需的全部文件（`panels` 可放多个按标题区分的界面）。
- **`cui/node`**：`textureInfoFrom([资源包目录])` 读贴图真实信息（PNG 宽高、`.json` 的九宫格与 base_size），给预览、排版与 lint 用。

## 写法一览（面向对象）

```js
import { Align, Anchor, Color, Column, Image, Insets, Justify, Label, Length, Panel, Row, Size, Texture, TextStyle } from 'cui'

const ICON = Texture.of('textures/items/diamond_sword').withSize(16, 16)
const TITLE = TextStyle.of(Color.WHITE).withShadow()

const card = new Panel()
    .setSize(Length.pct(92), Length.pct(88))      // 随屏幕大小
    .setMinSize(220, 140).setMaxSize(400, 250)     // 上下限
    .setAnchor(Anchor.CENTER)

const header = new Row().setHeight(22).setGap(6).setAlign(Align.CENTER)
header.add(new Image(ICON).setSize(16, 16), new Label('钻石剑', TITLE).setGrow(), new Label('稀有'))

const content = new Column().setSize(Size.full()).setPadding(Insets.all(7)).setGap(4)
content.add(header, new Label('说明文字会按列宽自动折行……'))
card.add(content)

class StatRow extends Row {                         // 自定义组件 = 继承
    constructor(name, value) {
        super()
        this.setHeight(10).add(new Label(name).setGrow(), new Label(value))
    }
}
```

## 命令

需要 Node.js 20.19 以上或 22.12 以上（预览用的 Vite 8 的要求）。

```bash
npm install
npm test                                  # tsc + node:test（64 条）
node scripts/fetch-fonts.mjs              # 预览用像素字体（见下）
npx vite                                  # 浏览器预览：开关翻页测试书
node examples/build-toggle-test.mjs out   # 真机测试包 out/cui_toggle_test.mcaddon
```

### 浏览器预览需要的字体（不随源码分发）

`node scripts/fetch-fonts.mjs` 一条命令准备好，放在 `preview-src/public/font/`（Windows / macOS / Linux 都只需要 Node.js）：

| 文件 | 用途 | 来源 |
|---|---|---|
| `unifont.hex.gz` | 汉字等非 ASCII 字符 | GNU Unifont 16.0.04：先试 unifoundry.com，连不上自动改用中科大 / GNU 镜像的 BDF 并在本地转换 |
| `ascii.png` | 纯英文（Minecraft 字体） | Java 版客户端 client.jar：依次找 `--java-jar`、`CUI_JAVA_CLIENT_JAR`、sapdon 缓存、官方启动器目录（`%APPDATA%\.minecraft\versions`），都没有就从 Mojang 官方下载最新正式版（约 40 MB，缓存到 `~/.sapdon/java/`） |

网络不通时可以手动下载后指定：`--unifont <unifont-16.0.04.hex.gz 或 .bdf.gz>`、`--java-jar <client.jar>`。
游戏与 Unifont 不同的字形（真机采样还原的 51 个）在源码里（`src/font/gameGlyphs.ts`），不需要额外文件。
预览地址后面加 `?scale=5` 可以按指定的界面缩放渲染（与游戏的「界面缩放」一致时可以和游戏截图逐像素对比）；`?demo=responsive` 是响应式演示。

设计说明、验证状态、路线图：[docs/DESIGN.md](docs/DESIGN.md)。
