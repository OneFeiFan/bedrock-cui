// 排版引擎：按 JSON UI 规则（锚点、尺寸单位、stack、grid、clip、layer、keep_ratio、文字、按钮态、集合项）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Panel, Stack, Grid, Image, Label, FormGate, FormButton, buttonPayload, finalize, layout, findBox } from '../dist/index.js'

const run = (root, env = {}) => layout(finalize(root), { viewport: [200, 100], ...env })
const R = (b) => [b.rect.x, b.rect.y, b.rect.w, b.rect.h].map((v) => Math.round(v * 100) / 100)

test('锚点与偏移：父控件上的 anchor_from 点 + offset − 自身的 anchor_to 点', () => {
    const root = new Panel({ name: 'root', size: [100, 50], anchor: 'top_left' })
    root.add(
        new Panel({ name: 'tl', size: [20, 10], anchor: 'top_left', offset: [3, 4] }),
        new Panel({ name: 'c', size: [20, 10] }),
        new Panel({ name: 'br', size: [20, 10], anchor: 'bottom_right', offset: [-1, -1] }),
        new Panel({ name: 'outside', size: [20, 10], anchorFrom: 'top_right', anchorTo: 'top_left', offset: [2, 0] }),
        new Panel({ name: 'pct', size: [20, 10], anchor: 'top_left', offset: ['10%', '50%'] }))
    const b = run(root)
    assert.deepEqual(R(findBox(b, 'tl')), [3, 4, 20, 10])
    assert.deepEqual(R(findBox(b, 'c')), [40, 20, 20, 10], '缺省居中')
    assert.deepEqual(R(findBox(b, 'br')), [79, 39, 20, 10])
    assert.deepEqual(R(findBox(b, 'outside')), [102, 0, 20, 10], '提示框式：贴在父控件右侧外面')
    assert.deepEqual(R(findBox(b, 'pct')), [10, 25, 20, 10], '百分比偏移相对父控件')
})

test('尺寸单位：%、混合表达式、%c、%x / %y、default', () => {
    const root = new Panel({ name: 'root', size: [100, 50], anchor: 'top_left' })
    root.add(
        new Panel({ name: 'a', size: ['100% - 2px', '50%'] }),
        new Panel({ name: 'fit', size: ['100%c + 8px', '100%c + 6px'], children: [new Panel({ size: [30, 10] }), new Panel({ size: [12, 14] })] }),
        new Panel({ name: 'sq', size: ['100%y', 20] }),
        new Panel({ name: 'd' }))
    const b = run(root)
    assert.deepEqual(R(findBox(b, 'a')).slice(2), [98, 25])
    assert.deepEqual(R(findBox(b, 'fit')).slice(2), [38, 20], '面板 %c 取最大子控件 + 边距')
    assert.deepEqual(R(findBox(b, 'sq')).slice(2), [20, 20])
    assert.deepEqual(R(findBox(b, 'd')).slice(2), [100, 50], 'default = 100%')
})

test('stack：顺序排列、隐藏的子控件不占位、fill 平分剩余、%c 求和', () => {
    const s = new Stack({ name: 's', size: [40, 100], anchor: 'top_left' })
    s.add(new Panel({ name: 'a', size: ['100%', 10] }), new Panel({ name: 'hidden', size: ['100%', 30], visible: false }),
        new Panel({ name: 'f1', size: ['100%', 'fill'] }), new Panel({ name: 'f2', size: [20, 'fill'] }))
    const b = run(s)
    assert.deepEqual(R(findBox(b, 'a')), [0, 0, 40, 10])
    assert.equal(findBox(b, 'hidden'), undefined)
    assert.deepEqual(R(findBox(b, 'f1')), [0, 10, 40, 45])
    assert.deepEqual(R(findBox(b, 'f2')), [10, 55, 20, 45], '交叉方向缺省居中')
    const fit = new Stack({ name: 's', size: ['100%c', '100%c'], orientation: 'horizontal', anchor: 'top_left', children: [new Panel({ size: [10, 5] }), new Panel({ size: [15, 8] })] })
    assert.deepEqual(R(findBox(run(fit), 's')).slice(2), [25, 8])
})

test('grid：格子 = 尺寸 / 行列数，按 gridPos 落格；clip 与 layer', () => {
    const g = new Grid({ name: 'g', dims: [3, 2], size: [90, 40], anchor: 'top_left', clip: true, layer: 2 })
    g.add(new Panel({ name: 'x', gridPos: [2, 1], size: ['100%', '100%'], layer: 3 }), new Panel({ name: 'big', gridPos: [0, 0], size: [200, 200] }))
    const b = run(g)
    assert.deepEqual(R(findBox(b, 'x')), [60, 20, 30, 20])
    assert.equal(findBox(b, 'x').z, 5, '图层相对父控件累加')
    assert.deepEqual(findBox(b, 'big').clip, { x: 0, y: 0, w: 90, h: 40 }, '子孙裁剪到网格')
})

test('keep_ratio：1×1 贴图拉伸到 116×18 会被画成居中的 18×18（真机「高亮是方块」）；关掉或九宫格才铺满', () => {
    const textures = (p) => ({ 'tex/px': { size: [1, 1] }, 'tex/border': { size: [16, 16], nineslice: 4 } })[p]
    const row = new Panel({ name: 'row', size: [116, 18], anchor: 'top_left' })
    row.add(new Image({ name: 'dflt', texture: 'tex/px', size: ['100%', '100%'] }), new Image({ name: 'off', texture: 'tex/px', size: ['100%', '100%'], keepRatio: false }),
        new Image({ name: 'nine', texture: 'tex/border', size: ['100%', '100%'] }))
    const b = run(row, { textures })
    const d = findBox(b, 'dflt').draw
    assert.deepEqual([d.x, d.y, d.w, d.h], [49, 0, 18, 18])
    assert.deepEqual(findBox(b, 'off').draw, { x: 0, y: 0, w: 116, h: 18 })
    assert.deepEqual(findBox(b, 'nine').draw, { x: 0, y: 0, w: 116, h: 18 })
})

test('label：default 尺寸 = 文字尺寸；宽度确定时折行；中文 8、窄标点 3；字符串子元素 = Label', () => {
    const root = new Panel({ name: 'root', size: [100, 100], anchor: 'top_left' })
    root.add(new Label({ name: 'a', text: 'abc', anchor: 'top_left' }), new Label({ name: 'w', text: '中文中文中文', size: [20, 'default'], anchor: 'top_left' }),
        new Label({ name: 'p', text: '提示，左', anchor: 'top_left' }), '纯文字')
    const b = run(root)
    assert.deepEqual(R(findBox(b, 'a')).slice(2), [18, 10])
    assert.deepEqual(findBox(b, 'w').lines, ['中文', '中文', '中文'])
    assert.equal(findBox(b, 'w').rect.h, 30)
    assert.equal(findBox(b, 'p').rect.w, 8 * 3 + 3)
    assert.deepEqual(findBox(b, 'label0').lines, ['纯文字'])
})

test('动态数据：FormGate 按正文显示；按钮悬停态；FormButton 按集合项读按钮文字', () => {
    const root = new Panel({ name: 'root', size: [200, 100] })
    const gate = new FormGate({ name: 'page1', tag: 'P1;' }).add(new Label({ name: 'hello', text: '第一页' }))
    const fb = new FormButton({ name: 'fb', index: 4, tag: 'l0|', size: [116, 18] })
    fb.hover.add(new Image({ name: 'hl', texture: 'x', keepRatio: false, size: ['100%', '100%'] }))
    fb.add(new Label({ name: 'info', text: fb.payload() }))
    root.add(gate, fb)
    const data = (text, buttons) => (name, source, scope) => (name === '#form_text' ? text : (buttons[scope.collection?.index] ?? ''))
    let b = run(root, { data: data('P1;', { 4: 'l0|耐久 250' }) })
    assert.ok(findBox(b, 'hello'), '正文含 P1; → 第一页显示')
    assert.deepEqual(findBox(b, 'info').lines, ['耐久 250'], '按钮文字去掉标记后的运行期数据')
    assert.equal(findBox(b, 'hl'), undefined, '没悬停')
    b = run(root, { data: data('P2;', { 4: '' }), buttonState: (p) => (p.endsWith('/button') ? 'hover' : 'default') })
    assert.equal(findBox(b, 'hello'), undefined)
    assert.equal(findBox(b, 'info'), undefined, '按钮文字不含标记 → 整个按钮隐藏')
    b = run(root, { data: data('', { 4: 'l0|' }), buttonState: () => 'hover' })
    assert.ok(findBox(b, 'hl'), '悬停态子树')
    assert.equal(buttonPayload('x|').node.k, 'bin')
})

test('对象树：一个元素只能有一个父元素（加两处报错）；clone() 深拷贝含状态面板与实例字段', async () => {
    const { Toggle, Panel, Label, FormButton } = await import('../dist/index.js')
    const tip = new Label({ text: '提示' })
    const t = new Toggle({ name: 't', group: 'g', index: 0 })
    t.uncheckedHover.add(tip)
    assert.throws(() => t.checkedHover.add(tip), /只能有一个父元素/)
    t.checkedHover.add(tip.clone())
    assert.notEqual(t.checkedHover.children[0], tip)
    const fb = new FormButton({ index: 1, tag: 'a|', size: [10, 10] })
    fb.hover.add(new Label({ text: 'h' }))
    const c = fb.clone()
    assert.notEqual(c.button, fb.button)
    assert.equal(c.children[0], c.button, '实例字段指向副本子树里的对应元素')
    assert.notEqual(c.hover, fb.hover)
    assert.equal(c.hover.children[0].props.text, 'h')
    const p = new Panel(); p.add(c)
    assert.equal(c.parent, p)
})
