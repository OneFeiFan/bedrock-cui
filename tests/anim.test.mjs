import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Anim, Color, Image, Label, Panel, compileNamespace, defineScreen, finalize } from '../dist/index.js'

const defs = (json) => Object.fromEntries(Object.entries(json).filter(([k]) => k.startsWith('anim')))

test('Anim：任何控件都可以 setAnims()；动画链的每一段成为命名空间中的定义，用 next 串起来，控件引用第一段', () => {
    const chain = Anim.alpha(0, 0, 2).then(Anim.alpha(1, 1, 1)).then(Anim.alpha(0, 0, 0.05).setEasing('out_quad'))
    const root = new Panel().setSize(100, 40).add(new Label('5').setName('five').setAnims(chain), new Panel().setName('bar').setSize(100, 6).setAnims(Anim.size([100, 6], [0, 6], 5)))
    const r = compileNamespace('t', { root })
    const json = r.json ?? r
    const d = defs(json)
    assert.deepEqual(d.anim0, { anim_type: 'alpha', duration: 2, easing: 'linear', from: 0, to: 0, next: '@t.anim1' })
    assert.deepEqual(d.anim1, { anim_type: 'alpha', duration: 1, easing: 'linear', from: 1, to: 1, next: '@t.anim2' })
    assert.deepEqual(d.anim2, { anim_type: 'alpha', duration: 0.05, easing: 'out_quad', from: 0, to: 0 })
    assert.deepEqual(d.anim3, { anim_type: 'size', duration: 5, easing: 'linear', from: [100, 6], to: [0, 6] })
    const text = JSON.stringify(json)
    assert.ok(text.includes('"anims":["@t.anim0"]') && text.includes('"anims":["@t.anim3"]'))
    assert.deepEqual(r.issues.filter((i) => i.level === 'error'), [])
})

test('Anim：loop() 让最后一段指回第一段；wait 只写类型与时长；color 写 0–1 的 RGB；同一个 Anim 用在两个控件上只生成一次', () => {
    const breathe = Anim.alpha(1, 0.2, 1).then(Anim.alpha(0.2, 1, 1)).loop()
    const glow = Anim.wait(0.5).then(Anim.color(Color.WHITE, Color.hex('#ff0000'), 1))
    const root = new Panel().setSize(100, 40).add(new Label('a').setAnims(breathe), new Label('b').setAnims(breathe), new Label('c').setAnims(glow))
    const d = defs(compileNamespace('t', { root }).json)
    assert.equal(d.anim1.next, '@t.anim0', '循环')
    assert.equal(Object.keys(d).length, 4, 'breathe 两段 + glow 两段')
    assert.deepEqual(d.anim2, { anim_type: 'wait', duration: 0.5, next: '@t.anim3' })
    assert.deepEqual(d.anim3.to, [1, 0, 0])
    assert.throws(() => breathe.then(Anim.wait(1)), /循环/)
    assert.throws(() => Anim.alpha(0, 1, -1), /非负/)
})

test('Anim 与 prop 一起用：循环的动画链不影响快照时查找 prop（不会无限递归）', () => {
    const s = defineScreen({ id: 'cui_ui:a', props: { t: '' }, view: ({ props }) => new Panel().setSize(100, 20).add(new Label(props.t).setSize(50, 10).setAnims(Anim.alpha(1, 0, 1).loop())) })
    const [r] = finalize(s.build().root)
    assert.equal(r.children[0].type, 'collection_item')
    assert.equal(r.children[0].children[0].props.anims.length, 1, '动画留在控件本身（容器里）')
})

test('Anim.clip：裁剪比例的动画（sapdon 指导书的进度箭头与火焰用它循环播放）', () => {
    const arrow = new Image('textures/ui/arrow_active').setSize(22, 15).setClipRatio('left', 1).setAnims(Anim.clip(1, 0, 3).loop())
    const d = defs(compileNamespace('t', { root: new Panel().setSize(100, 40).add(arrow) }).json)
    assert.deepEqual(d.anim0, { anim_type: 'clip', duration: 3, easing: 'linear', from: 1, to: 0, next: '@t.anim0' })
})

test('数值绑定：prop 转数字后绑定到裁剪比例；setOffset(表达式, y) 编译为 use_anchored_offset 与 #anchored_offset_value_x 的绑定', async () => {
    const { lit } = await import('../dist/core/expr.js')
    const s = defineScreen({
        id: 'cui_ui:num', props: { p: '0' },
        view({ props }) {
            return new Panel().setSize(160, 20).add(
                new Image('textures/ui/white').setName('done').setSize(160, 8).setClipRatio('right', lit(1).minus(props.p.number.times(0.001))),
                new Panel().setName('mover').setSize(160, 8).setOffset(props.p.number.times(0.16), 10),
            )
        },
    })
    const json = JSON.stringify(compileNamespace('t', { root: s.build().root }).json)
    assert.ok(json.includes('"target_property_name":"#clip_ratio"'), '裁剪比例绑定')
    assert.ok(json.includes('* 1'), '文字乘以 1 转为数字')
    assert.ok(json.includes('"use_anchored_offset":true'))
    assert.ok(json.includes('"#anchored_offset_value_x":0') && json.includes('"#anchored_offset_value_y":0'), '纵坐标 10 已移到读取按钮的容器上')
    assert.ok(json.includes('"target_property_name":"#anchored_offset_value_x"'))
    assert.throws(() => new Panel().setOffset(props0(), '50%'), /像素/)
    function props0() { return lit(1) }
})

test('常量表达式：不引用任何数据时编译为固定值，不生成绑定（游戏不接受来源只有常数的绑定，真机 1.49.0）', async () => {
    const { lit } = await import('../dist/core/expr.js')
    const root = new Panel().setSize(100, 40).add(
        new Panel().setName('a').setSize(8, 8).setOffset(lit(40), 2),
        new Image('textures/ui/white').setName('b').setSize(50, 8).setClipRatio('right', lit(600).div(1000)),
        new Label('x').setName('c').setVisible(lit(1).eq(1)),
    )
    const text = JSON.stringify(compileNamespace('t', { root }).json)
    assert.ok(!text.includes('target_property_name'), '没有绑定')
    assert.ok(text.includes('"offset":[40,2]') && text.includes('"clip_ratio":0.6') && text.includes('"visible":true'))
})

test('Texture.SOLID：内置纯白贴图——界面用到时编译结果附带 2×2 的纯白 PNG，没用到时不附带', async () => {
    const { Texture } = await import('../dist/index.js')
    const { CuiApp } = await import('../dist/node/index.js')
    const used = CuiApp.fromConfig({ namespace: 'n', screens: { 'cui_ui:a': () => new Panel().setSize(10, 10).add(new Image(Texture.SOLID).setSize(10, 10)) } }).compile()
    const png = used.glyphs.find(([f]) => f === 'textures/bedrock_cui/solid.png')
    assert.ok(png, '附带纯白贴图')
    assert.deepEqual([...png[1].slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG 文件头')
    const unused = CuiApp.fromConfig({ namespace: 'n', screens: { 'cui_ui:b': () => new Panel().setSize(10, 10).add(new Label('x')) } }).compile()
    assert.ok(!unused.glyphs.some(([f]) => f.includes('bedrock_cui/solid')))
})

test('静态检查：带动画的文字叠放不报 text-overlap；绑定运算中的小数常数报 decimal-arith', async () => {
    const { CuiApp } = await import('../dist/node/index.js')
    const s = defineScreen({
        id: 'cui_ui:d', props: { p: '0' },
        view: ({ props }) => new Panel().setSize(200, 40).add(
            new Panel().setSize(1, 8).setOffset(props.p.number.times(0.16), 0),
            new Panel().setSize(1, 8).setOffset(props.p.number.times(160).div(1000), 10),
            new Label('5').setAnims(Anim.alpha(1, 0, 1)), new Label('4').setAnims(Anim.alpha(0, 1, 1)),
        ),
    })
    const rules = CuiApp.fromConfig({ namespace: 'n', screens: [s] }).compile().issues.map((i) => i.rule)
    assert.deepEqual(rules.filter((r) => r === 'decimal-arith').length, 1, '只有 × 0.16 那一处')
    assert.ok(!rules.includes('text-overlap'))
})

test('sampleAnims：动画链在某一时刻的值——播完的段取结束值、wait 保持、循环取模、整条链播完后保持最后的状态', async () => {
    const { sampleAnims } = await import('../dist/core/anim.js')
    const digit = Anim.alpha(0, 0, 2).then(Anim.alpha(1, 1, 1)).then(Anim.alpha(0, 0, 0.05))
    assert.deepEqual([0.5, 2.5, 3.5].map((t) => sampleAnims([digit], t).alpha), [0, 1, 0])
    const breathe = Anim.alpha(1, 0.2, 1).then(Anim.alpha(0.2, 1, 1)).loop()
    assert.deepEqual([0, 1, 2, 3].map((t) => +sampleAnims([breathe], t).alpha.toFixed(2)), [1, 0.2, 1, 0.2])
    assert.equal(sampleAnims([Anim.wait(1).then(Anim.alpha(0, 1, 1))], 0.5), undefined, 'wait 期间不改变')
    assert.deepEqual(sampleAnims([Anim.size([0, 8], [160, 8], 10)], 5).size, [80, 8])
    assert.equal(sampleAnims([Anim.clip(1, 0, 3)], 9).clipRatio, 0, '播完后保持结束值')
    assert.equal(sampleAnims(['@ns.x'], 1), undefined, '字符串引用不播放')
})

test('比较运算：>= 与 <= 编译为 not < 与 not >（真机 1.56.0：>= 放在 and 中时结果错误）', async () => {
    const { compileExpr, lit } = await import('../dist/core/expr.js')
    const n = lit(5)
    assert.equal(compileExpr(n.gte(0).and(n.lt(10))).text, '((not (5 < 0)) and (5 < 10))')
    assert.equal(compileExpr(n.lte(4)).text, '(not (5 > 4))')
    assert.ok(!/>=|<=/.test(compileExpr(n.gte(1).or(n.lte(2))).text))
})

test('Texture.SOLID：未指定 setKeepRatio() 时拉伸铺满（编译为 keep_ratio: false）；指定了则按指定', async () => {
    const { Texture } = await import('../dist/index.js')
    const root = new Panel().setSize(200, 40).add(
        new Image(Texture.SOLID).setName('a').setSize(200, 24),
        new Image(Texture.SOLID).setName('b').setSize(200, 24).setKeepRatio(true),
    )
    const json = JSON.stringify(compileNamespace('t', { root }).json)
    assert.match(json, /"a@?[^"]*":\{[^}]*"keep_ratio":false/)
    assert.match(json, /"b@?[^"]*":\{[^}]*"keep_ratio":true/)
})
