// 排版引擎：按 JSON UI 规则（锚点、尺寸单位、stack、grid、clip、layer、keep_ratio、文字、按钮态、集合项）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Panel, Size, Stack, Grid, Image, Label, finalize, layout, findBox, textWidth } from '../dist/index.js'
import { FormGate, FormButton, buttonPayload } from '../dist/internal.js'

const run = (root, env = {}) => layout(finalize(root), { viewport: [200, 100], ...env })
const R = (b) => [b.rect.x, b.rect.y, b.rect.w, b.rect.h].map((v) => Math.round(v * 100) / 100)

test('锚点与偏移：父控件上的 anchor_from 点 + offset − 自身的 anchor_to 点', () => {
    const root = new Panel().set({ name: 'root', size: [100, 50], anchor: 'top_left' })
    root.add(
        new Panel().set({ name: 'tl', size: [20, 10], anchor: 'top_left', offset: [3, 4] }),
        new Panel().set({ name: 'c', size: [20, 10] }),
        new Panel().set({ name: 'br', size: [20, 10], anchor: 'bottom_right', offset: [-1, -1] }),
        new Panel().set({ name: 'outside', size: [20, 10], anchorFrom: 'top_right', anchorTo: 'top_left', offset: [2, 0] }),
        new Panel().set({ name: 'pct', size: [20, 10], anchor: 'top_left', offset: ['10%', '50%'] }))
    const b = run(root)
    assert.deepEqual(R(findBox(b, 'tl')), [3, 4, 20, 10])
    assert.deepEqual(R(findBox(b, 'c')), [40, 20, 20, 10], '缺省居中')
    assert.deepEqual(R(findBox(b, 'br')), [79, 39, 20, 10])
    assert.deepEqual(R(findBox(b, 'outside')), [102, 0, 20, 10], '提示框式：贴在父控件右侧外面')
    assert.deepEqual(R(findBox(b, 'pct')), [10, 25, 20, 10], '百分比偏移相对父控件')
})

test('尺寸单位：%、混合表达式、%c、%x / %y、default', () => {
    const root = new Panel().set({ name: 'root', size: [100, 50], anchor: 'top_left' })
    root.add(
        new Panel().set({ name: 'a', size: ['100% - 2px', '50%'] }),
        new Panel().set({ name: 'fit', size: ['100%c + 8px', '100%c + 6px'], children: [new Panel().set({ size: [30, 10] }), new Panel().set({ size: [12, 14] })] }),
        new Panel().set({ name: 'sq', size: ['100%y', 20] }),
        new Panel().set({ name: 'd' }))
    const b = run(root)
    assert.deepEqual(R(findBox(b, 'a')).slice(2), [98, 25])
    assert.deepEqual(R(findBox(b, 'fit')).slice(2), [38, 20], '面板 %c 取最大子控件 + 边距')
    assert.deepEqual(R(findBox(b, 'sq')).slice(2), [20, 20])
    assert.deepEqual(R(findBox(b, 'd')).slice(2), [100, 50], 'default = 100%')
})

test('stack：顺序排列、隐藏的子控件不占位、fill 平分剩余、%c 求和', () => {
    const s = new Stack().set({ name: 's', size: [40, 100], anchor: 'top_left' })
    s.add(new Panel().set({ name: 'a', size: ['100%', 10] }), new Panel().set({ name: 'hidden', size: ['100%', 30], visible: false }),
        new Panel().set({ name: 'f1', size: ['100%', 'fill'] }), new Panel().set({ name: 'f2', size: [20, 'fill'] }))
    const b = run(s)
    assert.deepEqual(R(findBox(b, 'a')), [0, 0, 40, 10])
    assert.equal(findBox(b, 'hidden'), undefined)
    assert.deepEqual(R(findBox(b, 'f1')), [0, 10, 40, 45])
    assert.deepEqual(R(findBox(b, 'f2')), [10, 55, 20, 45], '交叉方向缺省居中')
    // 真机：%c 在两个方向上都是子控件之和（交叉方向也求和）；%cm 取最大
    const fit = new Stack('horizontal').set({ name: 's', size: ['100%c', '100%c'], anchor: 'top_left', children: [new Panel().set({ size: [10, 5] }), new Panel().set({ size: [15, 8] })] })
    assert.deepEqual(R(findBox(run(fit), 's')).slice(2), [25, 13])
    const cm = new Stack('horizontal').set({ name: 's', size: ['100%c', '100%cm'], anchor: 'top_left', children: [new Panel().set({ size: [10, 5] }), new Panel().set({ size: [15, 8] })] })
    assert.deepEqual(R(findBox(run(cm), 's')).slice(2), [25, 8])
})

test('grid：格子 = 尺寸 / 行列数，按 gridPos 落格；clip 与 layer', () => {
    const g = new Grid(3, 2).set({ name: 'g', size: [90, 40], anchor: 'top_left', clip: true, layer: 2 })
    g.add(new Panel().set({ name: 'x', gridPos: [2, 1], size: ['100%', '100%'], layer: 3 }), new Panel().set({ name: 'big', gridPos: [0, 0], size: [200, 200] }))
    const b = run(g)
    assert.deepEqual(R(findBox(b, 'x')), [60, 20, 30, 20])
    assert.equal(findBox(b, 'x').z, 5, '图层相对父控件累加')
    assert.deepEqual(findBox(b, 'big').clip, { x: 0, y: 0, w: 90, h: 40 }, '子孙裁剪到网格')
})

test('keep_ratio：1×1 贴图拉伸到 116×18 会被画成居中的 18×18（真机「高亮是方块」）；关掉或九宫格才铺满', () => {
    const textures = (p) => ({ 'tex/px': { size: [1, 1] }, 'tex/border': { size: [16, 16], nineslice: 4 } })[p]
    const row = new Panel().set({ name: 'row', size: [116, 18], anchor: 'top_left' })
    row.add(new Image('tex/px').set({ name: 'dflt', size: ['100%', '100%'] }), new Image('tex/px').set({ name: 'off', size: ['100%', '100%'], keepRatio: false }),
        new Image('tex/border').set({ name: 'nine', size: ['100%', '100%'] }))
    const b = run(row, { textures })
    const d = findBox(b, 'dflt').draw
    assert.deepEqual([d.x, d.y, d.w, d.h], [49, 0, 18, 18])
    assert.deepEqual(findBox(b, 'off').draw, { x: 0, y: 0, w: 116, h: 18 })
    assert.deepEqual(findBox(b, 'nine').draw, { x: 0, y: 0, w: 116, h: 18 })
})

test('label：default 尺寸 = 文字尺寸；宽度确定时折行；中文 8、窄标点 3；字符串子元素 = Label', () => {
    const root = new Panel().set({ name: 'root', size: [100, 100], anchor: 'top_left' })
    root.add(new Label('abc').set({ name: 'a', anchor: 'top_left' }), new Label('中文中文中文').set({ name: 'w', size: [20, 'default'], anchor: 'top_left' }),
        new Label('提示，左').set({ name: 'p', anchor: 'top_left' }), '纯文字')
    const b = run(root)
    assert.deepEqual(R(findBox(b, 'a')).slice(2), [18, 10])
    assert.deepEqual(findBox(b, 'w').lines, ['中文', '中文', '中文'], '「中」6.5 +「文」8.5 = 15 ≤ 20，再加一个就超')
    assert.equal(findBox(b, 'w').rect.h, 30)
    assert.equal(findBox(b, 'p').rect.w, textWidth('提示，左'))
    assert.deepEqual(findBox(b, 'label0').lines, ['纯文字'])
})

test('动态数据：FormGate 按正文显示；按钮悬停态；FormButton 按集合项读按钮文字', () => {
    const root = new Panel().set({ name: 'root', size: [200, 100] })
    const gate = new FormGate('P1;').set({ name: 'page1' }).add(new Label('第一页').set({ name: 'hello' }))
    const fb = new FormButton(4, 'l0|', 116, 18).set({ name: 'fb' })
    fb.hover.add(new Image('x').set({ name: 'hl', keepRatio: false, size: ['100%', '100%'] }))
    fb.add(new Label(fb.payload()).set({ name: 'info' }))
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
    const { Toggle, Panel, Label, FormButton } = { ...(await import('../dist/index.js')), ...(await import('../dist/internal.js')) }
    const tip = new Label('提示')
    const t = new Toggle('g', 0).set({ name: 't' })
    t.uncheckedHover.add(tip)
    assert.throws(() => t.checkedHover.add(tip), /只能有一个父元素/)
    t.checkedHover.add(tip.clone())
    assert.notEqual(t.checkedHover.children[0], tip)
    const fb = new FormButton(1, 'a|', 10, 10)
    fb.hover.add(new Label('h'))
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
    const root = new Panel().set({ size: [40, 40], anchor: 'top_left', children: [new Image('cell').set({ name: 'c', size: [20, 20] }), new Image('border').set({ name: 'b', size: [30, 10] })] })
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
    fs.copyFileSync(new URL('../examples/cui_toggle_test/vanilla/textures/ui/cell_image.png', import.meta.url), path.join(dir, 'textures/ui/cell_image.png'))
    fs.writeFileSync(path.join(dir, 'textures/ui/cell_image.json'), '{\n  // 原版\n  "nineslice_size": 1, "base_size": [5, 5]\n}')
    const info = textureInfoFrom([path.join(dir, 'nope'), dir])
    assert.deepEqual(info('textures/ui/cell_image'), { size: [10, 10], nineslice: 1, baseSize: [5, 5] })
    assert.equal(info('textures/ui/missing'), undefined)
})

test('内边距（安全区）与越界检查：padding 编译成内层面板；contain 里越出安全区的子孙报 out-of-bounds；overflow 的跳过', async () => {
    const { compileNamespace } = await import('../dist/index.js')
    const side = new Panel().set({ name: 'side', size: [116, 160], anchor: 'top_left', padding: [3, 0, 3, 0], contain: true })
    side.add(new Image('r').set({ name: 'ruler', size: [121, 5], anchor: 'top_left' }))
    side.add(new Panel().set({ name: 'ok', size: ['100%', 10], anchor: 'top_left', offset: [0, 20] }))
    side.add(new Panel().set({ name: 'tip', size: [80, 20], anchorFrom: 'top_right', anchorTo: 'top_left', overflow: true }))
    const b = run(new Panel().set({ size: [200, 200], anchor: 'top_left', children: [side] }))
    assert.deepEqual(R(findBox(b, 'ok')), [3, 20, 110, 10], '子元素按内容面板（110 宽、左缩 3）排')
    const { json, issues } = compileNamespace('t', { root: new Panel().set({ size: [200, 200], children: [side.clone()] }) })
    const content = json.root.controls[0].side.controls[0].content
    assert.deepEqual([content.size, content.offset], [['100% - 6px', '100% - 0px'], [3, 0]])
    assert.deepEqual(issues.map((i) => `${i.rule}@${i.path.split('/').pop()}：${i.message.replace(/^.*（|）$/g, '')}`), ['out-of-bounds@ruler：右 11 像素'])
})

test('静态文字转义（真机 1.4.0 / 1.5.0）：# 与 $ 开头补 §r；% 写成 %%；语言键不转义；文字缺省 layer 1', async () => {
    const { compileNamespace, escapeText } = await import('../dist/index.js')
    assert.equal(escapeText('#$%&'), '§r#$%%&')
    assert.equal(escapeText('$abc'), '§r$abc', '$ 开头会被当成变量（日志报 Expected variable not found）')
    assert.equal(escapeText('100%'), '100%%')
    assert.equal(escapeText('a#b'), 'a#b')
    assert.equal(escapeText('menu.%s', true), 'menu.%s', '语言键不转义')
    const { json } = compileNamespace('t', { root: new Panel().set({ children: [new Label('#hash').set({ name: 'x' })] }) })
    assert.equal(json.root.controls[0].x.text, '§r#hash')
    assert.equal(json.root.controls[0].x.layer, 1, '文字缺省 layer 1（同层的图片会盖住文字）')
    const explicit = compileNamespace('t', { root: new Panel().set({ children: [new Label('a').set({ name: 'y', layer: 0 })] }) }).json
    assert.equal(explicit.root.controls[0].y.layer, 0, '显式写了的不动')
})

test('静态检查 text-overlap：同一容器里两个文字控件重叠（line_padding 让文字变高压住下面的说明——真机 1.20.0）；带动态显示条件的「二选一」不报', async () => {
    const { compileNamespace, toggleState } = await import('../dist/index.js')
    const side = new Panel().set({ name: 'side', size: [110, 140], anchor: 'top_left' })
    side.add(new Label('一\n二\n三').set({ name: 'runtime', anchor: 'top_left', offset: [0, 62] }).setLineSpacing(6))   // 高 48 → 到 110
    side.add(new Label('说明').set({ name: 'note', anchor: 'top_left', offset: [0, 106] }))
    side.add(new Label('是').set({ name: 'yes', anchor: 'top_left', visible: toggleState('t') }))
    side.add(new Label('否').set({ name: 'no', anchor: 'top_left', visible: toggleState('t').not() }))
    const { issues } = compileNamespace('t', { root: new Panel().set({ size: [200, 200], children: [side] }) })
    assert.deepEqual(issues.map((i) => `${i.rule}@${i.path.split('/').pop()}`), ['text-overlap@note'])
})

test('静态检查 text-covered：同层按材质分批、先出现的批先画（真机 1.3.0 / 1.4.0 / 1.22.0）；图片层级更高也盖住；另一个条件分支里的控件不算', async () => {
    const { compileNamespace, toggleState, Image, Anchor } = await import('../dist/index.js')
    const X = 'textures/ui/x', Y = 'textures/ui/y'
    const rule = (...items) => compileNamespace('t', { root: new Panel().setSize(200, 200).add(...items) }).issues
        .filter((i) => i.rule === 'text-covered').map((i) => `${i.path.split('/').pop()}←${i.message.match(/图片 (\S+)/)[1]}`)
    const row = (name, tex, textLayer, bgLayer = 0) => new Panel().setName(name).setSize(100, 18).setAnchor(Anchor.TOP_LEFT).add(
        new Image(tex).setName('bg').setSize(Size.full()).setLayer(bgLayer), new Label('文字').setName('txt').setLayer(textLayer))
    const title = (layer) => new Label('标题').setName('title').setAnchor(Anchor.TOP_RIGHT).setLayer(layer)
    // 1.22.0 的 A：0 层先出现底板贴图、后出现文字 → 文字在上
    assert.deepEqual(rule(row('a', X, 0)), [])
    // 1.4.0 的 V1：0 层的标题文字先出现 → 文字那一批先画，底板盖住
    assert.deepEqual(rule(title(0), row('v1', X, 0)), ['txt←v1/bg'])
    // 1.22.0 的 G：1 层的标题文字先出现，底板与字都在 1 层 → 盖住
    assert.deepEqual(rule(title(1), row('g', X, 1, 1)), ['txt←g/bg'])
    // 预测：1 层先放一张同贴图的小图（抢先出现）→ 同样的写法字在上
    assert.deepEqual(rule(new Image(X).setSize(1, 1).setLayer(1), title(1), row('t', X, 1, 1)), [])
    // 预测：0 层里另一种贴图第一次出现晚于文字 → 0 层也会盖住
    assert.deepEqual(rule(row('p', X, 0), row('q', Y, 0).setOffset(0, 20)), ['txt←q/bg'])
    // 图片层级更高 → 盖住
    assert.deepEqual(rule(new Image(X).setName('cover').setSize(50, 50).setLayer(2), new Label('被盖住').setName('under')), ['under←root/cover'])
    // 另一页（条件分支）里先出现的文字不算：乙页自己的世界里底板先出现
    const pages = [
        new Panel().setName('pA').setSize(Size.full()).setVisible(toggleState('p').not()).add(new Label('甲页').setLayer(0)),
        new Panel().setName('pB').setSize(Size.full()).setVisible(toggleState('p')).add(row('b', X, 0)),
    ]
    assert.deepEqual(rule(...pages), [])
})

test('静态检查 nineslice-too-small：九宫格图片比自己的边框还小（真机 1.23.0：1×1 的紫色九宫格画法与预览不同）', async () => {
    const { compileNamespace, Image } = await import('../dist/index.js')
    const tex = (p) => (p === 'textures/ui/purple' ? { size: [16, 16], baseSize: [16, 16], nineslice: 4 } : undefined)
    const root = new Panel().setSize(200, 200).add(
        new Image('textures/ui/purple').setName('tiny').setSize(1, 1),
        new Image('textures/ui/purple').setName('ok').setSize(8, 8),
        new Image('textures/ui/purple').setName('thin').setSize(100, 6))
    assert.deepEqual(compileNamespace('t', { root }, { textures: tex }).issues.filter((i) => i.rule === 'nineslice-too-small').map((i) => i.path.split('/').pop()), ['tiny', 'thin'])
})
