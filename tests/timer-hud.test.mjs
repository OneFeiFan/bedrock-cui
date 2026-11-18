import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Anchor, EventProgressBar, Label, Panel, Timer, defineTimerHud, evalExpr, lit } from '../dist/index.js'
import { encodeTimerFrame, timerFrameCodec } from '../dist/core/timerFrame.js'
import { TimerHudRuntime } from 'bedrock-cui/runtime/timer-core'
import { CuiApp } from '../dist/node/index.js'

const hudOf = (id = 'cooldowns', extra = {}) => defineTimerHud({ id,
    timers: { a: Timer.idle(10), b: Timer.idle(20), c: Timer.idle(30) },
    view: (t) => new Panel().setSize(220, 80).add(...Object.values(t).map((r, i) =>
        new EventProgressBar(r).setAnchor(Anchor.TOP_LEFT).setOffset(10, 10 + i * 20))), ...extra })
function setup(hud = hudOf()) {
    let now = 0, serial = 0
    const sent = [], bars = [], subtitles = [], errors = [], jobs = new Map(), built = hud.build('test_timers')
    const runtime = new TimerHudRuntime({ now: () => now,
        title: (p, text, options) => sent.push({ player: p.id, text, options, now }),
        actionbar: (p, text) => bars.push({ player: p.id, text }),
        subtitle: (p, text) => subtitles.push({ player: p.id, text, now }),
        error: (message, error) => errors.push({ message, error }),
        schedule(fn, ticks) { const id = ++serial; jobs.set(id, { fn, at: now + ticks * 50 }); return () => jobs.delete(id) },
    })
    runtime.register({ [hud.id]: built.manifest })
    const advance = (target) => {
        for (;;) {
            const next = [...jobs].filter(([, j]) => j.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
            if (!next) break
            now = next[1].at; jobs.delete(next[0]); next[1].fn()
        }
        now = target
    }
    return { runtime, hud, built, sent, bars, subtitles, jobs, errors, advance, setNow: (n) => { now = n } }
}
const player = { id: 'p1' }

test('actionbar 同屏：小数时长按 V22 取整，中央标题与字幕事件不重建动画', () => {
    const hud = hudOf('dual', { transport: 'actionbar' })
    const f = setup(hud)
    const { prefix, steps } = f.built.manifest
    f.runtime.open(hud, player, Object.fromEntries(Object.entries(hud.options.timers).map(([name, timer]) => [name, timer.start(0)])))
    f.advance(50)
    assert.equal(steps, 800)
    assert.equal(f.bars.length, 1)
    f.advance(1120)
    f.runtime.title(player, '任务完成', { subtitle: '正在结算' })
    assert.equal(f.runtime.updateSubtitle(player, '奖励到账'), true)
    assert.equal(f.sent.length, 1)
    assert.equal(f.subtitles.length, 1)
    assert.equal(f.bars.length, 1)

    f.runtime.update(hud, player, { b: hud.options.timers.b.start(0).pause(1120) })
    f.advance(1170)
    const positionsEnd = prefix.length + 15
    assert.equal(f.bars.length, 2, '暂停快照在标题期间照常发送')
    assert.equal(f.bars[1].text.slice(positionsEnd), 'x0000000180y0000000020z0000000580n0000000000')
    assert.equal(f.runtime.clearTitle(player), true)
    f.advance(1220)
    assert.equal(f.bars.length, 2, '清除中央标题不重发计时数据')

    f.runtime.title(player, { translate: 'example.notice' }, { policy: 'actionbar' })
    f.advance(1270)
    assert.deepEqual(f.bars[2].text.rawtext[1], { translate: 'example.notice' })
    assert.ok(f.bars[2].text.rawtext[0].text.endsWith('n0000000059'))
    f.advance(4220)
    assert.equal(f.bars.length, 4, '提示出现和到期各发一次快照')
    assert.ok(f.bars[3].text.endsWith('n0000000000'))
    f.runtime.open(hud, player)
    f.runtime.close(hud, player)
    assert.equal(f.bars.length, 5)
    assert.equal(f.bars[4].text, '', '重新打开后立即关闭仍清理上次已显示的 actionbar')
    assert.deepEqual(f.errors, [])
})

test('actionbar 编译：使用输入副本和内联时长，普通提示保留原版模板', () => {
    const hud = hudOf('router', { transport: 'actionbar' })
    const compiled = CuiApp.fromConfig({ namespace: 'dual', screens: [], timerHuds: [hud] }).compile()
    const manifest = compiled.timerHuds.router
    const ui = compiled.files['ui/dual_timers.json']
    const start = manifest.prefix.length + 15
    assert.equal(ui.actionbar_router.$cui_actionbar_input, '$actionbar_text')
    assert.equal(ui.actionbar_instance_router.$cui_actionbar_input, '$actionbar_text')
    assert.deepEqual(ui.actionbar_router.controls[1].view_router.controls, [{ 'instance@dual_timers.actionbar_instance_router': {} }])
    assert.equal(ui.cui_router_0_grow.duration,
        `((0.0 + (0 + ((('%.${start + 11}s' * $cui_actionbar_input) - ('%.${start}s' * $cui_actionbar_input)) - 'x'))) / 20.0)`)
    assert.deepEqual(ui.actionbar_router.controls[0]['normal_actionbar@hud.hud_actionbar_text'], {
        ignored: "(('%.14s' * $cui_actionbar_input) = 'cui.timers|v4|')",
    })
})

function decodedEnvironment(refs, payload, exact = false) {
    const controls = new Map()
    for (const ref of Object.values(refs)) {
        const decoder = ref._decoder(), properties = { ...decoder.initial }
        for (const stage of decoder.stages) {
            properties[stage.target] = evalExpr(stage.value, { exact,
                ref: (name) => stage.source ? payload : properties[name] })
        }
        controls.set(decoder.name, properties)
    }
    return { exact, ref: (name, source) => controls.get(source.control)?.[name] }
}

test('计时快照：独立短字段不依赖大整数取余，重复进度不被字符串减法误删', () => {
    let refs
    const hud = hudOf('packet', { view: (t) => { refs = t; return new Panel() } })
    const { manifest } = hud.build('packet_timers')
    const positions = [0, 1, 39, 40, 99]
    for (const a of positions) for (const b of positions) for (const c of positions) {
        const timers = { a: Timer.of({ seconds: 100, elapsed: a, running: true, now: 100000 }),
            b: Timer.of({ seconds: 100, elapsed: b, running: false, now: 100000 }),
            c: Timer.of({ seconds: 100, elapsed: c, running: true, now: 100000 }) }
        const frame = encodeTimerFrame(manifest, timers, 100000), env = decodedEnvironment(refs, frame.payload)
        assert.deepEqual(Object.values(refs).map((r) => evalExpr(r.percent, env)), [a, b, c])
        assert.deepEqual(Object.values(refs).map((r) => evalExpr(r.running, env)), [true, false, true])
        assert.deepEqual(frame.options, { fadeInDuration: (100 - a) * 20, stayDuration: 1, fadeOutDuration: (100 - c) * 20 })
    }
    const codec = timerFrameCodec(manifest)
    assert.equal(codec.encode({ a: 126, b: 25, c: 126 }), 'aR025bP025cR025')
    assert.deepEqual(codec.decode('aR025bP025cR025'), { a: 126, b: 25, c: 126 })
    const frame = encodeTimerFrame(manifest, { a: Timer.idle(1).start(0), b: Timer.idle(1).start(0), c: Timer.idle(1).start(0) }, 250)
    for (const exact of [false, true]) {
        assert.deepEqual(Object.values(refs).map((r) => evalExpr(r.percent, decodedEnvironment(refs, frame.payload, exact))), [25, 25, 25])
        assert.deepEqual(Object.values(refs).map((r) => evalExpr(r.running, decodedEnvironment(refs, frame.payload, exact))), [true, true, true])
    }
    assert.throws(() => hudOf('too_many', { timers: { a: Timer.idle(1), b: Timer.idle(1), c: Timer.idle(1), d: Timer.idle(1) } }), /1～3/)
    assert.throws(() => hudOf('too_precise', { steps: 10001 }), /10000/)
})

test('V13 越界回归：生成的两段尺寸表达式相加为 200，aP100 的运行标记为 false', () => {
    let refs
    const hud = hudOf('bounds', { view(t) { refs = t; return new Panel().add(...Object.values(t).map((r) => new EventProgressBar(r).setSize(200, 8))) } })
    const compiled = CuiApp.fromConfig({ namespace: 'bounds', screens: [], timerHuds: [hud] }).compile()
    const manifest = compiled.timerHuds.bounds, ui = compiled.files['ui/bounds_timers.json']
    const env = decodedEnvironment(refs, manifest.prefix + 'aP100bR066cR062')
    assert.deepEqual(Object.values(refs).map((r) => evalExpr(r.running, env)), [false, true, true])
    const receiverProperties = new Map(), sizes = new Map(), bindingSources = []
    function walk(node) {
        if (!node || typeof node !== 'object') return
        for (const control of node.controls ?? []) for (const [name, child] of Object.entries(control)) {
            if (child.property_bag) receiverProperties.set(name, child.property_bag)
        }
        for (const binding of node.bindings ?? []) {
            const source = binding.source_control_name
            if (source?.startsWith(manifest.receiver)) bindingSources.push(binding)
            if (binding.target_property_name === '#size_binding_x') {
                const code = binding.source_property_name.replaceAll('#cui_position', String(env.ref('#cui_position', { control: source })))
                assert.match(code, /^[0-9 ()+*/.-]+$/, '尺寸运算不得再包含格式化字符串')
                const values = sizes.get(source) ?? []
                values.push(Function(`return ${code}`)())
                sizes.set(source, values)
            }
        }
        for (const value of Object.values(node)) if (value && typeof value === 'object') {
            if (Array.isArray(value)) value.forEach(walk)
            else walk(value)
        }
    }
    walk(ui)
    assert.deepEqual([...sizes.values()], [[200, 0], [132, 68], [124, 76]])
    for (const binding of bindingSources) {
        const source = receiverProperties.get(binding.source_control_name)
        assert.ok(source, `不存在的接收器：${binding.source_control_name}`)
        for (const property of binding.source_property_name.match(/#cui_\w+/g) ?? []) {
            assert.ok(Object.hasOwn(source, property), `${binding.source_control_name} 未声明 ${property}`)
        }
    }
})

test('V14 回跳回归：本次快照在动画工厂内初始化，不依赖常驻的可见性缓存', () => {
    const compiled = CuiApp.fromConfig({ namespace: 'snapshot', screens: [], timerHuds: [hudOf()] }).compile()
    const manifest = compiled.timerHuds.cooldowns, ui = compiled.files['ui/snapshot_timers.json']
    const persistent = JSON.stringify(ui.overlay_root)
    assert.ok(!persistent.includes(manifest.receiver), '常驻树不能继续持有跨标题事件的快照')
    const receiver = ui.title_router.controls.find((c) => c[manifest.receiver])?.[manifest.receiver]
    assert.ok(receiver, '接收器与动画由同一原生工厂创建')
    assert.deepEqual(receiver.bindings, [{ binding_name: '#hud_title_text_string', binding_name_override: '#cui_retained', binding_type: 'global' }])
    assert.ok(!JSON.stringify(ui).includes('visibility_changed'))
    for (let slot = 0; slot < 3; slot++) {
        const name = `${manifest.receiver}_${slot}`
        const decoder = ui.title_router.controls.find((c) => c[name])?.[name]
        assert.ok(decoder)
        assert.equal(decoder.bindings[0].source_control_name, manifest.receiver)
        assert.ok(decoder.bindings.every((b) => b.binding_condition === undefined), '解码在实例初始化时求值')
    }
})

test('定长计时协议：不同精度的边界、运行位、缺字段和损坏帧', () => {
    for (const steps of [1, 9, 10, 100, 1000, 10000]) {
        const codec = timerFrameCodec({ prefix: 'test|', names: ['a', 'b', 'c'], steps })
        const digits = [0, steps, steps + 1, steps * 2 + 1]
        for (const a of digits) for (const b of digits) for (const c of digits) {
            assert.deepEqual(codec.decode(codec.encode({ a, b, c })), { a, b, c })
        }
        assert.throws(() => codec.encode({ a: 0, b: 0 }))
        assert.throws(() => codec.encode({ a: -1, b: 0, c: 0 }))
        assert.throws(() => codec.encode({ a: 0, b: 0, c: 0, d: 0 }))
        const data = codec.encode({ a: steps, b: 0, c: steps })
        for (const bad of [data.slice(1), data + '0', data.replace('bP', 'aP'), data.replace('aP', 'aX')]) assert.throws(() => codec.decode(bad))
    }
    assert.throws(() => timerFrameCodec({ prefix: 't|', names: ['a'], steps: 100 }).decode('aP999'))
})

test('字符串格式预览：按 UTF-8 字节截取，不切断字符，数值乘法保持原行为', () => {
    const env = { ref: () => '' }
    assert.equal(evalExpr(lit('%.5s').times('aR025bR025'), env), 'aR025')
    assert.equal(evalExpr(lit('%.4s').times('A中文'), env), 'A中')
    assert.equal(evalExpr(lit('%.3s').times('A中文'), env), 'A')
    assert.equal(evalExpr(lit('%.4s').times('😀B'), env), '😀')
    assert.equal(evalExpr(lit('12').times(3), env), 36)
})

test('多计时器：暂停 B 只改变 B 的计时锚点，A/C 从当前值与各自剩余时长重建', () => {
    const f = setup(), { runtime, hud, built } = f
    let a = Timer.idle(10).start(0), b = Timer.idle(20).start(0), c = Timer.idle(30).start(0)
    runtime.open(hud, player, { a, b, c }); runtime.tick()
    assert.equal(f.sent.length, 1)
    f.setNow(3000); b = b.pause(3000)
    runtime.update(hud, player, { b }); runtime.tick()
    assert.deepEqual(f.sent.at(-1).options, { fadeInDuration: 140, stayDuration: 1, fadeOutDuration: 540, subtitle: '' })
    const digits = timerFrameCodec(built.manifest).decode(f.sent.at(-1).text.slice(built.manifest.prefix.length))
    assert.deepEqual(digits, { a: 131, b: 15, c: 111 })
    f.setNow(8000); b = b.resume(8000)
    runtime.update(hud, player, { b }); runtime.tick()
    assert.deepEqual(f.sent.at(-1).options, { fadeInDuration: 40, stayDuration: 340, fadeOutDuration: 440, subtitle: '' })
    const count = f.sent.length
    f.setNow(8500); runtime.tick()
    assert.equal(f.sent.length, count, '没有状态事件时不发连续进度')
    f.advance(10000)
    assert.equal(f.sent.at(-1).options.fadeInDuration, 1, '只在 A 完成时统一重新取样')
})

test('标题 actionbar：普通提示不写计时标题通道，原始翻译消息与副标题保留', () => {
    const f = setup(), { runtime, hud } = f
    runtime.open(hud, player, { a: Timer.idle(10).start(0) }); runtime.tick()
    runtime.title(player, { translate: 'test.done' }, { subtitle: '下一关' })
    assert.equal(f.sent.length, 1)
    assert.deepEqual(f.bars[0].text, { rawtext: [{ translate: 'test.done' }, { text: ' — ' }, { text: '下一关' }] })
    assert.equal(runtime.isOpen(hud, player), true)
})

test('标题优先：期间合并更新但实际计时继续，标题到期自动恢复完整最新快照', () => {
    const f = setup(), { runtime, hud, built } = f
    runtime.open(hud, player, { a: Timer.idle(10).start(0), b: Timer.idle(20).start(0) }); runtime.tick()
    f.setNow(1000)
    runtime.title(player, '任务完成', { policy: 'priority', fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 0 })
    f.setNow(2000)
    runtime.update(hud, player, { b: Timer.of({ seconds: 20, elapsed: 5, running: false }) }); runtime.tick()
    assert.equal(f.sent.length, 2, '标题展示期间不抢占通道')
    f.advance(3050)
    assert.equal(f.sent.length, 3)
    assert.ok(f.sent[2].text.startsWith(built.manifest.prefix))
    assert.deepEqual(f.sent[2].options, { fadeInDuration: 139, stayDuration: 1, fadeOutDuration: 1, subtitle: '' })
    const digits = timerFrameCodec(built.manifest).decode(f.sent[2].text.slice(built.manifest.prefix.length))
    assert.equal(digits.a, 131)
    assert.equal(digits.b, 25)
})

test('中央标题队列：依次显示，单独更新字幕不重播，整个队列结束只恢复一次最新进度', () => {
    const f = setup(), { runtime, hud } = f
    runtime.open(hud, player, { a: Timer.idle(10).start(0) }); runtime.tick()
    const options = { policy: 'priority', fadeInDuration: 2, stayDuration: 4, fadeOutDuration: 2 }
    const message = { translate: 'test.reward', with: ['100'] }
    runtime.title(player, '第一条', { ...options, subtitle: '旧字幕' })
    runtime.title(player, message, options)
    message.with[0] = '999'
    f.advance(200)
    assert.equal(runtime.updateSubtitle(player, { translate: 'test.updated' }), true)
    assert.equal(f.sent.length, 2, '字幕更新不重新发送主标题或计时器')
    assert.deepEqual(f.subtitles[0].text, { translate: 'test.updated' })
    runtime.update(hud, player, { b: Timer.of({ seconds: 20, elapsed: 5, running: false }) })
    f.advance(450)
    assert.deepEqual(f.sent.map((x) => x.text).slice(1), ['第一条', { translate: 'test.reward', with: ['100'] }])
    assert.equal(f.sent[2].now, 450, '更新字幕没有延长标题时间')
    assert.equal(f.sent[2].options.subtitle, '', '第二条没有字幕时清理上一条字幕')
    f.advance(900)
    const last = f.sent.at(-1)
    assert.equal(f.sent.length, 4, '两条标题之间不闪回 HUD，末尾只发一个快照')
    assert.equal(last.now, 900)
    assert.ok(last.text.startsWith(f.built.manifest.prefix))
    assert.equal(last.options.subtitle, '')
    assert.equal(last.options.fadeInDuration, 182, '计时器在标题期间实际继续推进')
    assert.equal(runtime.updateSubtitle(player, '不应显示'), false)
})

test('中央标题替换与取消：紧急标题丢弃待显示消息，清除直接恢复 HUD，不误清外部标题', () => {
    const f = setup(), { runtime, hud } = f
    runtime.open(hud, player); runtime.tick()
    const options = { policy: 'priority', fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 0 }
    runtime.title(player, '正在显示', options)
    runtime.title(player, '等待显示', options)
    runtime.title(player, '紧急消息', { ...options, mode: 'replace' })
    runtime.title(player, '也需取消', options)
    assert.equal(f.sent.at(-1).text, '紧急消息')
    assert.equal(runtime.clearTitle(player), true)
    assert.equal(runtime.clearTitle(player), false)
    f.advance(50)
    assert.ok(f.sent.at(-1).text.startsWith(f.built.manifest.prefix))
    assert.equal(f.sent.length, 4, '取消时没有额外的空标题')
    f.advance(10000)
    assert.equal(f.sent.length, 4, '已取消的队列不会重新出现')
    assert.equal(f.jobs.size, 0)
    assert.equal(runtime.clearTitle({ id: 'outside' }), false)
    assert.equal(f.sent.length, 4)
})

test('中央标题排队边界：容量与非法参数不改变队列，延迟唤醒仍给每条完整显示时间', () => {
    const f = setup(), { runtime } = f
    const options = { policy: 'priority', fadeInDuration: 0, stayDuration: 0, fadeOutDuration: 0 }
    runtime.title(player, '0', options)
    for (let i = 1; i <= 8; i++) runtime.title(player, String(i), options)
    assert.throws(() => runtime.title(player, 'overflow', options), /最多等待 8/)
    assert.throws(() => runtime.title(player, 'bad', { ...options, stayDuration: -1, mode: 'replace' }), /时长/)
    assert.throws(() => runtime.title(player, 'bad', { ...options, mode: 'invalid' }), /排队方式/)
    f.setNow(1000); runtime.tick()
    assert.deepEqual(f.sent.map((x) => x.text), ['0', '1'], '卡顿后不在同一 tick 播完所有标题')
    f.advance(1400)
    assert.deepEqual(f.sent.map((x) => x.text), Array.from({ length: 9 }, (_, i) => String(i)))
    assert.equal(f.jobs.size, 0)
    assert.equal(runtime.updateSubtitle(player, 'expired'), false)
})

test('中央标题失败与离开：队列发送失败有界重试，恢复 HUD；离开直接丢弃队列', () => {
    const f = setup(), { runtime, hud } = f
    runtime.open(hud, player); runtime.tick()
    const options = { policy: 'priority', fadeInDuration: 0, stayDuration: 0, fadeOutDuration: 0 }
    runtime.title(player, '当前', options)
    runtime.title(player, '失败', options)
    const send = runtime.platform.title
    runtime.platform.title = (p, text, options) => { if (text === '失败') throw Error('temporary'); send(p, text, options) }
    f.advance(150)
    assert.equal(f.errors.length, 3)
    assert.ok(f.sent.at(-1).text.startsWith(f.built.manifest.prefix))
    assert.equal(f.jobs.size, 0)
    runtime.title(player, '新标题', options)
    runtime.title(player, '不该发送', options)
    const count = f.sent.length
    runtime.remove(player.id)
    f.advance(1000)
    assert.equal(f.sent.length, count)
    assert.equal(f.jobs.size, 0)
})

test('生命周期：关闭不清除正显示的普通标题，旧 HUD 不能关闭新 HUD，玩家离开不调用失效 API', () => {
    const f = setup(), other = hudOf('other')
    f.runtime.register({ other: other.build('test_timers').manifest })
    f.runtime.open(f.hud, player); f.runtime.tick()
    f.runtime.open(other, player); f.runtime.close(f.hud, player)
    assert.equal(f.runtime.isOpen(other, player), true)
    f.runtime.title(player, '仍需显示', { policy: 'priority', stayDuration: 40 })
    const count = f.sent.length
    f.runtime.close(other, player)
    assert.equal(f.sent.length, count)
    f.runtime.remove(player.id)
    assert.equal(f.sent.length, count)
    assert.equal(f.jobs.size, 0)
})

test('事件调度：多个更新合并，空闲/暂停 HUD 没有轮询定时器；坏更新不污染状态', () => {
    const f = setup(), { runtime, hud } = f
    runtime.open(hud, player)
    runtime.update(hud, player, { a: Timer.of({ seconds: 10, elapsed: 2, running: false }) })
    runtime.update(hud, player, { b: Timer.of({ seconds: 20, elapsed: 4, running: false }) })
    assert.equal(f.jobs.size, 1)
    f.advance(50)
    assert.equal(f.sent.length, 1)
    assert.equal(f.jobs.size, 0)
    assert.throws(() => runtime.update(hud, player, { missing: Timer.idle(1) }), /未声明/)
    f.advance(50000)
    assert.equal(f.sent.length, 1)
})

test('框架编译：生成三种时钟、原版标题分支与独立 actionbar；没有隐藏标题销毁整个 HUD 的事件', () => {
    const hud = hudOf(), c = CuiApp.fromConfig({ namespace: 'public_api', screens: [], timerHuds: [hud] }).compile()
    assert.deepEqual(c.issues.filter((i) => i.level === 'error'), [])
    const ui = c.files['ui/public_api_timers.json'], json = JSON.stringify(ui)
    for (const clock of ['$title_fade_in_time', '$title_stay_time', '$title_fade_out_time']) assert.ok(json.includes(clock))
    assert.ok(json.includes('normal_title@hud.hud_title_text'))
    assert.ok(!json.includes('hud_title_text_complete'))
    assert.ok(!json.includes('"destroy_at_end":"hud_title_text"'))
    assert.equal(c.files['ui/hud_screen.json']['root_panel/hud_actionbar_text_area'].ignored, true)
    assert.ok(json.includes('hud_actionbar_text_factory'))
    assert.deepEqual(CuiApp.fromConfig({ namespace: 'public_api', screens: [], timerHuds: [hud] }).compile().files, c.files)
})

test('构建登记：计时 HUD 自动生成运行时登记模块、资源定义与公开类型', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-hud-build-')), hooks = [], defs = []
    try {
        const app = CuiApp.fromConfig({ namespace: 'public_api', screens: [], timerHuds: [hudOf()] })
        app.useSapdon({ GRegistry: { register() {}, beforeSubmit(fn) { hooks.push(fn) } }, UISystemRegistry: { addOuterUIdefs(d) { defs.push(...d) } } }, { scriptsDir: dir, resDir: path.join(dir, 'res') })
        hooks[0]([])
        assert.match(fs.readFileSync(path.join(dir, 'cui.generated.js'), 'utf8'), /registerTimerHuds\(timerHuds\)/)
        assert.match(fs.readFileSync(path.join(dir, 'cui.generated.d.ts'), 'utf8'), /TimerHudManifest/)
        assert.ok(defs.includes('ui/hud_screen.json'))
        assert.throws(() => app.addTimerHud(hudOf()).compile(), /重复/)
    } finally {
        assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()))
        assert.ok(path.basename(dir).startsWith('cui-hud-build-'))
        fs.rmSync(dir, { recursive: true, force: true })
    }
})

test('玩家隔离：一名玩家的标题租约与更新不抢占另一名玩家的计时通道', () => {
    const f = setup(), p2 = { id: 'p2' }
    f.runtime.open(f.hud, player, { a: Timer.idle(10).start(0) })
    f.runtime.open(f.hud, p2, { a: Timer.idle(10).start(0) })
    f.runtime.tick()
    f.setNow(1000)
    f.runtime.title(player, 'p1 only', { policy: 'priority', stayDuration: 100 })
    f.runtime.update(f.hud, p2, { a: Timer.of({ seconds: 10, elapsed: 5, running: false }) })
    f.runtime.tick()
    assert.equal(f.sent.at(-1).player, 'p2')
    assert.ok(f.sent.at(-1).text.startsWith(f.built.manifest.prefix))
    assert.equal(f.sent.filter((s) => s.player === 'p1').length, 2)
    f.runtime.remove(player.id)
    assert.equal(f.runtime.isOpen(f.hud, p2), true)
})

test('完整快照失败可重试；重生请求发送当前值，连续 API 失败会清理而非永久轮询', () => {
    const hud = hudOf(), manifest = hud.build('retry_timers').manifest
    let now = 0, failed = true
    const sent = [], errors = []
    const runtime = new TimerHudRuntime({ now: () => now, title(p, text) { if (failed) throw Error('temporary'); sent.push({ player: p, text }) }, actionbar() {}, error: (_, e) => errors.push(e) })
    runtime.register({ [hud.id]: manifest })
    runtime.open(hud, player, { a: Timer.idle(10).start(0) })
    runtime.tick(); failed = false; now = 1000; runtime.tick()
    assert.equal(sent.length, 1)
    runtime.requestSnapshot({ id: player.id, generation: 2 }); runtime.tick()
    assert.equal(sent.length, 2)
    assert.equal(sent.at(-1).player.generation, 2)
    failed = true
    runtime.requestSnapshot(player)
    runtime.tick(); runtime.tick(); runtime.tick()
    assert.equal(runtime.isOpen(hud, player), false)
    assert.equal(errors.length, 4)
})

test('Sapdon HUD 合并：保留默认标题过滤与其他 HUD 控件，拒绝重复原生工厂', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-hud-merge-')), hooks = [], registered = [], declared = []
    try {
        const base = { namespace: 'hud', 'hud_title_text/title_frame': { modifications: [{ array_name: 'bindings', operation: 'insert_back', value: [] }] },
            root_panel: { modifications: [{ array_name: 'controls', operation: 'insert_back', value: [{ other_hud: { type: 'panel' } }] }] } }
        const app = CuiApp.fromConfig({ namespace: 'merge_api', screens: [], timerHuds: [hudOf()] })
        app.useSapdon({ GRegistry: { register(name, root, p, data) { registered.push({ name, root, p, data }) }, beforeSubmit(fn) { hooks.push(fn) } }, UISystemRegistry: { addOuterUIdefs(value) { declared.push(...value) } } }, { scriptsDir: dir, resDir: path.join(dir, 'res') })
        hooks[0]([{ name: 'hud_screen', path: 'ui/', root: 'resource', data: { toObject: () => base } },
            { name: '_ui_defs', path: 'ui/', root: 'resource', data: { ui_defs: ['ui/hud_screen.json'] } }])
        assert.ok(!declared.includes('ui/hud_screen.json'), '已由 sapdon 登记的 HUD 不重复加载')
        const merged = registered.find((r) => r.name === 'hud_screen').data
        assert.deepEqual(merged.root_panel, base.root_panel)
        assert.deepEqual(merged['hud_title_text/title_frame'], base['hud_title_text/title_frame'])
        assert.equal(merged['root_panel/hud_title_text_area'].ignored, true)
        assert.equal(base['root_panel/hud_title_text_area'], undefined, '不修改 sapdon 原始对象')
        hooks[0]([{ name: 'hud_screen', path: 'ui/', root: 'resource', data: merged }])
        assert.equal(registered.filter((r) => r.name === 'hud_screen').at(-1).data.hud_screen.modifications.length, 1, '重复构建不重复挂载')
        assert.throws(() => hooks[0]([{ name: 'hud_screen', path: 'ui/', root: 'resource', data: { namespace: 'hud', custom: { factory: { name: 'hud_title_text_factory' } } } }]), /通道所有权/)
    } finally {
        assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()))
        assert.ok(path.basename(dir).startsWith('cui-hud-merge-'))
        fs.rmSync(dir, { recursive: true, force: true })
    }
})
