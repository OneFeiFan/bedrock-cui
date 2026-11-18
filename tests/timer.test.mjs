import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Color, Label, Panel, ProgressBar, Timer, compileNamespace, Button, Close, defineUI } from '../dist/index.js'
import { CuiApp } from '../dist/node/index.js'
import { ScreenRuntime } from '../dist/runtime/screenRuntime.js'

test('Timer：开始、暂停、继续、完成与编码（I0 / R<千分比> / P<千分比> / D1000）', () => {
    const t0 = Timer.idle(10)
    assert.equal(t0.encode(0), 'I0')
    const t1 = t0.start(1000)
    assert.equal(t1.encode(5000), 'R400')
    assert.equal(t1.remaining(5000), 6)
    const t2 = t1.pause(5000)
    assert.equal(t2.encode(99999), 'P400', '暂停后不再前进')
    const t3 = t2.resume(20000)
    assert.equal(t3.encode(21000), 'R500')
    assert.equal(t3.encode(40000), 'D1000')
    assert.ok(t3.isDone(40000) && !t3.isRunning(40000))
    assert.equal(t3.reset().encode(0), 'I0')
    assert.equal(JSON.stringify({ d: Timer.idle(3) }), '{"d":"I0"}', '写进清单时为未开始')
    assert.throws(() => Timer.idle(0), /大于 0/)
})

const lab = () => defineUI({
    id: 'cui_ui:timer',
    state() { return { cooldown: Timer.idle(10) } },
    page: ({ cooldown }) => new Panel().setSize(200, 60).add(
        new ProgressBar(cooldown).setName('bar').setSize(160, 8),
    ),
})

test('ProgressBar：参数须是默认值为计时器的数据；编译出位置绑定与尺寸动画，没有小数常数与比较运算，静态检查没有错误', () => {
    assert.throws(() => defineUI({ id: 'cui_ui:x', props: { a: { type: String } }, page: ({ a }) => new ProgressBar(a).setSize(10, 2) }).build(), /值为计时器的数据/)
    const c = CuiApp.fromConfig({ namespace: 'n', screens: [lab()] }).compile()
    assert.deepEqual(c.issues.filter((i) => i.level === 'error' || i.rule === 'decimal-arith'), [])
    const json = JSON.stringify(c.files)
    assert.ok(json.includes('#anchored_offset_value_x'))
    assert.ok(!/ (>=|<=|>|<) /.test(json.match(/"source_property_name":"[^"]*"/g).join(' ')), '没有比较运算')
    assert.ok(json.includes('"anim_type":"size"'))
    assert.equal(JSON.parse(JSON.stringify(c.screens['cui_ui:timer'])).data[0].default, 'I0', '写进 cui.generated.js 时为未开始')
})

test('运行时：计时器类型的 prop 按打开时的时刻编码', async () => {
    const screen = defineUI({
        id: 'cui_ui:timer2',
        state() { return { cooldown: Timer.idle(10).start(1000) } },
        page: ({ cooldown }) => new Panel().setSize(200, 20).add(new ProgressBar(cooldown).setSize(160, 8)),
    })
    const shown = []
    const rt = new ScreenRuntime({ show: (_, f) => { shown.push(f); return new Promise(() => { }) }, now: () => 5000 })
    rt.register(CuiApp.fromConfig({ namespace: 'n', screens: [screen] }).compile().screens)
    rt.open(screen, { id: 'p' })
    assert.equal(shown[0].buttons[0].text, '@p0|R400')
})

test('真机 1.59.0 的修正：not (not X) 编译为 X；进度条的显示条件中没有双重否定', async () => {
    const { compileExpr, lit } = await import('../dist/core/expr.js')
    const x = lit(5).eq(5)
    assert.equal(compileExpr(x.not().not()).text, compileExpr(x).text)
    const c = CuiApp.fromConfig({ namespace: 'n', screens: [defineUI({
        id: 'cui_ui:t3', state() { return { cooldown: Timer.idle(10) } },
        page: ({ cooldown }) => new Panel().setSize(200, 40).add(new ProgressBar(cooldown).setHead(Color.WHITE).setSize(160, 8)),
    })] }).compile()
    const conds = JSON.stringify(c.files).match(/"source_property_name":"[^"]*","target_property_name":"#visible"/g).join(' ')
    assert.ok(!/not \(\(not/.test(conds), '没有双重否定')
})

test('运行时：进度条走完时界面不刷新（越过右端的部分被裁剪封顶）', async () => {
    const timers = []
    const screen = defineUI({ id: 'cui_ui:t4', state() { return { cooldown: Timer.idle(2).start(1000) } }, page: ({ cooldown }) => new Panel().setSize(200, 20).add(new ProgressBar(cooldown).setSize(160, 8)) })
    const rt = new ScreenRuntime({ show: () => new Promise(() => { }), close() { }, now: () => 1000, schedule: (fn) => fn(), timeout: (fn, ticks) => { timers.push(ticks); return () => { } } })
    rt.register(CuiApp.fromConfig({ namespace: 'n', screens: [screen] }).compile().screens)
    rt.open(screen, { id: 'p' })
    assert.ok(!timers.includes(41), '没有安排计时结束时的刷新')
})

test('not 的规范化（真机 1.59.0 / 1.60.0）：双重否定消去；(not A) or (not B) → not (A and B)；混合时 not 留在左边', async () => {
    const { compileExpr, ref } = await import('../dist/core/expr.js')
    const x = ref('#x', { kind: 'global' })
    const t = (e) => compileExpr(e).text
    assert.equal(t(x.contains('R').not()), t(x.minus('R').eq(x)))
    const chain = t(x.contains('I').or(x.contains('P')).or(x.contains('D')))
    assert.ok(chain.startsWith('(not (') && !/ or /.test(chain) && chain.match(/not/g).length === 1, chain)
    assert.ok(/^\(\(not /.test(t(x.contains('a').and(x.contains('z').not()))), '混合时 not 留在左边')
})

test('ProgressBar：头由层的叠放画出，每层是静止的裁剪容器（右边界依次错开），到达右端后停住；不再有精度', async () => {
    const s = defineUI({ id: 'cui_ui:h', state() { return { t: Timer.idle(10) } }, page: ({ t }) => new Panel().setSize(220, 20).add(new ProgressBar(t).setHead(Color.WHITE, 2, 2, 4).setSize(196, 8)) })
    const { root } = s.build()
    const bar = root.children[0]
    bar._beforeFinalize()
    const layers = bar.children.filter((c) => /^layer/.test(c.name))
    assert.deepEqual(layers.map((l) => l.size.toJSON()[0]), [196, 194, 190, 188], '白（到 x）、填充（到 x − 2）、白（到 x − 6）、填充（到 x − 8）')
    assert.ok(layers.every((l) => l.props.clip))
    assert.equal(ProgressBar.prototype.setPrecision, undefined, '用裁剪封顶后不再需要精度')
})

test('Timer.of：由已有的数据构造（绑定到游戏中的对象）——进行中、暂停、未开始、完成', () => {
    const run = Timer.of({ seconds: 30, elapsed: 12, running: true, now: 100000 })
    assert.equal(run.encode(100000), 'R400')
    assert.equal(run.remaining(103000), 15, '之后照常随时间前进')
    assert.equal(Timer.of({ seconds: 30, elapsed: 12, running: false }).encode(999999), 'P400', '暂停：不随时间前进')
    assert.equal(Timer.of({ seconds: 30, elapsed: 0, running: false }).encode(0), 'I0')
    assert.equal(Timer.of({ seconds: 30, elapsed: 45, running: true, now: 0 }).encode(0), 'D1000', '超过总时长即完成')
    assert.equal(Timer.of({ seconds: 30, elapsed: 12, running: false }).resume(5000).encode(8000), 'R500', '暂停后可以继续')
})

test('运行时：传入的计时器总时长与构建时不同，提示一次（组件的速度按构建时的总时长决定）', async () => {
    const screen = defineUI({ id: 'cui_ui:t6', props: { progress: { type: Timer, default: Timer.idle(30) } }, page: ({ progress }) => new Panel().setSize(200, 20).add(new ProgressBar(progress).setSize(160, 8)) })
    const m = CuiApp.fromConfig({ namespace: 'n', screens: [screen] }).compile().screens
    assert.equal(m['cui_ui:t6'].data[0].timerSeconds, 30)
    const warns = [], warn = console.warn
    console.warn = (s) => warns.push(s)
    try {
        const rt = new ScreenRuntime({ show: () => new Promise(() => { }), now: () => 0 })
        rt.register(m)
        rt.open(screen, { id: 'p' }, { progress: Timer.of({ seconds: 60, elapsed: 10, running: true, now: 0 }) })
        rt.open(screen, { id: 'p' }, { progress: Timer.of({ seconds: 60, elapsed: 20, running: true, now: 0 }) })
    } finally { console.warn = warn }
    assert.equal(warns.filter((w) => w.includes('60 秒') && w.includes('30 秒')).length, 1)
})
