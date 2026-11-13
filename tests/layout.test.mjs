// 排版引擎：按 JSON UI 规则（锚点、尺寸单位、stack、grid、clip、layer、keep_ratio、文字、按钮态、集合项）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Panel, Stack, Grid, Image, Label, FormGate, FormButton, buttonPayload, finalize, layout, findBox, textWidth } from '../dist/index.js'

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
    // 真机：%c 在两个方向上都是子控件之和（交叉方向也求和）；%cm 取最大
    const fit = new Stack({ name: 's', size: ['100%c', '100%c'], orientation: 'horizontal', anchor: 'top_left', children: [new Panel({ size: [10, 5] }), new Panel({ size: [15, 8] })] })
    assert.deepEqual(R(findBox(run(fit), 's')).slice(2), [25, 13])
    const cm = new Stack({ name: 's', size: ['100%c', '100%cm'], orientation: 'horizontal', anchor: 'top_left', children: [new Panel({ size: [10, 5] }), new Panel({ size: [15, 8] })] })
    assert.deepEqual(R(findBox(run(cm), 's')).slice(2), [25, 8])
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
    assert.deepEqual(findBox(b, 'w').lines, ['中文', '中文', '中文'], '「中」6.5 +「文」8.5 = 15 ≤ 20，再加一个就超')
    assert.equal(findBox(b, 'w').rect.h, 30)
    assert.equal(findBox(b, 'p').rect.w, textWidth('提示，左'))
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

test('九宫格：高清贴图按 base_size 切图（原版 cell_image：10×10 像素、base_size 5×5、nineslice 1 → 切 2 像素、画 1 像素）', () => {
    const textures = (p) => ({ cell: { size: [10, 10], baseSize: [5, 5], nineslice: 1 }, border: { size: [16, 16], nineslice: [4, 3, 4, 3] } })[p]
    const root = new Panel({ size: [40, 40], anchor: 'top_left', children: [new Image({ name: 'c', texture: 'cell', size: [20, 20] }), new Image({ name: 'b', texture: 'border', size: [30, 10] })] })
    const b = run(root, { textures })
    assert.deepEqual(findBox(b, 'c').nineslice, [1, 1, 1, 1], '画到屏幕上：1 界面像素')
    assert.deepEqual(findBox(b, 'c').slice, [2, 2, 2, 2], '切图：2 贴图像素')
    assert.deepEqual(findBox(b, 'c').draw, findBox(b, 'c').rect, '九宫格不受 keep_ratio 影响')
    assert.deepEqual(findBox(b, 'b').slice, [4, 3, 4, 3], 'base_size 缺省 = 贴图尺寸')
})

test('cui/node：从资源包目录读贴图信息（PNG 宽高 + 同名 .json 的 nineslice_size / base_size，带注释也能读）', async () => {
    const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
    const { textureInfoFrom } = await import('../dist/node/index.js')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-tex-'))
    fs.mkdirSync(path.join(dir, 'textures/ui'), { recursive: true })
    fs.copyFileSync(new URL('../preview-src/public/textures/cell_image.png', import.meta.url), path.join(dir, 'textures/ui/cell_image.png'))
    fs.writeFileSync(path.join(dir, 'textures/ui/cell_image.json'), '{\n  // 原版\n  "nineslice_size": 1, "base_size": [5, 5]\n}')
    const info = textureInfoFrom([path.join(dir, 'nope'), dir])
    assert.deepEqual(info('textures/ui/cell_image'), { size: [10, 10], nineslice: 1, baseSize: [5, 5] })
    assert.equal(info('textures/ui/missing'), undefined)
})

test('内边距（安全区）与越界检查：padding 编译成内层面板；contain 里越出安全区的子孙报 out-of-bounds；overflow 的跳过', async () => {
    const { compileNamespace } = await import('../dist/index.js')
    const side = new Panel({ name: 'side', size: [116, 160], anchor: 'top_left', padding: [3, 0, 3, 0], contain: true })
    side.add(new Image({ name: 'ruler', texture: 'r', size: [121, 5], anchor: 'top_left' }))
    side.add(new Panel({ name: 'ok', size: ['100%', 10], anchor: 'top_left', offset: [0, 20] }))
    side.add(new Panel({ name: 'tip', size: [80, 20], anchorFrom: 'top_right', anchorTo: 'top_left', overflow: true }))
    const b = run(new Panel({ size: [200, 200], anchor: 'top_left', children: [side] }))
    assert.deepEqual(R(findBox(b, 'ok')), [3, 20, 110, 10], '子元素按内容面板（110 宽、左缩 3）排')
    const { json, issues } = compileNamespace('t', { root: new Panel({ size: [200, 200], children: [side.clone()] }) })
    const content = json.root.controls[0].side.controls[0].content
    assert.deepEqual([content.size, content.offset], [['100% - 6px', '100% - 0px'], [3, 0]])
    assert.deepEqual(issues.map((i) => `${i.rule}@${i.path.split('/').pop()}：${i.message.replace(/^.*（|）$/g, '')}`), ['out-of-bounds@ruler：右 11 像素'])
})

test('静态文字以 # / $ 开头会被游戏当成绑定 / 变量（真机整行空白）：编译时补 §r', async () => {
    const { compileNamespace, escapeText } = await import('../dist/index.js')
    assert.equal(escapeText('#$%&'), '§r#$%&')
    assert.equal(escapeText('$abc'), '§r$abc')
    assert.equal(escapeText('a#b'), 'a#b')
    const { json } = compileNamespace('t', { root: new Panel({ children: [new Label({ name: 'x', text: '#hash' })] }) })
    assert.equal(json.root.controls[0].x.text, '§r#hash')
})
