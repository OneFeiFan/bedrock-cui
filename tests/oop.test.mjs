import test from 'node:test'
import assert from 'node:assert/strict'
import {
    Align, Anchor, Color, Column, compileNamespace, finalize, findBox, Image, Insets, Justify, Label, layout, Length,
    Panel, Row, Size, Texture, TextStyle, Toggle, Vec2,
} from '../dist/index.js'

const R = (b) => [b.rect.x, b.rect.y, b.rect.w, b.rect.h].map((v) => Math.round(v * 100) / 100)
const run = (root, viewport = [400, 300]) => layout(finalize(root), { viewport })

test('值类型：Length 加减、Size、Color、Insets、Vec2 输出 JSON UI 写法', () => {
    assert.equal(Length.px(8).toJSON(), 8)
    assert.equal(Length.pct(100).minus(6).toJSON(), '100% - 6px')
    assert.equal(Length.children().plus(Length.px(8)).toJSON(), '100%c + 8px')
    assert.equal(Length.largestChild().toJSON(), '100%cm')
    assert.throws(() => Length.fill().plus(2), /不能参与加减/)
    assert.deepEqual(Size.of(Length.pct(90), 40).toJSON(), ['90%', 40])
    assert.deepEqual(Size.fitContent(4).toJSON(), ['100%cm + 8px', '100%cm + 8px'])
    assert.deepEqual(Color.hex('#3d2108').toJSON(), [0.239, 0.129, 0.031])
    assert.equal(Color.rgb(61, 33, 8).toString(), '#3d2108')
    assert.deepEqual(Insets.symmetric(3, 1).toJSON(), [3, 1, 3, 1])
    assert.deepEqual(Vec2.of(2, Length.pct(-50)).toJSON(), [2, '-50%'])
    assert.equal(Anchor.CENTER_LEFT.toJSON(), 'left_middle')
})

test('元素：新写法（构造函数只收必要参数 + 链式 / 属性）与旧写法编译结果完全相同', () => {
    const BODY = TextStyle.of(Color.hex('#45301c')).withShadow()
    const ICON = Texture.of('textures/items/book_normal').withSize(16, 16)
    const modern = new Panel().setName('row').setSize(116, 18).setAnchor(Anchor.TOP_LEFT)
    modern.add(new Image(ICON).setSize(16, 16).setAnchor(Anchor.CENTER_LEFT).setOffset(3, 0))
    const label = new Label('入门', BODY).setAnchor(Anchor.CENTER_LEFT).setOffset(23, 0)
    label.layer = 2
    modern.add(label)
    const legacy = new Panel({ name: 'row', size: [116, 18], anchor: 'top_left', children: [
        new Image({ texture: 'textures/items/book_normal', size: [16, 16], anchor: 'left_middle', offset: [3, 0] }),
        new Label({ text: '入门', color: Color.hex('#45301c').toJSON(), shadow: true, anchor: 'left_middle', offset: [23, 0], layer: 2 }),
    ] })
    assert.deepEqual(compileNamespace('t', { r: modern }).json, compileNamespace('t', { r: legacy }).json)
    // 读属性得到有类型的对象
    assert.ok(modern.size instanceof Size)
    assert.equal(modern.size.width.toJSON(), 116)
    assert.equal(label.color.toString(), '#45301c')
    assert.equal(modern.find('row'), undefined)
    // 贴图信息跟着 Texture 走：不给 textures 表，静态检查也知道 16×16
    assert.deepEqual(Texture.info('textures/items/book_normal'), { size: [16, 16] })
    // 开关
    const t = new Toggle('gbp', 3).setName('row_sword').setFocusPrecedence(200)
    assert.deepEqual([t.group, t.index], ['gbp', 3])
})

test('Row：定宽 40 + 伸展 + 定宽 30、间距 5 → 伸展的分到 120；编译成 stack_panel + 槽位 + 间距', () => {
    const row = new Row().setName('bar').setSize(200, 20).setAnchor(Anchor.TOP_LEFT).setGap(5)
    row.add(new Panel().setName('a').setSize(40, 20), new Panel().setName('b').setGrow(), new Panel().setName('c').setSize(30, 10))
    const b = run(new Panel().setSize(400, 300).setAnchor(Anchor.TOP_LEFT).add(row))
    assert.deepEqual(R(findBox(b, 'a')), [0, 0, 40, 20])
    assert.deepEqual(R(findBox(b, 'b')), [45, 0, 120, 20])
    assert.deepEqual(R(findBox(b, 'c')), [170, 0, 30, 10], '交叉轴缺省 STRETCH，但写了高度的不拉伸（同 CSS）')
    const { json, issues } = compileNamespace('t', { bar: row })
    assert.deepEqual(issues, [])
    const stack = json.bar.controls[0].flex
    assert.equal(stack.type, 'stack_panel')
    assert.equal(stack.orientation, 'horizontal')
    assert.deepEqual(stack.controls.map((c) => Object.keys(c)[0]), ['slot0', 'gap1', 'slot1', 'gap2', 'slot2'])
    assert.deepEqual(stack.controls[2].slot1.size, ['fill', '100%'], '伸展 = 槽位 fill')
})

test('Row：主轴居中 / 两端分布；交叉轴居中', () => {
    const make = (j, a) => {
        const row = new Row().setName('bar').setSize(200, 50).setAnchor(Anchor.TOP_LEFT).setGap(10).setJustify(j).setAlign(a)
        row.add(new Panel().setName('a').setSize(40, 20), new Panel().setName('b').setSize(30, 20))
        return run(new Panel().setSize(400, 300).setAnchor(Anchor.TOP_LEFT).add(row))
    }
    let b = make(Justify.CENTER, Align.CENTER)
    assert.deepEqual(R(findBox(b, 'a')), [60, 15, 40, 20], '用掉 80，两侧各留 60；交叉轴居中')
    assert.deepEqual(R(findBox(b, 'b')), [110, 15, 30, 20])
    b = make(Justify.SPACE_BETWEEN, Align.END)
    assert.deepEqual(R(findBox(b, 'a')), [0, 30, 40, 20])
    assert.deepEqual(R(findBox(b, 'b')), [170, 30, 30, 20], '两端分布；交叉轴贴底')
    b = make(Justify.END, Align.START)
    assert.deepEqual(R(findBox(b, 'b')), [170, 0, 30, 20])
})

test('Column：文字拉满列宽后按宽度折行；按内容决定高度（100%c）', () => {
    const col = new Column().setName('col').setSize(Size.of(60, Length.children())).setAnchor(Anchor.TOP_LEFT).setGap(2)
    col.add(new Label('标题').setName('t'), new Label('这是一段比较长的文字，会按列宽折行').setName('body'))
    const b = run(new Panel().setSize(400, 300).setAnchor(Anchor.TOP_LEFT).add(col))
    const body = findBox(b, 'body')
    assert.equal(body.rect.w, 60, '拉伸到列宽')
    assert.ok(body.lines.length >= 3, `按 60 像素折行：${body.lines.length} 行`)
    assert.equal(findBox(b, 'col').rect.h, findBox(b, 't').rect.h + 2 + body.rect.h, '列高 = 子控件之和 + 间距')
})

test('响应式：宽 90%、最大 300、最小 150——不同屏幕宽度下自适应；编译成 min_size / max_size', () => {
    const card = new Panel().setName('card').setSize(Length.pct(90), 100).setMaxSize(300, 100).setMinSize(150, 100)
    const at = (w) => findBox(run(new Panel().setSize(Size.full()).add(card.clone()), [w, 300]), 'card').rect.w
    assert.equal(at(400), 300, '大屏：被最大宽度限住')
    assert.equal(at(200), 180, '中屏：90%')
    assert.equal(at(120), 150, '小屏：被最小宽度托住')
    const { json } = compileNamespace('t', { card })
    assert.deepEqual([json.card.min_size, json.card.max_size], [[150, 100], [300, 100]])
})

test('Row 里的伸展子控件受最大尺寸约束；setGrow 写在非弹性容器里 → 静态检查提示', () => {
    const row = new Row().setName('bar').setSize(300, 20).setAnchor(Anchor.TOP_LEFT)
    row.add(new Panel().setName('a').setGrow().setMaxSize(100, 20), new Panel().setName('b').setSize(50, 20))
    const b = run(new Panel().setSize(400, 300).setAnchor(Anchor.TOP_LEFT).add(row))
    assert.equal(findBox(b, 'a').rect.w, 100)
    const bad = new Panel().add(new Panel().setName('x').setGrow())
    assert.deepEqual(compileNamespace('t', { bad }).issues.map((i) => i.rule), ['grow-outside-flex'])
})

test('Row 里的 FormButton 保留像素尺寸（编译成正方形网格要边长）', async () => {
    const { FormButton } = await import('../dist/index.js')
    const row = new Row().setName('footer').setSize(200, 15).setJustify(Justify.END).setGap(4)
    row.add(new FormButton(0, 'cancel|', 42, 15), new FormButton(1, 'recipe|', 56, 15))
    const { issues } = compileNamespace('t', { footer: row })
    assert.deepEqual(issues, [])
    const b = run(new Panel().setSize(400, 300).setAnchor(Anchor.TOP_LEFT).add(row))
    const rowBox = findBox(b, 'footer')
    const xs = rowBox.children[0].children.filter((c) => c.node.name.startsWith('slot')).map((c) => Math.round(c.rect.x - rowBox.rect.x))
    assert.deepEqual(xs, [98, 144], '相对 Row 左边：靠右，200 − 56 − 4 − 42 = 98')
})
