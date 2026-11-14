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
import { CollectionItem, FormButton, Image, Label, Pages, Panel, Paragraph, Stack, Toggle, form, paginate, textWidth, toggleState } from 'cui'

export const T = {
    book: 'textures/cui_test/book', line: 'textures/cui_test/line', rowHover: 'textures/cui_test/row_hover',
    arrowL: 'textures/cui_test/arrow_left', arrowLH: 'textures/cui_test/arrow_left_hover',
    arrowR: 'textures/cui_test/arrow_right', arrowRH: 'textures/cui_test/arrow_right_hover',
    tab: 'textures/cui_test/tab', tabHover: 'textures/cui_test/tab_hover',
    cell: 'textures/ui/cell_image', highlight: 'textures/ui/highlight_slot', purple: 'textures/ui/purpleBorder',
    sword: 'textures/items/diamond_sword', diamond: 'textures/items/diamond', stick: 'textures/items/stick', book_item: 'textures/items/book_normal',
    ruler: 'textures/cui_test/ruler', paper: 'textures/items/paper', name_tag: 'textures/items/name_tag', map: 'textures/items/map_empty', emerald: 'textures/items/emerald', writable: 'textures/items/book_writable',
}
const TITLE = [0.24, 0.13, 0.03], BODY = [0.27, 0.19, 0.11], WHITE = [1, 1, 1], GRAY = [0.67, 0.67, 0.67]

/** 表单数据（脚本发的）：正文带运行期数据；按钮 0–3 是格子的数据载体，按钮 4 是「关闭」 */
export const FORM = {
    title: 'cui_ui:toggle_test',
    // 标题 = 路由：cui_ui:toggle_test/<页名>（serverTitle）；正文不再用
    body: '',
    // 预览用的样例；真机脚本在运行期按玩家背包实时计算（examples/build-toggle-test.mjs）
    buttons: ['s0|§7耐久 1561\n§a背包里有 1 个', 's1|§a背包里有 3 个', 's2|§a背包里有 3 个', 's3|§8背包里没有', 'close|',
        'txt|§6Steve§r 的背包（4 种物品）：\n§8diamond_sword §0×1§8、§8diamond §0×3§8、§8stick §0×12§8、§8oak_planks §0×64\n§2这段文字由脚本在运行期生成，长度不固定，由引擎负责折行。'],
}

// ───────────── 组件（都是类） ─────────────

class Title extends Panel {
    constructor(text) {
        super({ size: ['100%', 18], anchor: 'top_left' })
        this.add(new Label({ text, color: TITLE, anchor: 'top_middle', offset: [0, 3] }))
        this.add(new Image({ texture: T.line, keepRatio: false, size: ['100% - 24px', 1], anchor: 'top_middle', offset: [0, 15] }))
    }
}

class Body extends Label {
    constructor(text, y = 22) { super({ text, color: BODY, size: ['100%', 'default'], anchor: 'top_left', offset: [0, y] }) }
}

class Side extends Panel {
    // 安全区：左右各 3 像素、底部让出翻页箭头（18 像素）；contain = 内容不得越出（lint 按排版结果检查）
    constructor(side) { super({ size: [116, 160], anchor: 'top_left', offset: [side === 'L' ? 14 : 142, 10], padding: [3, 0, 3, 18], contain: true }) }
}

/** 目录行：跳到某页的开关（悬停整行高亮） */
class RowLink extends Toggle {
    constructor(pages, key, { icon, text, y }) {
        super({ ...pages.toggleOptions(key), size: ['100%', 18], anchor: 'top_left', offset: [0, y] })
        pages.attach(key, this)
        const content = () => [new Image({ texture: icon, size: [16, 16], anchor: 'left_middle', offset: [3, 0], layer: 2 }), new Label({ text, color: BODY, anchor: 'left_middle', offset: [23, 0], layer: 2 })]
        this.unchecked.add(...content())
        this.checked.add(...content())
        this.uncheckedHover.add(new Image({ texture: T.rowHover, keepRatio: false, size: ['100%', '100%'] }), ...content())
        this.checkedHover.add(new Image({ texture: T.rowHover, keepRatio: false, size: ['100%', '100%'] }), ...content())
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
/**
 * 一个翻页箭头 = 两个**序号相同**的表单按钮（点哪个都发同一个序号）：
 *   普通版：文字含 goN| 就显示，聚焦优先级 10
 *   聚焦版：文字含 goN|F 才显示，聚焦优先级 100——服务端重开表单时给「刚才点击方向」的箭头加 F，
 *   真机 1.5.2：鼠标没动时点击交给默认聚焦的控件（原来是右上角 ×，书就关了）
 */
class ServerArrow extends Panel {
    constructor(from, target, dir) {
        super({ size: [28, 18], anchor: 'top_left', offset: [dir === 'left' ? 10 : 234, 156] })
        const index = ARROW_BASE + ARROWS.length
        ARROWS.push({ index, from, target, dir })
        const art = (hover) => new Image({ texture: dir === 'left' ? (hover ? T.arrowLH : T.arrowL) : (hover ? T.arrowRH : T.arrowR), size: [20, 12] })
        for (const [tag, focusPrecedence] of [[`go${index}|`, 10], [`go${index}|F`, 100]]) {
            const b = new FormButton({ index, tag, size: [28, 18], focusPrecedence })
            b.default.add(art(false)); b.hover.add(art(true)); b.pressed.add(art(true))
            this.add(b)
        }
    }
}

/** 书签：回目录（与目录页的锚点、箭头同序号） */
class Bookmark extends Toggle {
    constructor(pages, key) {
        super({ ...pages.toggleOptions(key), size: [22, 18], anchor: 'top_left', offset: [266, 14] })
        pages.attach(key, this)
        const art = (hover) => [new Image({ texture: hover ? T.tabHover : T.tab, size: [20, 16] }), new Image({ texture: T.book_item, size: [10, 10], offset: [-2, 0], layer: 2 })]
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
    constructor(detail, detailKey, { index, icon, name, x, y, size = 20 }) {
        super({ size: [size, size], anchor: 'top_left', offset: [x, y] })
        const tag = `s${index}|`
        const t = new Toggle({ ...detail.toggleOptions(detailKey), size: [size, size] })
        detail.attach(detailKey, t)
        const icn = size >= 32 ? 32 : 16
        const base = () => [new Image({ texture: T.cell, size: ['100%', '100%'] }), new Image({ texture: icon, size: [icn, icn], layer: 2 })]
        const tipHolder = () => {
            const holder = new CollectionItem({ collection: 'form_buttons', index, size: [size, size], layer: 30, overflow: true })
            const payload = form.buttonText.minus(tag)
            const tip = new Image({ texture: T.purple, size: ['100%c + 8px', '100%c + 8px'], anchorFrom: 'top_right', anchorTo: 'top_left', offset: [2, -2] })
            // 宽用 %cm：纵向 stack 交叉方向的 %c 是子控件之和（真机：提示框比文字宽很多）
            tip.add(new Stack({ size: ['100%cm', '100%c'], children: [
                new Label({ text: name, color: WHITE, shadow: true, anchor: 'left_middle' }),
                new Label({ text: payload, color: GRAY, shadow: true, anchor: 'left_middle', visible: payload.isEmpty().not() }),
            ] }))
            return holder.add(tip)
        }
        const hoverArt = () => [...base(), new Image({ texture: T.highlight, keepRatio: false, alpha: 0.8, size: ['100% - 2px', '100% - 2px'], layer: 1 }), tipHolder()]
        t.unchecked.add(...base()); t.checked.add(...base())
        t.uncheckedHover.add(...hoverArt()); t.checkedHover.add(...hoverArt())
        this.add(t)
    }
}

/** 物品详情弹层（第二组开关）：内容来自表单正文；「关闭」= 跳回 none 页 */
class DetailOverlay extends Panel {
    constructor(detail) {
        super({ size: [150, 90], layer: 50 })
        this.add(new Image({ texture: T.purple, size: ['100%', '100%'] }))
        this.add(new Label({ text: '钻石剑 · 详情（弹层）', color: WHITE, shadow: true, anchor: 'top_left', offset: [8, 8] }))
        // 运行期数据：8 号表单按钮的文字（正文放页码了）
        this.add(new CollectionItem({ collection: 'form_buttons', index: 8, size: [134, 60], anchor: 'top_left', offset: [8, 22] })
            .add(new Label({ text: form.buttonText.minus('od|'), color: GRAY, shadow: true, size: [134, 'default'], anchor: 'top_left' })))
        const close = new Toggle({ ...detail.toggleOptions('none'), size: [40, 14], anchor: 'bottom_right', offset: [-6, -6] })
        detail.attach('none', close)
        const btn = (hover) => [new Image({ texture: hover ? T.rowHover : T.line, keepRatio: false, size: ['100%', '100%'] }), new Label({ text: '关闭', color: hover ? TITLE : WHITE, layer: 2 })]
        close.unchecked.add(...btn(false)); close.checked.add(...btn(false))
        close.uncheckedHover.add(...btn(true)); close.checkedHover.add(...btn(true))
        this.add(close)
    }
}

/** 诊断格：某个开关是否选中（是 / 否） */
class DebugCell extends Panel {
    constructor(caption, toggleName, x) {
        super({ size: [60, 10], anchor: 'top_left', offset: [x, 0] })
        this.add(new Label({ text: caption, color: WHITE, shadow: true, anchor: 'left_middle' }))
        this.add(new Label({ text: '§a是', shadow: true, anchor: 'right_middle', visible: toggleState(toggleName) }))
        this.add(new Label({ text: '§c否', shadow: true, anchor: 'right_middle', visible: toggleState(toggleName).not() }))
    }
}

/**
 * 诊断带（书本下方）：开关状态与表单标题——真机 1.5.1 目录点不进子页面，看点了目录行之后哪个状态变了 / 没变。
 */
class DebugStrip extends Panel {
    constructor(variant, bookmarkName) {
        super({ size: [290, 24], anchor: 'top_left', offset: [0, 184] })
        this.add(new Image({ texture: T.purple, size: ['100%', '100%'] }))
        const row1 = new Panel({ size: ['100% - 8px', 10], anchor: 'top_left', offset: [4, 2] })
        row1.add(new DebugCell('目录·剑', 'gbp_sword_l1', 0), new DebugCell('目录·钻石', 'gbp_diamond_l1', 66), new DebugCell('书签', bookmarkName, 132))
        const row2 = new Panel({ size: ['100% - 8px', 10], anchor: 'top_left', offset: [4, 12] })
        row2.add(new Label({ text: `§e${variant}§7 标题：`, shadow: true, anchor: 'left_middle' }), new Label({ text: form.title, color: WHITE, shadow: true, anchor: 'left_middle', offset: [86, 0] }))
        this.add(row1, row2)
    }
}

// ───────────── 整本书 ─────────────

export function buildBook(options = {}) {
    // 书本 180 高 + 下方诊断带 24 高：整体居中
    const root = new Panel({ size: [290, 210] })
    root.add(new Image({ texture: T.book, size: [272, 180], anchor: 'top_left' }))
    ARROWS = []
    // 混合翻页：翻页箭头走服务端（标题带 P:<页>;），目录 / 书签用开关
    // 服务端分页：每一页一个路由（标题 cui_ui:toggle_test/<页名>），路由变量 = 这组开关的初始选中序号
    const pages = new Pages({ group: 'gbp', start: 'home', size: [272, 180], anchor: 'top_left' }).useServerPages()
    BOOK_PAGES = pages
    const detail = new Pages({ group: 'gbd', start: 'none', size: [272, 180], anchor: 'top_left', layer: 40 })
    root.add(pages, detail)

    // 目录
    const home = pages.page('home')
    home.add(new Side('L').add(new Title('文本测试'),
        new RowLink(pages, 'twrap', { icon: T.paper, text: '折行对比', y: 20 }),
        new RowLink(pages, 'trich', { icon: T.name_tag, text: '富文本', y: 38 }),
        new RowLink(pages, 'truler', { icon: T.map, text: '字宽标尺', y: 56 }),
        new RowLink(pages, 'tlong0', { icon: T.writable, text: '长文本分页', y: 74 }),
        new RowLink(pages, 'trun', { icon: T.emerald, text: '运行期长文本', y: 92 }),
        new RowLink(pages, 'tspecial', { icon: T.name_tag, text: '特殊字符', y: 110 })))
    home.add(new Side('R').add(new Title('目录'),
        new RowLink(pages, 'sword', { icon: T.sword, text: '钻石剑', y: 20 }),
        new RowLink(pages, 'diamond', { icon: T.diamond, text: '钻石', y: 38 }),
        new RowLink(pages, 'about', { icon: T.book_item, text: '检查清单', y: 56 }),
        new RowLink(pages, 'tlayer', { icon: T.paper, text: '叠放顺序', y: 74 }),
        new RowLink(pages, 'tfocus', { icon: T.sword, text: '实验 E（客户端聚焦）', y: 92 })))
    home.add(new ServerArrow('home', 'sword', 'right'))

    // 钻石剑
    const sword = pages.page('sword')
    sword.add(new Side('L').add(new Title('钻石剑'), new ItemSlot(detail, 'sword', { index: 0, icon: T.sword, name: '钻石剑', x: 37, y: 24, size: 36 }),
        new Body('悬停：提示框显示表单按钮带来的运行期数据。点击：打开详情弹层。', 68)))
    sword.add(new Side('R').add(new Title('合成'),
        new ItemSlot(detail, 'sword', { index: 1, icon: T.diamond, name: '钻石', x: 35, y: 24 }),
        new ItemSlot(detail, 'sword', { index: 2, icon: T.diamond, name: '钻石', x: 35, y: 44 }),
        new ItemSlot(detail, 'sword', { index: 3, icon: T.stick, name: '木棍', x: 35, y: 64 })))
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

    // 实验 E：客户端翻页 + 聚焦优先级（不在文本章节的翻页链里，用书签回目录）
    const focusPage = pages.page('tfocus')
    const fl = new Side('L'), fr = new Side('R')
    buildFocusTest(fl, fr)
    focusPage.add(fl, fr)

    // 「原地不动」：透明的表单按钮（序号 9），聚焦优先级 50——介于聚焦版箭头（100）与普通箭头（10）之间。
    // 当前方向没有箭头时（例如最后一页再点「下一页」），鼠标没动的点击交给它：服务端原样重开当前页（真机 1.5.3：否则落到反方向的箭头，来回循环）
    root.add(new FormButton({ name: 'stay', index: 9, tag: 'stay|', size: [1, 1], anchor: 'top_left', focusPrecedence: 50 }))

    // 书签（任何页都在）
    root.add(bookmark)
    root.add(new DebugStrip(options.variant ?? '预览', bookmark.name))
    void bookmark

    // 详情弹层
    detail.page('none')
    // 透明拦截层：挡住下面的点击；点它不关弹层（只有「关闭」按钮才关）
    detail.page('sword').add(detail.blocker('sword', { size: [272, 180], anchor: 'top_left' }), new DetailOverlay(detail))

    // 关闭整本书：普通表单按钮（序号 4），点了表单关闭，服务端收到选择
    const close = new FormButton({ index: 4, tag: 'close|', size: [14, 14], anchor: 'top_left', offset: [248, 3], layer: 60 })
    close.default.add(new Label({ text: '§4×', anchor: 'center' }))
    close.hover.add(new Label({ text: '§c×', anchor: 'center' }))
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
const RULER_ROWS_R = ['钻石剑钻石剑钻石剑钻', 'abc 中文 xyz', '中一二三十口日', '，。、；：！？', '「引号」（括号）', '§l粗体钻石剑', '背包里有 12 个', '§oitalic 斜体']

class RulerRow extends Panel {
    constructor(text, y) {
        const expected = textWidth(text)
        super({ size: ['100%', 15], anchor: 'top_left', offset: [0, y] })
        this.add(new Label({ text, color: BODY, anchor: 'top_left' }))
        this.add(new Image({ texture: T.ruler, size: [101, 5], anchor: 'top_left', offset: [0, 9] }))
        this.add(new Label({ text: `§8${expected}`, fontScale: 0.75, anchor: 'top_right', offset: [-2, 0] }))
    }
}

/**
 * 颜色样例：深色底（浅色字在米黄纸上看不清）。文字是底板图片的**子元素**——
 * 真机 1.3.0：文字与底板作为同层兄弟时整块不见了（被底板盖住），子元素的写法（提示框、弹层）一直正常。
 */
class Swatches extends Panel {
    constructor(codes, y, height) {
        super({ size: ['100%', height], anchor: 'top_left', offset: [0, y] })
        const bg = new Image({ texture: T.purple, size: ['100%', '100%'] })
        codes.forEach((c, i) => bg.add(new Label({ text: `§7${c} §${c}示例Ab`, shadow: true, anchor: 'top_left', offset: [6 + (i % 2) * 52, 5 + Math.floor(i / 2) * 10] })))
        this.add(bg)
    }
}

/** 小箭头（翻页手感测试用） */
class MiniArrow extends Toggle {
    constructor(pages, key, dir, extra = {}) {
        // 聚焦优先级：右 200、左 190（比书本自己的箭头 100、「原地不动」50 都高）
        super({ ...pages.toggleOptions(key), size: [28, 18], anchor: 'top_left', offset: [dir === 'left' ? 2 : 80, 100], focusPrecedence: dir === 'right' ? 200 : 190, ...extra })
        pages.attach(key, this)
        const art = (hover) => new Image({ texture: dir === 'left' ? (hover ? T.arrowLH : T.arrowL) : (hover ? T.arrowRH : T.arrowR), size: [20, 12] })
        this.unchecked.add(art(false)); this.checked.add(art(false))
        this.uncheckedHover.add(art(true)); this.checkedHover.add(art(true))
    }
}

/**
 * 实验 E：客户端翻页能不能靠聚焦——A / B（真机 1.2.0）点了箭头后鼠标不动再点没反应；服务端翻页靠默认聚焦解决了（1.5.3）。
 * 这里给小翻页器的箭头加聚焦优先级，看「聚焦的箭头隐藏 / 禁用后，焦点会不会挪到新页的箭头、鼠标没动的点击会不会交给它」。
 *   E1：每页自己的箭头（显示 / 隐藏切换）
 *   E2：三页的箭头叠在同一位置，只有当前页的那个启用（禁用的什么都不画）
 */
function buildFocusTest(sideA, sideB) {
    const mini = (group, letter) => {
        const p = new Pages({ group, start: `${letter}0`, size: ['100%', 120], anchor: 'top_left', offset: [0, 20] })
        for (let k = 0; k < 3; k++) p.page(`${letter}${k}`).add(new Label({ text: `§l${letter.toUpperCase()}${k + 1}`, color: TITLE, fontScale: 3, anchor: 'top_middle', offset: [0, 40] }))
        return p
    }
    const a = mini('nfa', 'a')
    for (let k = 0; k < 3; k++) {
        if (k > 0) a.page(`a${k}`).add(new MiniArrow(a, `a${k - 1}`, 'left'))
        if (k < 2) a.page(`a${k}`).add(new MiniArrow(a, `a${k + 1}`, 'right'))
    }
    sideA.add(new Title('E1：显示切换'), new Body('§8鼠标停在右箭头上不动，连点', 20), a)
    const b = mini('nfb', 'b')
    const arrows = []
    for (let k = 0; k < 3; k++) {
        if (k > 0) arrows.push([k, b.add(new MiniArrow(b, `b${k - 1}`, 'left', { lockedVisible: false })).children.at(-1)])
        if (k < 2) arrows.push([k, b.add(new MiniArrow(b, `b${k + 1}`, 'right', { lockedVisible: false })).children.at(-1)])
    }
    // 箭头都建完再设启用条件（showing() 要包含所有入口）
    for (const [k, arrow] of arrows) arrow.set({ enabled: b.showing(`b${k}`) })
    sideB.add(new Title('E2：启用切换'), new Body('§8同上：看哪一边不动鼠标也能连续翻页', 20), b)
}

/** 特殊字符：左边原样输出（绕过编译器的保护），右边经编译器处理（# / $ 开头补 §r） */
const SPECIAL = ['#abc', '$abc', 'a#b$c', '100%', 'a%b%c', '%s %d %%', '&+=?/', '@abc']
function buildSpecialPage(page) {
    const row = (i, text, raw) => {
        const p = new Panel({ size: ['100%', 12], anchor: 'top_left', offset: [0, 22 + i * 15] })
        p.add(new Label({ text: `§8${i + 1}`, anchor: 'left_middle' }))
        p.add(new Label({ text, color: BODY, anchor: 'left_middle', offset: [12, 0], ...(raw ? { raw: { text } } : {}) }))
        return p
    }
    page.add(new Side('L').add(new Title('原样输出'), ...SPECIAL.map((t, i) => row(i, t, true))))
    page.add(new Side('R').add(new Title('CUI 处理后'), ...SPECIAL.map((t, i) => row(i, t, false))))
}

/** 叠放顺序诊断：深色底板 + 白字的 5 种写法，看哪几种文字被盖住（真机 1.3.0 色块里的文字不见了） */
function buildLayerTest(sideL, sideR) {
    const row = (i, build) => { const p = new Panel({ size: ['100%', 18], anchor: 'top_left', offset: [0, 22 + i * 20] }); build(p); return p }
    const bg = () => new Image({ texture: T.purple, size: ['100%', '100%'] })
    const txt = (s, extra = {}) => new Label({ text: s, color: WHITE, anchor: 'left_middle', offset: [6, 0], ...extra })
    sideL.add(new Title('叠放顺序'),
        row(0, (p) => p.add(bg(), txt('V0 字显式 layer 0', { layer: 0 }))),
        row(1, (p) => p.add(bg(), txt('V1 图在前 字在后'))),
        row(2, (p) => p.add(bg(), txt('V2 同上 + 阴影', { shadow: true }))),
        row(3, (p) => p.add(txt('V3 字在前 图在后'), bg())),
        row(4, (p) => p.add(bg(), txt('V4 字写 layer 1', { layer: 1 }))),
        row(5, (p) => p.add(bg().add(txt('V5 字是图的子元素')))))
    sideR.add(new Title('1.5.0 预期'), new Body('1.4.0 真机：只有 V4 的字可见。\n\n现在框架给文字缺省 layer 1：V1–V5 都应可见；V0 故意写 layer 0，应被盖住。'))
}

/** 文本测试的各页：折行对比、富文本、字宽标尺、长文本分页、运行期长文本、翻页手感 */
function buildTextPages(pages) {
    const chain = ['twrap', 'trich', 'truler']
    // 折行对比
    const wrap = pages.page('twrap')
    wrap.add(new Side('L').add(new Title('引擎自动折行'), new Label({ text: SAMPLE, color: BODY, size: ['100%', 'default'], anchor: 'top_left', offset: [0, 22] })))
    wrap.add(new Side('R').add(new Title('CUI 预折行'), new Paragraph({ text: SAMPLE, width: 110, color: BODY, anchor: 'top_left', offset: [0, 22] })))
    // 富文本
    const rich = pages.page('trich')
    rich.add(new Side('L').add(new Title('颜色代码 0–f'), new Swatches('0123456789abcdef'.split(''), 22, 90)))
    rich.add(new Side('R').add(new Title('基岩版独有 + 格式'), new Swatches('ghijmnpqstuv'.split(''), 22, 70),
        new Paragraph({ text: '§l粗体 Bold§r  §o斜体 Italic§r\n§c红§l红粗§9蓝粗§r普通', width: 110, color: BODY, anchor: 'top_left', offset: [0, 94] }),
        // 乱码：纯 ASCII（Minecraft 字体）vs 含汉字（Unifont：真机 1.5.3 只显示成点）
        new Label({ text: '§kabcdefgh', color: BODY, anchor: 'top_left', offset: [0, 116] }),
        new Label({ text: '§8← 纯英文乱码', anchor: 'top_left', offset: [52, 116] }),
        new Label({ text: '§k乱码abc', color: BODY, anchor: 'top_left', offset: [0, 128] }),
        new Label({ text: '§8← 含汉字', anchor: 'top_left', offset: [52, 128] })))
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
            page.add(new Side(side).add(new Title(`长文本 ${k + 1} / ${chunks.length}`), new Label({ text: chunks[k], color: BODY, size: ['100%', 'default'], anchor: 'top_left', offset: [0, 22] })))
        }
    }
    // 运行期长文本：按钮 5 的文字（脚本按玩家背包生成）
    chain.push('trun')
    const run = pages.page('trun')
    const runtimeText = (size) => new CollectionItem({ collection: 'form_buttons', index: 5, size: [110, 10], anchor: 'top_left', offset: [0, 22] })
        .add(new Label({ text: form.buttonText.minus('txt|'), color: BODY, size, anchor: 'top_left' }))
    run.add(new Side('L').add(new Title('运行期：高度 default'), runtimeText([110, 'default'])))
    const clipped = new Panel({ size: [110, 50], anchor: 'top_left', offset: [0, 22], clip: true })
    clipped.add(new CollectionItem({ collection: 'form_buttons', index: 5, size: [110, 10], anchor: 'top_left' })
        .add(new Label({ text: form.buttonText.minus('txt|'), color: BODY, size: [110, 'default'], anchor: 'top_left' })))
    run.add(new Side('R').add(new Title('运行期：裁剪到 50 高'), clipped, new Body('§8上面的框只有 50 像素高，超出的部分被裁掉。', 80)))
    // 特殊字符、叠放顺序
    chain.push('tspecial')
    buildSpecialPage(pages.page('tspecial'))
    chain.push('tlayer')
    const layerPage = pages.page('tlayer')
    const ll = new Side('L'), lr = new Side('R')
    buildLayerTest(ll, lr)
    layerPage.add(ll, lr)
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
