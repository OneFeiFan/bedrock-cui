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
import { CollectionItem, FormButton, Image, Label, Pages, Panel, Stack, Toggle, form, toggleState } from 'cui'

export const T = {
    book: 'textures/cui_test/book', line: 'textures/cui_test/line', rowHover: 'textures/cui_test/row_hover',
    arrowL: 'textures/cui_test/arrow_left', arrowLH: 'textures/cui_test/arrow_left_hover',
    arrowR: 'textures/cui_test/arrow_right', arrowRH: 'textures/cui_test/arrow_right_hover',
    tab: 'textures/cui_test/tab', tabHover: 'textures/cui_test/tab_hover',
    cell: 'textures/ui/cell_image', highlight: 'textures/ui/highlight_slot', purple: 'textures/ui/purpleBorder',
    sword: 'textures/items/diamond_sword', diamond: 'textures/items/diamond', stick: 'textures/items/stick', book_item: 'textures/items/book_normal',
}
const TITLE = [0.24, 0.13, 0.03], BODY = [0.27, 0.19, 0.11], WHITE = [1, 1, 1], GRAY = [0.67, 0.67, 0.67]

/** 表单数据（脚本发的）：正文带运行期数据；按钮 0–3 是格子的数据载体，按钮 4 是「关闭」 */
export const FORM = {
    title: 'cui_ui:toggle_test',
    body: 'CUI;|§7耐久 1561\n§7可附魔：锋利 V、耐久 III\n§8（这段来自表单正文）',
    buttons: ['s0|§7耐久 1561\n§7可附魔：锋利 V', 's1|', 's2|', 's3|', 'close|'],
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
    constructor(text, y = 22) { super({ text, color: BODY, size: [110, 'default'], anchor: 'top_left', offset: [3, y] }) }
}

class Side extends Panel {
    constructor(side) { super({ size: [116, 160], anchor: 'top_left', offset: [side === 'L' ? 14 : 142, 10] }) }
}

/** 目录行：跳到某页的开关（悬停整行高亮） */
class RowLink extends Toggle {
    constructor(pages, key, { icon, text, y }) {
        super({ ...pages.toggleOptions(key), size: [116, 18], anchor: 'top_left', offset: [0, y] })
        pages.attach(key, this)
        const content = () => [new Image({ texture: icon, size: [16, 16], anchor: 'left_middle', offset: [3, 0], layer: 2 }), new Label({ text, color: BODY, anchor: 'left_middle', offset: [23, 0], layer: 2 })]
        this.unchecked.add(...content())
        this.checked.add(...content())
        this.uncheckedHover.add(new Image({ texture: T.rowHover, keepRatio: false, size: ['100%', '100%'] }), ...content())
        this.checkedHover.add(new Image({ texture: T.rowHover, keepRatio: false, size: ['100%', '100%'] }), ...content())
    }
}

/** 翻页箭头：跳到某页的开关 */
class Arrow extends Toggle {
    constructor(pages, key, dir) {
        super({ ...pages.toggleOptions(key), size: [28, 18], anchor: 'top_left', offset: [dir === 'left' ? 10 : 234, 156] })
        pages.attach(key, this)
        const art = (hover) => new Image({ texture: dir === 'left' ? (hover ? T.arrowLH : T.arrowL) : (hover ? T.arrowRH : T.arrowR), size: [20, 12] })
        this.unchecked.add(art(false)); this.checked.add(art(false))
        this.uncheckedHover.add(art(true)); this.checkedHover.add(art(true))
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

/** 物品格子：表单按钮 index 的数据载体（提示框显示运行期数据）＋ 点击打开详情弹层的开关 */
class ItemSlot extends CollectionItem {
    constructor(detail, detailKey, { index, icon, name, x, y, size = 20 }) {
        super({ collection: 'form_buttons', index, size: [size, size], anchor: 'top_left', offset: [x, y] })
        const tag = `s${index}|`
        const t = new Toggle({ ...detail.toggleOptions(detailKey), size: [size, size] })
        detail.attach(detailKey, t)
        const icn = size >= 32 ? 32 : 16
        const base = () => [new Image({ texture: T.cell, size: ['100%', '100%'], nineslice: 1 }), new Image({ texture: icon, size: [icn, icn], layer: 2 })]
        const payload = form.buttonText.minus(tag)
        const tip = new Image({ texture: T.purple, nineslice: 4, size: ['100%c + 8px', '100%c + 8px'], anchorFrom: 'top_right', anchorTo: 'top_left', offset: [2, -2], layer: 30 })
        tip.add(new Stack({ size: ['100%c', '100%c'], children: [
            new Label({ text: name, color: WHITE, shadow: true, anchor: 'left_middle' }),
            new Label({ text: payload, color: GRAY, shadow: true, anchor: 'left_middle', visible: payload.isEmpty().not() }),
        ] }))
        // 两个悬停态各要一个提示框：一个元素只能有一个父元素，第二份用 clone()
        let tipUsed = false
        const hoverArt = () => [...base(), new Image({ texture: T.highlight, keepRatio: false, alpha: 0.8, size: ['100% - 2px', '100% - 2px'], layer: 1 }), tipUsed ? tip.clone() : (tipUsed = true, tip)]
        t.unchecked.add(...base()); t.checked.add(...base())
        t.uncheckedHover.add(...hoverArt()); t.checkedHover.add(...hoverArt())
        this.add(t)
    }
}

/** 物品详情弹层（第二组开关）：内容来自表单正文；「关闭」= 跳回 none 页 */
class DetailOverlay extends Panel {
    constructor(detail) {
        super({ size: [150, 90], layer: 50 })
        this.add(new Image({ texture: T.purple, nineslice: 4, size: ['100%', '100%'] }))
        this.add(new Label({ text: '钻石剑 · 详情（弹层）', color: WHITE, shadow: true, anchor: 'top_left', offset: [8, 8] }))
        this.add(new Label({ text: form.text.minus('CUI;|'), color: GRAY, shadow: true, size: [134, 'default'], anchor: 'top_left', offset: [8, 22] }))
        const close = new Toggle({ ...detail.toggleOptions('none'), size: [40, 14], anchor: 'bottom_right', offset: [-6, -6] })
        detail.attach('none', close)
        const btn = (hover) => [new Image({ texture: hover ? T.rowHover : T.line, keepRatio: false, size: ['100%', '100%'] }), new Label({ text: '关闭', color: hover ? TITLE : WHITE, layer: 2 })]
        close.unchecked.add(...btn(false)); close.checked.add(...btn(false))
        close.uncheckedHover.add(...btn(true)); close.checkedHover.add(...btn(true))
        this.add(close)
    }
}

/**
 * 诊断格：读一个开关是否选中（「是」/「否」两个标签按状态显示）。
 * 读不到（查找范围之外）时表达式取空值 = 否——所以配合「一定选中」的探针开关就能测出查找范围。
 */
class Cell extends Panel {
    constructor(caption, toggleName, x, options = {}) {
        super({ size: [44, 10], anchor: 'top_left', offset: [x, 0] })
        this.add(new Label({ text: `§8${caption}`, anchor: 'left_middle' }))
        this.add(new Label({ text: '§2是', anchor: 'right_middle', visible: toggleState(toggleName, options) }))
        this.add(new Label({ text: '§c否', anchor: 'right_middle', visible: toggleState(toggleName, options).not() }))
    }
}

/** 诊断带上的一行：从「这一行所在的树位置」读 4 个探针（或给定的开关） */
class ProbeRow extends Panel {
    constructor(title, x, y, targets, options = {}) {
        super({ size: [300, 10], anchor: 'top_left', offset: [x, y] })
        this.add(new Label({ text: `§f${title}`, anchor: 'left_middle' }))
        targets.forEach(([cap, name], i) => this.add(new Cell(cap, name, 96 + i * 50, options)))
    }
}

/** 探针：非单选、默认选中、零尺寸——一定是「选中」 */
const probe = (name) => new Toggle({ name, group: name, radio: false, defaultState: true, size: [0, 0] })
const PROBES = [['根', 'probe_root'], ['分页层', 'probe_pages'], ['页内', 'probe_page'], ['页内深处', 'probe_deep']]

// ───────────── 整本书 ─────────────

export function buildBook() {
    // 书本 180 高 + 下方诊断带：整体 250 高居中，矮屏幕（手机）也能看全诊断带
    const root = new Panel({ size: [290, 250] })
    root.add(new Image({ texture: T.book, size: [272, 180], anchor: 'top_left' }))
    const pages = new Pages({ group: 'gbp', start: 'home', size: [272, 180], anchor: 'top_left' })
    const detail = new Pages({ group: 'gbd', start: 'none', size: [272, 180], anchor: 'top_left', layer: 40 })
    root.add(pages, detail)

    // 目录
    const home = pages.page('home')
    home.add(new Side('L').add(new Title('开关翻页测试'), new Body('整本书在一个表单里：点目录、箭头、书签翻页都不关表单。\n\n钻石剑页的格子：悬停看提示框（数据来自表单按钮），点击打开详情弹层（第二组开关）。\n\n最后一页列出每个开关的选中状态。')))
    home.add(new Side('R').add(new Title('目录'),
        new RowLink(pages, 'sword', { icon: T.sword, text: '钻石剑', y: 20 }),
        new RowLink(pages, 'diamond', { icon: T.diamond, text: '钻石', y: 38 }),
        new RowLink(pages, 'about', { icon: T.book_item, text: '诊断', y: 56 })))
    home.add(new Arrow(pages, 'sword', 'right'))

    // 钻石剑
    const sword = pages.page('sword')
    sword.add(new Side('L').add(new Title('钻石剑'), new ItemSlot(detail, 'sword', { index: 0, icon: T.sword, name: '钻石剑', x: 40, y: 24, size: 36 }),
        new Body('悬停：提示框显示表单按钮带来的运行期数据。点击：打开详情弹层。', 68)))
    sword.add(new Side('R').add(new Title('合成'),
        new ItemSlot(detail, 'sword', { index: 1, icon: T.diamond, name: '钻石', x: 38, y: 24 }),
        new ItemSlot(detail, 'sword', { index: 2, icon: T.diamond, name: '钻石', x: 38, y: 44 }),
        new ItemSlot(detail, 'sword', { index: 3, icon: T.stick, name: '木棍', x: 38, y: 64 })))
    sword.add(new Arrow(pages, 'home', 'left'), new Arrow(pages, 'diamond', 'right'))

    // 钻石
    const diamond = pages.page('diamond')
    diamond.add(new Side('L').add(new Title('钻石'), new Body('这一页从目录、上一页箭头都能到达：同一页有多个入口（同序号的开关）。')))
    diamond.add(new Side('R').add(new Title('说明'), new Body('右下箭头去诊断页，左下箭头回钻石剑页。')))
    diamond.add(new Arrow(pages, 'sword', 'left'), new Arrow(pages, 'about', 'right'))

    // 诊断：探针矩阵（显示在书本下方的诊断带；书本左上角为原点，诊断带从 y=184 开始）
    const about = pages.page('about')
    const bookmark = new Bookmark(pages, 'home')
    const deepSide = new Side('L').add(new Title('诊断'), new Body('书本下方的诊断带：每行从不同的树位置读 4 个「一定选中」的探针开关。「否」= 读不到。\n\n最后一行：从分页层读同序号的开关。'))
    about.add(deepSide)
    about.add(new Side('R').add(new Title('检查清单'), new Body('1 翻页时表单不关、视角不动\n2 多个入口都能到达同一页\n3 弹层关掉后回到原来那页\n4 提示框有运行期数据\n5 弹层打开时点下面的箭头会不会穿透\n6 截图本页（含书本下方的诊断带）')))
    about.add(new Arrow(pages, 'diamond', 'left'))
    // 探针（一定选中）放在 4 个位置
    root.add(probe('probe_root'))
    pages.add(probe('probe_pages'))
    about.add(probe('probe_page'))
    deepSide.add(probe('probe_deep'))
    // 读取者：同样 4 个位置（页内深处的 Side 在 (14,10)，偏移要减掉）+ 一个带 resolve_sibling_scope 的对照
    const Y = 184
    root.add(new ProbeRow('读取位置：根', 0, Y, PROBES))
    pages.add(new ProbeRow('读取位置：分页层', 0, Y + 11, PROBES))
    about.add(new ProbeRow('读取位置：页内', 0, Y + 22, PROBES))
    deepSide.add(new ProbeRow('读取位置：页内深处', -14, Y + 33 - 10, PROBES))
    deepSide.add(new ProbeRow('页内深处＋sibling', -14, Y + 44 - 10, PROBES, { siblingScope: true }))
    // 同序号是否同步：从分页层（页面显示条件读得到的位置）读诊断页的锚点、刚点的目录行、别的页的锚点
    pages.add(new ProbeRow('分页层读同序号', 0, Y + 55, [['锚点诊断', 'gbp__about'], ['目录行诊断', 'gbp_about_l1'], ['箭头诊断', 'gbp_about_l2'], ['锚点目录', 'gbp__home']]))

    // 书签（任何页都在）
    root.add(bookmark)
    void bookmark

    // 详情弹层
    detail.page('none')
    detail.page('sword').add(new DetailOverlay(detail))

    // 关闭整本书：普通表单按钮（序号 4），点了表单关闭，服务端收到选择
    const close = new FormButton({ index: 4, tag: 'close|', size: [14, 14], anchor: 'top_left', offset: [248, 3], layer: 60 })
    close.default.add(new Label({ text: '§4×', anchor: 'center' }))
    close.hover.add(new Label({ text: '§c×', anchor: 'center' }))
    root.add(close)
    return root
}

/** 贴图尺寸（给 lint 与预览用；九宫格写 nineslice） */
export const TEXTURE_INFO = {
    [T.book]: { size: [272, 180] }, [T.line]: { size: [1, 1] }, [T.rowHover]: { size: [1, 1] },
    [T.arrowL]: { size: [20, 12] }, [T.arrowLH]: { size: [20, 12] }, [T.arrowR]: { size: [20, 12] }, [T.arrowRH]: { size: [20, 12] },
    [T.tab]: { size: [20, 16] }, [T.tabHover]: { size: [20, 16] },
    [T.cell]: { size: [10, 10], nineslice: 1 }, [T.highlight]: { size: [1, 1] }, [T.purple]: { size: [16, 16], nineslice: 4 },
    [T.sword]: { size: [16, 16] }, [T.diamond]: { size: [16, 16] }, [T.stick]: { size: [16, 16] }, [T.book_item]: { size: [16, 16] },
}
