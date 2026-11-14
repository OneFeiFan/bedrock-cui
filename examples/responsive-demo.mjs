/**
 * 响应式布局演示——全部用面向对象的新写法（没有一个参数对象）：
 *   · 贴图、文字样式是有名字的常量，全书共用，改一处处处生效
 *   · 自定义组件 = 继承（ItemSlot、StatRow、TextButton、Divider）
 *   · 卡片宽 92%、高 88%，再用 setMinSize / setMaxSize 给上下限；内部全是 Row / Column：
 *     标题栏、正文（setGrow 占满剩余高度）、底栏（按钮靠右）。编译成 JSON UI 原生的百分比 / fill，
 *     **游戏里随屏幕大小自适应**；浏览器预览里切换屏幕尺寸看效果。
 */
import { Align, Anchor, Color, Column, FormButton, Image, Insets, Justify, Label, Length, Panel, Row, Size, Texture, TextStyle } from 'cui'

// ───────────── 贴图（尺寸、九宫格信息跟着贴图走） ─────────────
export const Textures = {
    FRAME: Texture.of('textures/ui/purpleBorder').withSize(16, 16).withBaseSize(16, 16).withNineslice(4),
    CELL: Texture.of('textures/ui/cell_image').withSize(10, 10).withBaseSize(5, 5).withNineslice(1),
    HOVER: Texture.of('textures/cui_test/row_hover').withSize(1, 1),
    LINE: Texture.of('textures/cui_test/line').withSize(1, 1),
    SWORD: Texture.of('textures/items/diamond_sword').withSize(16, 16),
    DIAMOND: Texture.of('textures/items/diamond').withSize(16, 16),
    STICK: Texture.of('textures/items/stick').withSize(16, 16),
}

// ───────────── 文字样式 ─────────────
export const Styles = {
    TITLE: TextStyle.of(Color.WHITE).withShadow(),
    BODY: TextStyle.of(Color.hex('#d4d4d4')).withShadow(),
    MUTED: TextStyle.of(Color.hex('#9a9a9a')).withShadow(),
    VALUE: TextStyle.of(Color.hex('#7ee08a')).withShadow(),
    BUTTON: TextStyle.of(Color.WHITE).withShadow(),
}

// ───────────── 组件 ─────────────

/** 物品格：格子底 + 图标 */
class ItemSlot extends Panel {
    constructor(icon, size = 22) {
        super()
        this.setSize(size, size)
        this.add(new Image(Textures.CELL).setSize(Size.full()))
        this.add(new Image(icon).setSize(16, 16).setLayer(2))
    }
}

/** 一像素的分隔线：在 Column 里自动拉满宽度 */
class Divider extends Image {
    constructor() {
        super(Textures.LINE)
        this.setKeepRatio(false).setHeight(1).setAlpha(0.6)
    }
}

/** 属性行：名字靠左（伸展），数值靠右 */
class StatRow extends Row {
    constructor(name, value) {
        super()
        this.setHeight(10).setAlign(Align.CENTER)
        this.add(new Label(name, Styles.MUTED).setGrow(), new Label(value, Styles.VALUE))
    }
}

/** 文字按钮 = 表单按钮（第 index 个，按钮文字含 tag 时显示）：九宫格底 + 悬停高亮 */
class TextButton extends FormButton {
    constructor(index, tag, text, width = 42) {
        super(index, tag, width, 15)
        const face = (hover) => [
            new Image(hover ? Textures.HOVER : Textures.CELL).setKeepRatio(false).setSize(Size.full()),
            new Label(text, Styles.BUTTON),
        ]
        this.default.add(...face(false))
        this.hover.add(...face(true))
        this.pressed.add(...face(true))
    }
}

// ───────────── 界面 ─────────────

const DESCRIPTION = '钻石剑是钻石制成的近战武器，攻击伤害与耐久都很高。可以附魔锋利、抢夺、火焰附加等；在铁砧上用钻石修复。'
    + '这段文字没有预先折行：它拉满正文的宽度，屏幕变窄时由引擎重新折行。'

export function buildResponsiveDemo() {
    const root = new Panel().setSize(Size.full())

    // 卡片：宽 92%、高 88%，上下限 220×140 ～ 400×250，居中
    const card = new Panel().setName('card')
        .setSize(Length.pct(92), Length.pct(88))
        .setMinSize(220, 140).setMaxSize(400, 250)
        .setAnchor(Anchor.CENTER)
    card.add(new Image(Textures.FRAME).setSize(Size.full()))

    const content = new Column().setName('content').setSize(Size.full()).setPadding(Insets.all(7)).setGap(4)

    // 标题栏：图标 | 名字（伸展）| 稀有度
    const header = new Row().setName('header').setHeight(22).setGap(6).setAlign(Align.CENTER)
    header.add(new ItemSlot(Textures.SWORD), new Label('钻石剑', Styles.TITLE).setGrow(), new Label('§7稀有度 §b稀有', Styles.MUTED))

    // 正文：左栏属性（定宽 84）| 右栏说明 + 合成材料（伸展）
    const body = new Row().setName('body').setGap(8).setGrow()
    const stats = new Column().setName('stats').setWidth(84).setGap(2)
    stats.add(new StatRow('攻击伤害', '7'), new StatRow('攻击速度', '1.6'), new StatRow('耐久', '1561'), new StatRow('附魔能力', '10'))
    const detail = new Column().setName('detail').setGap(4).setGrow()
    const recipe = new Row().setName('recipe').setHeight(22).setGap(2)
    recipe.add(new ItemSlot(Textures.DIAMOND), new ItemSlot(Textures.DIAMOND), new ItemSlot(Textures.STICK))
    detail.add(new Label(DESCRIPTION, Styles.BODY).setName('desc'), new Label('合成材料', Styles.MUTED), recipe)
    body.add(stats, detail)

    // 底栏：按钮靠右
    const footer = new Row().setName('footer').setHeight(15).setGap(4).setJustify(Justify.END)
    footer.add(new TextButton(0, 'cancel|', '取消'), new TextButton(1, 'recipe|', '查看配方', 56))

    content.add(header, new Divider(), body, new Divider(), footer)
    card.add(content)
    root.add(card)
    return root
}

/** 表单约定：标题（路由键）；按钮 0 取消、1 查看配方 */
export const RESPONSIVE_FORM = { title: 'cui_ui:responsive', buttons: ['cancel|', 'recipe|'] }

/** 预览里切换的屏幕尺寸（界面像素） */
export const SCREENS = [
    { name: '小屏手机', size: [320, 180] },
    { name: '手机', size: [480, 216] },
    { name: '电脑', size: [640, 360] },
]
