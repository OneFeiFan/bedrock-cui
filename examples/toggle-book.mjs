/**
 * 开关翻页测试书（纯面向对象：类 + 普通对象，没有标签、没有包装函数）。
 * 浏览器预览（preview-src/main.ts）与真机测试包（examples/build-toggle-test.mjs）共用这一份。
 *
 * 要在真机上回答的问题：
 *   1. 开关翻页：点目录 / 箭头 / 书签翻页，表单不关闭、视角不偏转
 *   2. 同序号的多个开关（目录行、上一页箭头、书签都指向同一页）都能跳转
 *   3. 两组开关互不干扰：物品详情弹层（第二组）关掉后回到原来那页
 *   4. 与表单数据混用：物品格子是开关，提示框里的运行期数据来自表单按钮文字；弹层里的数据来自表单正文
 *   5. 诊断：最后一页列出每个开关的选中状态（同序号的开关会不会一起选中）
 */
import { Anchor, CollectionItem, Color, FormButton, GlyphSheet, Image, InlineIcon, Insets, Label, Length, Pages, Panel, Paragraph, Size, Stack, Text, TextStyle, Toggle, form, paginate, textWidth, toggleState } from 'cui'

export const T = {
    book: 'textures/cui_test/book', line: 'textures/cui_test/line', rowHover: 'textures/cui_test/row_hover',
    arrowL: 'textures/cui_test/arrow_left', arrowLH: 'textures/cui_test/arrow_left_hover',
    arrowR: 'textures/cui_test/arrow_right', arrowRH: 'textures/cui_test/arrow_right_hover',
    tab: 'textures/cui_test/tab', tabHover: 'textures/cui_test/tab_hover',
    cell: 'textures/ui/cell_image', highlight: 'textures/ui/highlight_slot', purple: 'textures/ui/purpleBorder',
    sword: 'textures/items/diamond_sword', diamond: 'textures/items/diamond', stick: 'textures/items/stick', book_item: 'textures/items/book_normal',
    ruler: 'textures/cui_test/ruler', paper: 'textures/items/paper', name_tag: 'textures/items/name_tag', map: 'textures/items/map_empty', emerald: 'textures/items/emerald', writable: 'textures/items/book_writable',
}
const TITLE = Color.fromJSON([0.24, 0.13, 0.03]), BODY = Color.fromJSON([0.27, 0.19, 0.11]), WHITE = Color.WHITE, GRAY = Color.fromJSON([0.67, 0.67, 0.67])
const { TOP_LEFT, TOP_CENTER, TOP_RIGHT, CENTER_LEFT, CENTER, CENTER_RIGHT, BOTTOM_RIGHT } = Anchor
/** 父控件宽 / 高的百分之百 */
const FULL = Length.pct(100)

/** 表单数据（脚本发的）：正文带运行期数据；按钮 0–3 是格子的数据载体，按钮 4 是「关闭」 */
export const FORM = {
    title: 'cui_ui:toggle_test',
    // 标题 = cui_ui:toggle_test|P:<页名>;（pages.titleFor）；正文不用
    body: '',
    // 预览用的样例；真机脚本在运行期按玩家背包实时计算（examples/build-toggle-test.mjs）
    buttons: ['s0|§7耐久 1561\n§a背包里有 1 个', 's1|§a背包里有 3 个', 's2|§a背包里有 3 个', 's3|§8背包里没有', 'close|',
        'txt|§6Steve§r 的背包（4 种物品）：\n§8diamond_sword §0×1§8、§8diamond §0×3§8、§8stick §0×12§8、§8oak_planks §0×64\n§2这段文字由脚本在运行期生成，长度不固定，由引擎负责折行。'],
}

// ───────────── 组件（都是类；构造函数只收必要参数，其余用 setXxx() 链式设置） ─────────────

class Title extends Panel {
    constructor(text) {
        super()
        this.setSize(FULL, 18).setAnchor(TOP_LEFT)
        this.add(new Label(text).setColor(TITLE).setAnchor(TOP_CENTER).setOffset(0, 3))
        this.add(new Image(T.line).setKeepRatio(false).setSize(FULL.minus(24), 1).setAnchor(TOP_CENTER).setOffset(0, 15))
    }
}

class Body extends Label {
    constructor(text, y = 22) {
        super(text)
        this.setColor(BODY).setSize(FULL, Length.auto()).setAnchor(TOP_LEFT).setOffset(0, y)
    }
}

class Side extends Panel {
    // 安全区：左右各 3 像素、底部让出翻页箭头（18 像素）；contain = 内容不得越出（lint 按排版结果检查）
    constructor(side) {
        super()
        this.setSize(116, 160).setAnchor(TOP_LEFT).setOffset(side === 'L' ? 14 : 142, 10).setPadding(Insets.of(3, 0, 3, 18)).setContain()
    }
}

/** 目录行：跳到某页的开关（悬停整行高亮） */
class RowLink extends Toggle {
    constructor(pages, key, icon, text, y) {
        super(pages.group, pages.indexOf(key))
        this.setSize(FULL, 18).setAnchor(TOP_LEFT).setOffset(0, y)
        pages.attach(key, this)
        const content = () => [new Image(icon).setSize(16, 16).setAnchor(CENTER_LEFT).setOffset(3, 0).setLayer(2), new Label(text).setColor(BODY).setAnchor(CENTER_LEFT).setOffset(23, 0).setLayer(2)]
        const hover = () => new Image(T.rowHover).setKeepRatio(false).setSize(Size.full())
        this.unchecked.add(...content())
        this.checked.add(...content())
        this.uncheckedHover.add(hover(), ...content())
        this.checkedHover.add(hover(), ...content())
    }
}

/**
 * 翻页箭头 = 表单按钮（混合翻页）：点了关掉表单，服务端按 ARROWS 表重新打开到目标页（标题带 P:<页>;）。
 * 真机 1.4.0：服务端重开的表单按当前光标位置判定悬停，鼠标不动也能连续翻页；开关翻页做不到。
 */
export let ARROWS = []
/** 书的分页（构建时给 serverForm 的路由、预览按页名查序号） */
export let BOOK_PAGES
const ARROW_BASE = 10
/** 箭头贴图（hover = 悬停的样子） */
const arrowArt = (dir, hover) => new Image(dir === 'left' ? (hover ? T.arrowLH : T.arrowL) : (hover ? T.arrowRH : T.arrowR)).setSize(20, 12)
/**
 * 一个翻页箭头 = 两个**序号相同**的表单按钮（点哪个都发同一个序号）：
 *   普通版：文字含 goN| 就显示，聚焦优先级 10
 *   聚焦版：文字含 goN|F 才显示，聚焦优先级 100——服务端重开表单时给「刚才点击方向」的箭头加 F，
 *   真机 1.5.2：鼠标没动时点击交给默认聚焦的控件（原来是右上角 ×，书就关了）
 */
class ServerArrow extends Panel {
    constructor(from, target, dir) {
        super()
        this.setSize(28, 18).setAnchor(TOP_LEFT).setOffset(dir === 'left' ? 10 : 234, 156)
        const index = ARROW_BASE + ARROWS.length
        ARROWS.push({ index, from, target, dir })
        for (const [tag, focusPrecedence] of [[`go${index}|`, 10], [`go${index}|F`, 100]]) {
            const b = new FormButton(index, tag, 28, 18).setFocusPrecedence(focusPrecedence)
            b.default.add(arrowArt(dir, false)); b.hover.add(arrowArt(dir, true)); b.pressed.add(arrowArt(dir, true))
            this.add(b)
        }
    }
}

/** 书签：回目录（与目录页的锚点、箭头同序号） */
class Bookmark extends Toggle {
    constructor(pages, key) {
        super(pages.group, pages.indexOf(key))
        this.setSize(22, 18).setAnchor(TOP_LEFT).setOffset(266, 14)
        pages.attach(key, this)
        const art = (hover) => [new Image(hover ? T.tabHover : T.tab).setSize(20, 16), new Image(T.book_item).setSize(10, 10).setOffset(-2, 0).setLayer(2)]
        this.unchecked.add(...art(false)); this.checked.add(...art(false))
        this.uncheckedHover.add(...art(true)); this.checkedHover.add(...art(true))
    }
}

/**
 * 物品格子：点击 = 打开详情弹层的开关。悬停态里放一个集合项（表单按钮 index）读运行期数据显示在提示框。
 * 真机：开关内部读不到「外层」集合项的数据（common.toggle 自带空集合名的 collection_details 绑定），
 * 所以集合项放在开关的状态面板**里面**，由它自己的网格重新建立 form_buttons 上下文。
 */
class ItemSlot extends Panel {
    constructor(detail, detailKey, index, icon, name, size = 20) {
        super()
        this.setSize(size, size).setAnchor(TOP_LEFT)
        const tag = `s${index}|`
        const t = detail.attach(detailKey, new Toggle(detail.group, detail.indexOf(detailKey)).setSize(size, size))
        const icn = size >= 32 ? 32 : 16
        const base = () => [new Image(T.cell).setSize(Size.full()), new Image(icon).setSize(icn, icn).setLayer(2)]
        const tipHolder = () => {
            const holder = new CollectionItem('form_buttons', index).setSize(size, size).setLayer(30).allowOverflow()
            const payload = form.buttonText.minus(tag)
            // 提示框：贴合内容 + 四周各 4 像素，挂在格子右上角往右
            const tip = new Image(T.purple).setSize(Length.children().plus(8), Length.children().plus(8)).setPlacement(TOP_RIGHT, TOP_LEFT).setOffset(2, -2)
            // 宽用最大的子控件：纵向 stack 交叉方向的 %c 是子控件之和（真机：提示框比文字宽很多）
            tip.add(new Stack().setSize(Length.largestChild(), Length.children()).add(
                new Label(name).setColor(WHITE).setShadow().setAnchor(CENTER_LEFT),
                new Label(payload).setColor(GRAY).setShadow().setAnchor(CENTER_LEFT).setVisible(payload.isEmpty().not()),
            ))
            return holder.add(tip)
        }
        const highlight = () => new Image(T.highlight).setKeepRatio(false).setAlpha(0.8).setSize(FULL.minus(2), FULL.minus(2)).setLayer(1)
        const hoverArt = () => [...base(), highlight(), tipHolder()]
        t.unchecked.add(...base()); t.checked.add(...base())
        t.uncheckedHover.add(...hoverArt()); t.checkedHover.add(...hoverArt())
        this.add(t)
    }
}

/** 物品详情弹层（第二组开关）：内容来自表单正文；「关闭」= 跳回 none 页 */
class DetailOverlay extends Panel {
    constructor(detail) {
        super()
        this.setSize(150, 90).setLayer(50)
        this.add(new Image(T.purple).setSize(Size.full()))
        this.add(new Label('钻石剑 · 详情（弹层）').setColor(WHITE).setShadow().setAnchor(TOP_LEFT).setOffset(8, 8))
        // 运行期数据：8 号表单按钮的文字（正文放页码了）
        this.add(new CollectionItem('form_buttons', 8).setSize(134, 60).setAnchor(TOP_LEFT).setOffset(8, 22)
            .add(new Label(form.buttonText.minus('od|')).setColor(GRAY).setShadow().setSize(134, Length.auto()).setAnchor(TOP_LEFT)))
        const close = detail.attach('none', new Toggle(detail.group, detail.indexOf('none')).setSize(40, 14).setAnchor(BOTTOM_RIGHT).setOffset(-6, -6))
        const btn = (hover) => [new Image(hover ? T.rowHover : T.line).setKeepRatio(false).setSize(Size.full()), new Label('关闭').setColor(hover ? TITLE : WHITE).setLayer(2)]
        close.unchecked.add(...btn(false)); close.checked.add(...btn(false))
        close.uncheckedHover.add(...btn(true)); close.checkedHover.add(...btn(true))
        this.add(close)
    }
}

/** 诊断格：某个开关是否选中（是 / 否） */
class DebugCell extends Panel {
    constructor(caption, toggleName, x) {
        super()
        this.setSize(60, 10).setAnchor(TOP_LEFT).setOffset(x, 0)
        this.add(new Label(caption).setColor(WHITE).setShadow().setAnchor(CENTER_LEFT))
        this.add(new Label('§a是').setShadow().setAnchor(CENTER_RIGHT).setVisible(toggleState(toggleName)))
        this.add(new Label('§c否').setShadow().setAnchor(CENTER_RIGHT).setVisible(toggleState(toggleName).not()))
    }
}

/**
 * 诊断带（书本下方）：开关状态与表单标题——真机 1.5.1 目录点不进子页面，看点了目录行之后哪个状态变了 / 没变。
 */
class DebugStrip extends Panel {
    constructor(variant, bookmarkName) {
        super()
        this.setSize(290, 24).setAnchor(TOP_LEFT).setOffset(0, 184)
        this.add(new Image(T.purple).setSize(Size.full()))
        const row1 = new Panel().setSize(FULL.minus(8), 10).setAnchor(TOP_LEFT).setOffset(4, 2)
        row1.add(new DebugCell('锚点', 'gbp__server', 0), new DebugCell('目录·剑', 'gbp_sword_l1', 66), new DebugCell('目录·钻石', 'gbp_diamond_l1', 132), new DebugCell('书签', bookmarkName, 214))
        const row2 = new Panel().setSize(FULL.minus(8), 10).setAnchor(TOP_LEFT).setOffset(4, 12)
        row2.add(new Label(`§e${variant}§7 标题：`).setShadow().setAnchor(CENTER_LEFT), new Label(form.title).setColor(WHITE).setShadow().setAnchor(CENTER_LEFT).setOffset(86, 0))
        this.add(row1, row2)
    }
}

// ───────────── 整本书 ─────────────

export function buildBook(options = {}) {
    // 书本 180 高 + 下方诊断带 24 高：整体居中
    const root = new Panel().setSize(290, 210)
    root.add(new Image(T.book).setSize(272, 180).setAnchor(TOP_LEFT))
    ARROWS = []
    // 混合翻页：翻页箭头走服务端（标题带 P:<页>;），目录 / 书签用开关
    // 服务端分页（静态界面，真机 1.5.4 验证）：标题 cui_ui:toggle_test|P:<页名>; + 锚点 + 页码开关
    // （1.10.0 试过路由界面：显示正常，但默认聚焦不可靠，鼠标不动连点翻页会乱跳）
    const pages = new Pages('gbp').startAt('home').setSize(272, 180).setAnchor(TOP_LEFT).useServerPages()
    BOOK_PAGES = pages
    const detail = new Pages('gbd').startAt('none').setSize(272, 180).setAnchor(TOP_LEFT).setLayer(40)
    root.add(pages, detail)

    // 目录
    const home = pages.page('home')
    home.add(new Side('L').add(new Title('文本测试'),
        new RowLink(pages, 'twrap', T.paper, '折行对比', 20),
        new RowLink(pages, 'trich', T.name_tag, '富文本', 38),
        new RowLink(pages, 'truler', T.map, '字宽标尺', 56),
        new RowLink(pages, 'tlong0', T.writable, '长文本分页', 74),
        new RowLink(pages, 'trun', T.emerald, '运行期长文本', 92),
        new RowLink(pages, 'tspecial', T.name_tag, '特殊字符', 110)))
    home.add(new Side('R').add(new Title('目录'),
        new RowLink(pages, 'sword', T.sword, '钻石剑', 20),
        new RowLink(pages, 'diamond', T.diamond, '钻石', 38),
        new RowLink(pages, 'about', T.book_item, '检查清单', 56),
        new RowLink(pages, 'tlayer', T.paper, '叠放顺序', 74),
        new RowLink(pages, 'tinline', T.emerald, '行内图标（Text）', 92),
        new RowLink(pages, 'tglyph', T.diamond, '字形图标', 110)))
    home.add(new ServerArrow('home', 'sword', 'right'))

    // 钻石剑
    const sword = pages.page('sword')
    sword.add(new Side('L').add(new Title('钻石剑'), new ItemSlot(detail, 'sword', 0, T.sword, '钻石剑', 36).setOffset(37, 24),
        new Body('悬停：提示框显示表单按钮带来的运行期数据。点击：打开详情弹层。', 68)))
    sword.add(new Side('R').add(new Title('合成'),
        new ItemSlot(detail, 'sword', 1, T.diamond, '钻石').setOffset(35, 24),
        new ItemSlot(detail, 'sword', 2, T.diamond, '钻石').setOffset(35, 44),
        new ItemSlot(detail, 'sword', 3, T.stick, '木棍').setOffset(35, 64)))
    sword.add(new ServerArrow('sword', 'home', 'left'), new ServerArrow('sword', 'diamond', 'right'))

    // 钻石
    const diamond = pages.page('diamond')
    diamond.add(new Side('L').add(new Title('钻石'), new Body('这一页从目录、上一页箭头都能到达：同一页有多个入口（同序号的开关）。')))
    diamond.add(new Side('R').add(new Title('说明'), new Body('右下箭头去诊断页，左下箭头回钻石剑页。')))
    diamond.add(new ServerArrow('diamond', 'sword', 'left'), new ServerArrow('diamond', 'about', 'right'))

    // 检查页
    const about = pages.page('about')
    const bookmark = new Bookmark(pages, 'home')
    about.add(new Side('L').add(new Title('1.0.1 的结论'), new Body('按名字读开关是全局的；同序号的开关不会一起选中（只有被点的那个选中）；弹层会被点穿。')))
    about.add(new Side('R').add(new Title('1.0.2 请检查'), new Body('1 钻石剑页悬停格子：提示框有「背包里有 N 个」\n2 打开弹层后点底下的箭头：点不穿，也不关弹层（透明、无声）\n3 只有「关闭」按钮才关弹层')))
    about.add(new ServerArrow('about', 'diamond', 'left'))

    buildTextPages(pages)

    // 「原地不动」：透明的表单按钮（序号 9），聚焦优先级 50——介于聚焦版箭头（100）与普通箭头（10）之间。
    // 当前方向没有箭头时（例如最后一页再点「下一页」），鼠标没动的点击交给它：服务端原样重开当前页（真机 1.5.3：否则落到反方向的箭头，来回循环）
    root.add(new FormButton(9, 'stay|', 1, 1).setName('stay').setAnchor(TOP_LEFT).setFocusPrecedence(50))

    // 书签（任何页都在）
    root.add(bookmark)
    root.add(new DebugStrip(options.variant ?? '预览', bookmark.name))

    // 详情弹层
    detail.page('none')
    // 透明拦截层：挡住下面的点击；点它不关弹层（只有「关闭」按钮才关）
    detail.page('sword').add(detail.blocker('sword').setSize(272, 180).setAnchor(TOP_LEFT), new DetailOverlay(detail))

    // 关闭整本书：普通表单按钮（序号 4），点了表单关闭，服务端收到选择
    const close = new FormButton(4, 'close|', 14, 14).setAnchor(TOP_LEFT).setOffset(248, 3).setLayer(60)
    close.default.add(new Label('§4×').setAnchor(CENTER))
    close.hover.add(new Label('§c×').setAnchor(CENTER))
    root.add(close)
    return root
}

// ───────────── 文本测试 ─────────────

/** 一段跨行的富文本：颜色 / 粗体跨过折行点、英文单词、引号、句读 */
export const SAMPLE = '§2绿色开头的一段文字会跨过好几行，看看§c红色§2在引擎自动折行后会不会延续。英文 Minecraft Bedrock 不应被拆开，标点「引号」、句号。逗号，都要看位置。§l粗体也要延续到下一行吗？§r最后恢复普通。'

/** 长文本（分页用）：几段带颜色的说明 */
export const LONG = [
    '§6第一章 · 关于这本书§r',
    '这是一段用来测试长文本分页的文字。CUI 会先按字宽表把文字折成行（避头尾、中英文之间留空），再按每页能放下的行数切成若干页，每页一个段落。§9换页时颜色会在新页开头补上§r，所以跨页的§c红色句子在下一页§r也不会丢掉颜色。',
    '',
    '§6第二章 · 折行规则§r',
    '英文单词（例如 Minecraft、Bedrock Edition、JSON UI）不会被拆开；句号、逗号这类标点不会出现在行首；左括号「与左引号」不会留在行尾。§l粗体字更宽，§r折行时会按粗体的宽度计算。',
    '',
    '§6第三章 · 运行期文字§r',
    '表单正文与按钮文字由脚本在运行期发送，长度事先不知道：这种文字交给引擎折行（文字框宽度固定、高度 default）。真机上请对比「折行对比」页：左边是引擎折行，右边是 CUI 预折行。',
    '',
    '§6第四章 · 结尾§r',
    '如果你读到了这里，说明分页、翻页箭头与页码都正常工作。§a谢谢测试！',
].join('\n')

/** 字宽标尺：每行一串字符 + 下面一把刻度尺（每 10 像素一根长刻度）；右边灰字是 CUI 的估计宽度 */
// 左页纯 ASCII（Minecraft 字体），右页含汉字（整段 Unifont）；右边灰字是 CUI 按规则算的宽度
const RULER_ROWS_L = ['Il!.,;:|', 'kfkf<><>', '[](){}"*', '~~~~~~~~', 'Hello World', '§lBold Text', 'mmmmmmmmmm', '#$%&+=?/']
// ───────────── 字形图标（font/glyph_E2.png，构建时自动生成）：文字里写字符就显示物品图标 ─────────────
export const ICONS = new GlyphSheet('A0', { kind: 'text' })
export const BIG_ICONS = new GlyphSheet('E2')
// 真机 1.18.0：缩成 8×8 的小图标模糊。日文字形图同样 256×256、16 像素格却按一半画 ⇒ 缩放看页的类型：
// 文字页（借用彝文 A0）按一半画、与汉字同高、16×16 细节完整（正文用）；emoji 页（E2）1:1、16 高（标题用）
export const GI = {
    SWORD: ICONS.icon('diamond_sword', T.sword, { ink: [0, 16] }),
    DIAMOND: ICONS.icon('diamond', T.diamond, { ink: [2, 12] }),
    STICK: ICONS.icon('stick', T.stick, { ink: [2, 13] }),
    BOOK: ICONS.icon('book', T.book_item, { ink: [0, 16] }),
    SWORD_L: BIG_ICONS.icon('diamond_sword', T.sword, { ink: [0, 16] }),
    DIAMOND_L: BIG_ICONS.icon('diamond', T.diamond, { ink: [2, 12] }),
}
const { SWORD: GS, DIAMOND: GD, STICK: GK, BOOK: GB, SWORD_L: GSL } = GI
/** 字形采样（60 个）：常用中文标点、括号、引号、全角符号 / 数字 / 字母，再加几个常见汉字对照 */
export const SAMPLE_CHARS = [...'，。、；：？！…—～·「」『』（）《》〈〉【】“”‘’％＋－＝×÷＃＆＊＠／０１２３４５６ＡＢＣａｂｃ一二三中国人口日月']
if (SAMPLE_CHARS.length < 60) throw new Error(`字形采样不足 60 个：${SAMPLE_CHARS.length}`)

/** 行内图标（Text 用）：真正的图片控件，8×8 与文字同高；SWORD_L 16×16 */
export const II = {
    SWORD: InlineIcon.of(T.sword), DIAMOND: InlineIcon.of(T.diamond), STICK: InlineIcon.of(T.stick), BOOK: InlineIcon.of(T.book_item),
    SWORD_L: InlineIcon.of(T.sword, 16),
}
/**
 * 字形图标的字宽标尺（文字页，预测与汉字同一规则：墨迹宽 / 2 + 1 → 钻石剑 / 书 9、钻石 7、木棍 7.5）。
 * 第 7 行加粗；第 8 行故意不包白色颜色码（直接写字符）——看文字页图标会不会被正文的深棕色染暗（说明文字里不能写 §，会被当成格式码）
 */
const GLYPH_ROWS = [`${GS}${GS}${GS}${GS}`, `${GD}${GD}${GD}${GD}`, `${GK}${GK}${GK}${GK}`, `${GB}${GB}${GB}${GB}`, `a${GD}b${GK}c`, `钻石${GD}×2`,
    `§l§f${GS.char}${GD.char}${GK.char}`, `${GD.char}${GK.char} 不包白色`]

const RULER_ROWS_R = ['钻石剑钻石剑钻石剑钻', 'abc 中文 xyz', '中一二三十口日', '，。、；：！？', '「引号」（括号）', '§l粗体钻石剑', '背包里有 12 个', '§oitalic 斜体']

class RulerRow extends Panel {
    constructor(text, y) {
        super()
        this.setSize(FULL, 15).setAnchor(TOP_LEFT).setOffset(0, y)
        this.add(new Label(text).setColor(BODY).setAnchor(TOP_LEFT))
        this.add(new Image(T.ruler).setSize(101, 5).setAnchor(TOP_LEFT).setOffset(0, 9))
        this.add(new Label(`§8${textWidth(text)}`).setFontScale(0.75).setAnchor(TOP_RIGHT).setOffset(-2, 0))
    }
}

/**
 * 颜色样例：深色底（浅色字在米黄纸上看不清）。文字是底板图片的**子元素**——
 * 真机 1.3.0：文字与底板作为同层兄弟时整块不见了（被底板盖住），子元素的写法（提示框、弹层）一直正常。
 */
class Swatches extends Panel {
    constructor(codes, y, height) {
        super()
        this.setSize(FULL, height).setAnchor(TOP_LEFT).setOffset(0, y)
        const bg = new Image(T.purple).setSize(Size.full())
        codes.forEach((c, i) => bg.add(new Label(`§7${c} §${c}示例Ab`).setShadow().setAnchor(TOP_LEFT).setOffset(6 + (i % 2) * 52, 5 + Math.floor(i / 2) * 10)))
        this.add(bg)
    }
}

/** 特殊字符：左边原样输出（绕过编译器的保护），右边经编译器处理（# / $ 开头补 §r） */
const SPECIAL = ['#abc', '$abc', 'a#b$c', '100%', 'a%b%c', '%s %d %%', '&+=?/', '@abc']
function buildSpecialPage(page) {
    const row = (i, text, raw) => {
        const label = new Label(text).setColor(BODY).setAnchor(CENTER_LEFT).setOffset(12, 0)
        if (raw) label.setRaw('text', text)
        return new Panel().setSize(FULL, 12).setAnchor(TOP_LEFT).setOffset(0, 22 + i * 15)
            .add(new Label(`§8${i + 1}`).setAnchor(CENTER_LEFT), label)
    }
    page.add(new Side('L').add(new Title('原样输出'), ...SPECIAL.map((t, i) => row(i, t, true))))
    page.add(new Side('R').add(new Title('CUI 处理后'), ...SPECIAL.map((t, i) => row(i, t, false))))
}

/** 叠放顺序诊断：深色底板 + 白字的几种写法，看哪几种文字被盖住（真机 1.3.0 色块里的文字不见了） */
function buildLayerTest(sideL, sideR) {
    const row = (i, ...items) => new Panel().setSize(FULL, 18).setAnchor(TOP_LEFT).setOffset(0, 22 + i * 20).add(...items)
    const bg = () => new Image(T.purple).setSize(Size.full())
    const txt = (s) => new Label(s).setColor(WHITE).setAnchor(CENTER_LEFT).setOffset(6, 0)
    sideL.add(new Title('叠放顺序'),
        // V0 故意被盖住（预览与真机都是一片空白；静态检查 text-covered 也会报）——行内右侧用更高层级写明预期，免得以为是 bug
        row(0, bg(), txt('V0 字 layer 0').setLayer(0), new Label('§7应被盖住').setLayer(2).setAnchor(CENTER_RIGHT).setOffset(-5, 0)),
        row(1, bg(), txt('V1 图在前 字在后')),
        row(2, bg(), txt('V2 同上 + 阴影').setShadow()),
        row(3, txt('V3 字在前 图在后'), bg()),
        row(4, bg(), txt('V4 字写 layer 1').setLayer(1)),
        row(5, bg().add(txt('V5 字是图的子元素'))))
    sideR.add(new Title('1.5.0 预期'), new Body('1.4.0 真机：只有 V4 的字可见。\n\n现在框架给文字缺省 layer 1：V1–V5 都应可见；V0 故意写 layer 0，应被盖住。'))
}

/** 文本测试的各页：折行对比、富文本、字宽标尺、长文本分页、运行期长文本、特殊字符、叠放顺序、字形 / 行内图标、字形采样 */
function buildTextPages(pages) {
    const chain = ['twrap', 'trich', 'truler']
    /** 一段由 CUI 预折行的文字，放在 (0, y) */
    const paragraph = (text, y, color = BODY) => new Paragraph(text, 110).setColor(color).setAnchor(TOP_LEFT).setOffset(0, y)
    /** 一段由游戏折行的文字（宽 = 父控件、高按内容） */
    const engineText = (text, y) => new Label(text).setColor(BODY).setSize(FULL, Length.auto()).setAnchor(TOP_LEFT).setOffset(0, y)
    // 折行对比
    const wrap = pages.page('twrap')
    wrap.add(new Side('L').add(new Title('引擎自动折行'), engineText(SAMPLE, 22)))
    wrap.add(new Side('R').add(new Title('CUI 预折行'), paragraph(SAMPLE, 22)))
    // 富文本
    const rich = pages.page('trich')
    const at = (label, x, y) => label.setAnchor(TOP_LEFT).setOffset(x, y)
    rich.add(new Side('L').add(new Title('颜色代码 0–f'), new Swatches('0123456789abcdef'.split(''), 22, 90)))
    rich.add(new Side('R').add(new Title('基岩版独有 + 格式'), new Swatches('ghijmnpqstuv'.split(''), 22, 70),
        paragraph('§l粗体 Bold§r  §o斜体 Italic§r\n§c红§l红粗§9蓝粗§r普通', 94),
        // 乱码：纯 ASCII（Minecraft 字体）vs 含汉字（Unifont：真机 1.5.3 只显示成点）
        at(new Label('§kabcdefgh').setColor(BODY), 0, 116),
        at(new Label('§8← 纯英文乱码'), 52, 116),
        at(new Label('§k乱码abc').setColor(BODY), 0, 128),
        at(new Label('§8← 含汉字'), 52, 128)))
    // 字宽标尺
    const ruler = pages.page('truler')
    ruler.add(new Side('L').add(new Title('字宽标尺'), ...RULER_ROWS_L.map((t, i) => new RulerRow(t, 20 + i * 15))))
    ruler.add(new Side('R').add(new Title('字宽标尺（续）'), ...RULER_ROWS_R.map((t, i) => new RulerRow(t, 20 + i * 15))))
    // 长文本分页：每页 = 半边书页（标题下 22 起，到翻页箭头上方，约 12 行）
    const chunks = paginate(LONG, 110, { height: 120, firstHeight: 120 })
    const spreads = Math.ceil(chunks.length / 2)
    for (let s = 0; s < spreads; s++) {
        const key = `tlong${s}`
        chain.push(key)
        const page = pages.page(key)
        for (const [side, k] of [['L', 2 * s], ['R', 2 * s + 1]]) {
            if (k >= chunks.length) continue
            page.add(new Side(side).add(new Title(`长文本 ${k + 1} / ${chunks.length}`), engineText(chunks[k], 22)))
        }
    }
    // 运行期长文本：按钮 5 的文字（脚本按玩家背包生成）
    chain.push('trun')
    const run = pages.page('trun')
    const runtimeText = () => new CollectionItem('form_buttons', 5).setSize(110, 10).setAnchor(TOP_LEFT)
        .add(new Label(form.buttonText.minus('txt|')).setColor(BODY).setSize(110, Length.auto()).setAnchor(TOP_LEFT))
    run.add(new Side('L').add(new Title('运行期：高度 default'), runtimeText().setOffset(0, 22)))
    const clipped = new Panel().setSize(110, 50).setAnchor(TOP_LEFT).setOffset(0, 22).setClip().add(runtimeText())
    run.add(new Side('R').add(new Title('运行期：裁剪到 50 高'), clipped, new Body('§8上面的框只有 50 像素高，超出的部分被裁掉。', 80)))
    // 特殊字符、叠放顺序
    chain.push('tspecial')
    buildSpecialPage(pages.page('tspecial'))
    chain.push('tlayer')
    const layerPage = pages.page('tlayer')
    const ll = new Side('L'), lr = new Side('R')
    buildLayerTest(ll, lr)
    layerPage.add(ll, lr)
    // 字形图标：左页字宽标尺，右页带图标的段落（看折行）
    chain.push('tglyph')
    const glyphPage = pages.page('tglyph')
    glyphPage.add(new Side('L').add(new Title('字形图标'), ...GLYPH_ROWS.map((t, i) => new RulerRow(t, 20 + i * 15))))
    glyphPage.add(new Side('R').add(new Title('文字页图标与折行'),
        paragraph(`合成钻石剑：工作台中间一列放 ${GD}${GD}，下面放 ${GK}，得到 ${GS}。附魔台旁放满 ${GB} 书架能提高附魔等级；耐久快用尽时，在铁砧上用 ${GD} 修复。`, 22),
        at(new Label(`${GSL} §l钻石剑`).setColor(TITLE), 0, 90),
        new Body('§8上：emoji 页大图标配标题（单独一行）。正文里是文字页图标，与汉字同高。', 106)))
    // 行内图标（Text）：图标是真正的图片控件，与文字同高、清晰、颜色正确；折行 / 行高 / 样式延续由 CUI 排版
    chain.push('tinline')
    const inlinePage = pages.page('tinline')
    const BODY_STYLE = TextStyle.of(BODY), TITLE_STYLE = TextStyle.of(TITLE)
    inlinePage.add(new Side('L').add(new Title('行内图标'),
        new Text(`合成钻石剑：工作台中间一列放 ${II.DIAMOND}${II.DIAMOND}，下面放 ${II.STICK}，得到 ${II.SWORD}。附魔台旁放满 ${II.BOOK} 书架能提高附魔等级；耐久快用尽时，在铁砧上用 ${II.DIAMOND} 修复。`, 110, BODY_STYLE).setAnchor(TOP_LEFT).setOffset(0, 22),
        new Text(`§c红色 ${II.DIAMOND} 仍是红色§r，§l粗体 ${II.STICK} 仍是粗体§r，普通 abc ${II.SWORD} xyz`, 110, BODY_STYLE).setAnchor(TOP_LEFT).setOffset(0, 96)))
    inlinePage.add(new Side('R').add(new Title('大图标 · 运行期文字'),
        new Text(`${II.SWORD_L} §l钻石剑§r 这一行有 16 高的图标，自动加高。`, 110, TITLE_STYLE).setAnchor(TOP_LEFT).setOffset(0, 22),
        engineText(`§8运行期文字（游戏折行）：§r\n${GI.DIAMOND_L} 钻石 ×3\n${GI.SWORD_L} 钻石剑 ×1`, 62).setLineSpacing(6),
        // 运行期文字高 = 3 行 × (10 + 6) = 48（line_padding：每行都多占 6，真机 1.20.0）→ 62–110，说明放在 114
        new Body('§8上：emoji 字形 + 行距 6（line_padding），图标不压行。', 114)))
    // 字形采样：常用标点 / 符号按 2 倍字号排成网格（每个点阵格子 = 1 界面像素），截图后逐格还原游戏的点阵、与 Unifont 比较
    chain.push('tsample')
    const samplePage = pages.page('tsample')
    const grid = (chars) => chars.map((ch, i) => at(new Label(ch).setColor(BODY).setFontScale(2), (i % 5) * 22, 20 + Math.floor(i / 5) * 20))
    samplePage.add(new Side('L').add(new Title('字形采样 1'), ...grid(SAMPLE_CHARS.slice(0, 30))))
    samplePage.add(new Side('R').add(new Title('字形采样 2'), ...grid(SAMPLE_CHARS.slice(30, 60))))
    // 文本页之间的箭头
    chain.forEach((key, i) => {
        const page = pages.page(key)
        page.add(new ServerArrow(key, i === 0 ? 'home' : chain[i - 1], 'left'))
        if (i < chain.length - 1) page.add(new ServerArrow(key, chain[i + 1], 'right'))
    })
}

/** 贴图尺寸（给 lint 与预览用；九宫格写 nineslice） */
export const TEXTURE_INFO = {
    [T.book]: { size: [272, 180] }, [T.line]: { size: [1, 1] }, [T.rowHover]: { size: [1, 1] },
    [T.arrowL]: { size: [20, 12] }, [T.arrowLH]: { size: [20, 12] }, [T.arrowR]: { size: [20, 12] }, [T.arrowRH]: { size: [20, 12] },
    [T.tab]: { size: [20, 16] }, [T.tabHover]: { size: [20, 16] },
    // 原版 .json：cell_image 是两倍精度（10×10 像素、base_size 5×5、nineslice 1）；highlight_slot 也是九宫格
    [T.cell]: { size: [10, 10], baseSize: [5, 5], nineslice: 1 }, [T.highlight]: { size: [1, 1], baseSize: [1, 1], nineslice: 1 }, [T.purple]: { size: [16, 16], baseSize: [16, 16], nineslice: 4 },
    [T.sword]: { size: [16, 16] }, [T.diamond]: { size: [16, 16] }, [T.stick]: { size: [16, 16] }, [T.book_item]: { size: [16, 16] },
    [T.ruler]: { size: [101, 5] }, [T.paper]: { size: [16, 16] }, [T.name_tag]: { size: [16, 16] }, [T.map]: { size: [16, 16] }, [T.emerald]: { size: [16, 16] }, [T.writable]: { size: [16, 16] },
}
