import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Label, Panel, defineScreen, _setScreenRuntime } from '../dist/index.js'
import { CuiApp } from '../dist/node/index.js'
import { ScreenRuntime } from '../dist/runtime/screenRuntime.js'

/** 模拟的平台：记录显示过的表单，由测试决定玩家点了什么 */
function fakePlatform() {
    const shown = [], log = []
    return {
        shown, log,
        show(player, form) { return new Promise((resolve) => shown.push({ player, form, resolve })) },
        close(player) { log.push(`close ${player.id}`); const last = shown.at(-1); last?.resolve({ canceled: true, cancelationReason: 'UserClosed' }) },
        lockCamera(player, on) { log.push(`camera ${on}`) },
    }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

function setup(options) {
    const screen = defineScreen(options)
    const manifests = CuiApp.fromConfig({ namespace: 'n', screens: [screen] }).compile().screens
    const platform = fakePlatform()
    const runtime = new ScreenRuntime(platform)
    runtime.register(manifests)
    _setScreenRuntime(runtime)
    const m = manifests[screen.id]
    const click = async (name) => { const b = m.buttons.find((x) => x.name === name); platform.shown.at(-1).resolve({ canceled: false, selection: b.index }); await tick(); await tick() }
    return { screen, platform, runtime, m, click }
}

const P = { id: 'player-1' }
const shopOptions = (calls = []) => ({
    id: 'cui_ui:shop',
    props: { greeting: '默认问候', item: { text: '钻石', icon: 'textures/items/diamond' }, vip: false },
    state() { return { coins: 10 } },
    computed: { greeting() { return `金币：${this.coins}` } },
    methods: {
        buy() { calls.push(`buy ${this.player.id}`); this.coins -= 1 },
        leave() { this.close() },
        async slow() { await tick(); this.coins = 100 },
    },
    onOpen() { calls.push('onOpen') },
    onUpdate() { calls.push('onUpdate') },
    onClose() { calls.push(`onClose ${this.coins}`) },
    view({ props, button }) {
        return new Panel().setSize(200, 100).add(
            new Label(props.greeting).setSize(180, 10), new Label(props.item).setSize(100, 10), new Label('会员').setSize(40, 10).setVisible(props.vip),
            button('buy').setSize(40, 16), button('leave').setSize(40, 16), button('slow').setSize(40, 16))
    },
})

test('open：按清单生成表单——标题为界面 id，props 依次取 computed、open() 传入的值、默认值；布尔值为 true 时写标记', async () => {
    const calls = []
    const { screen, platform, m } = setup(shopOptions(calls))
    screen.open(P, { vip: true })
    const form = platform.shown[0].form
    assert.equal(form.title, 'cui_ui:shop')
    const at = (name) => form.buttons[m.props.find((p) => p.name === name).slots[0].index]
    assert.deepEqual(at('greeting'), { text: '@p0|金币：10' }, 'computed')
    assert.deepEqual(at('item'), { text: '@p1|钻石', icon: 'textures/items/diamond' }, '默认值（文字与图标）')
    assert.deepEqual(at('vip'), { text: '@p2|' }, 'open() 传入的布尔值')
    assert.equal(form.buttons[m.buttons[0].index].text, '@b3|', '按钮写普通版的标记')
    assert.deepEqual(calls, ['onOpen'])
    assert.ok(screen.isOpen(P))
})

test('点击按钮：调用同名方法（this 可读写状态、this.player）→ onUpdate → 以新的 props 重新打开，刚才点击的按钮写聚焦标记', async () => {
    const calls = []
    const { screen, platform, click } = setup(shopOptions(calls))
    screen.open(P)
    await click('buy')
    assert.deepEqual(calls, ['onOpen', 'buy player-1', 'onUpdate'])
    const form = platform.shown.at(-1).form
    assert.equal(platform.shown.length, 2)
    assert.equal(form.buttons[0].text, '@p0|金币：9', 'computed 随状态变化')
    assert.equal(form.buttons[3].text, '@b3|F', '刚才点击的 buy 获得默认焦点')
    assert.equal(form.buttons[4].text, '@b4|')
})

test('方法中调用 this.close()：不再打开，调用 onClose、解除视角锁定；玩家按 Esc 同样调用 onClose；异步方法执行完才重新打开', async () => {
    const calls = []
    const a = setup(shopOptions(calls))
    a.screen.open(P)
    await a.click('leave')
    assert.equal(a.platform.shown.length, 1, '没有重新打开')
    assert.deepEqual(calls, ['onOpen', 'onClose 10'])
    assert.ok(a.platform.log.includes('camera false'))
    assert.ok(!a.screen.isOpen(P))

    const calls2 = []
    const b = setup(shopOptions(calls2))
    b.screen.open(P)
    b.platform.shown[0].resolve({ canceled: true, cancelationReason: 'UserClosed' }); await tick()
    assert.deepEqual(calls2, ['onOpen', 'onClose 10'])

    const c = setup(shopOptions([]))
    c.screen.open(P)
    await c.click('slow'); await tick(); await tick()
    assert.equal(c.platform.shown.at(-1).form.buttons[0].text, '@p0|金币：100', '等异步方法结束后才重新打开')
})

test('翻页：翻页箭头只翻页（标题带页名），不调用方法；没有登记清单时提示导入 cui.generated.js', async () => {
    const calls = []
    const { screen, platform, m } = setup({
        id: 'cui_ui:book', methods: { close() { calls.push('close') } },
        view({ button, pages }) {
            const p = pages('b').startAt('p1')
            p.page('p1').add(p.serverArrow('p1', 'p2', 'next', () => new Label('>'), 16, 12))
            p.page('p2').add(new Label('2'))
            return new Panel().setSize(200, 120).add(button('close').setSize(12, 12), p, p.stayButton())
        },
    })
    screen.open(P)
    assert.match(platform.shown[0].form.title, /^cui_ui:book\|.*p1/)
    platform.shown[0].resolve({ canceled: false, selection: m.paging.arrows[0].index }); await tick(); await tick()
    assert.match(platform.shown.at(-1).form.title, /p2/)
    assert.deepEqual(calls, [])

    const lonely = defineScreen({ id: 'cui_ui:lonely', view: () => new Panel() })
    assert.throws(() => lonely.open(P), /cui\.generated\.js/)
})

test('界面以外的状态变化（例如定时器）：安排刷新——关闭当前表单、以新的状态重新打开，不调用 onClose；同一刻多次修改只刷新一次；方法中的修改不额外刷新；this.refresh()', async () => {
    const calls = [], holder = {}
    const { screen, platform, click } = setup({
        id: 'cui_ui:clock',
        props: { left: '' },
        state() { return { n: 5, other: 0 } },
        computed: { left() { return `剩余 ${this.n} 秒` } },
        methods: { tap() { this.n = 99; this.other = 1 } },
        onOpen() { holder.ctx = this },
        onClose() { calls.push('onClose') },
        view({ props, button }) { return new Panel().setSize(200, 60).add(new Label(props.left).setSize(100, 10), button('tap').setSize(30, 12)) },
    })
    platform.schedule = (fn) => setTimeout(fn, 0)        // 合并到下一刻
    screen.open(P)
    const closes = () => platform.log.filter((l) => l.startsWith('close')).length
    // 定时器在界面以外修改状态（同一刻改两次）
    holder.ctx.n = 4
    holder.ctx.n = 3
    await tick(); await tick()
    assert.equal(closes(), 1, '同一刻的两次修改只刷新一次')
    assert.equal(platform.shown.length, 2)
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|剩余 3 秒')
    assert.deepEqual(calls, [], '刷新不是玩家关闭，不调用 onClose')
    assert.ok(screen.isOpen(P))
    // 方法中修改状态：只有方法之后的那一次重新打开
    await click('tap'); await tick()
    assert.equal(closes(), 1, '方法中的修改不额外刷新')
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|剩余 99 秒')
    // this.refresh()
    holder.ctx.refresh(); await tick(); await tick()
    assert.equal(closes(), 2)
    assert.equal(platform.shown.length, 4)
})

test('this.setInterval / setTimeout：与界面生命周期绑定——回调中修改状态触发刷新，界面关闭时自动取消', async () => {
    const holder = {}
    const { screen, platform } = setup({
        id: 'cui_ui:timer',
        props: { left: '' },
        state() { return { n: 3 } },
        computed: { left() { return String(this.n) } },
        onOpen() { holder.stop = this.setInterval(() => { this.n -= 1 }, 1) },
        view({ props }) { return new Panel().setSize(100, 30).add(new Label(props.left).setSize(50, 10)) },
    })
    let runs = 0
    platform.schedule = (fn) => setTimeout(fn, 0)
    platform.interval = (fn, ticks) => { const id = setInterval(() => { runs++; fn() }, ticks * 5); return () => clearInterval(id) }
    screen.open(P)
    await new Promise((r) => setTimeout(r, 30))
    assert.ok(platform.shown.length >= 3, `定时器修改状态后刷新（显示了 ${platform.shown.length} 次）`)
    assert.notEqual(platform.shown.at(-1).form.buttons[0].text, '@p0|3')
    platform.shown.at(-1).resolve({ canceled: true, cancelationReason: 'UserClosed' }); await tick()
    const after = runs
    await new Promise((r) => setTimeout(r, 30))
    assert.equal(runs, after, '界面关闭后定时器不再执行')
})

test('刷新：关闭后同一刻立即显示新表单，不等旧表单的结果；旧表单迟到的取消被忽略，不调用 onClose', async () => {
    const calls = [], holder = {}
    const { screen, platform, runtime } = setup({
        id: 'cui_ui:replace', props: { v: '' }, state() { return { n: 1 } },
        computed: { v() { return String(this.n) } },
        onOpen() { holder.ctx = this }, onClose() { calls.push('onClose') },
        view({ props }) { return new Panel().setSize(100, 30).add(new Label(props.v).setSize(50, 10)) },
    })
    platform.schedule = (fn) => fn()
    platform.close = (player) => { platform.log.push(`close ${player.id}`) }     // 关闭后旧表单的结果稍后才到
    screen.open(P)
    const old = platform.shown[0]
    holder.ctx.n = 2
    assert.equal(platform.shown.length, 2, '没有等待旧表单的结果，立即显示了新表单')
    assert.equal(platform.shown[1].form.buttons[0].text, '@p0|2')
    old.resolve({ canceled: true, cancelationReason: 'UserClosed' }); await tick()   // 旧表单迟到的结果
    assert.deepEqual(calls, [], '旧表单的取消被忽略')
    assert.ok(screen.isOpen(P))
    platform.shown[1].resolve({ canceled: true, cancelationReason: 'UserClosed' }); await tick()
    assert.deepEqual(calls, ['onClose'], '新表单被关闭时正常调用 onClose')
})

test('刷新时不丢点击（真机 1.39.0）：被替换的旧表单上的点击照常调用方法并带焦点刷新', async () => {
    for (const mode of ['replace']) {
        const holder = {}
        const { screen, platform, runtime, m } = setup({
            id: `cui_ui:noloss_${mode}`, props: { v: '' }, state() { return { n: 0, t: 0 } },
            computed: { v() { return `${this.n}/${this.t}` } },
            methods: { hello() { this.n += 1 } },
            onOpen() { holder.ctx = this },
            view({ props, button }) { return new Panel().setSize(100, 40).add(new Label(props.v).setSize(50, 10), button('hello').setSize(30, 12)) },
        })
        platform.schedule = (fn) => fn()
        platform.close = (player) => { platform.log.push(`close ${player.id}`) }      // 关闭的结果由测试决定
        screen.open(P)
        const old = platform.shown[0]
        holder.ctx.t = 1                                                              // 定时器触发刷新
        // 玩家恰好在这一刻点了旧表单上的「hello」
        old.resolve({ canceled: false, selection: m.buttons[0].index }); await tick(); await tick()
        const last = platform.shown.at(-1).form
        assert.equal(last.buttons[0].text, '@p0|1/1', `${mode}：点击没有丢，方法执行了`)
        assert.equal(last.buttons[1].text, `@b1|F`, `${mode}：刚点击的按钮获得焦点`)
        assert.ok(screen.isOpen(P))
    }
})

test('表单刚显示不久时推迟刷新（真机 1.40.0）：安静下来后才刷新；推迟期间玩家点击，重新打开已带最新状态，到期的刷新跳过', async () => {
    const holder = {}
    const { screen, platform, runtime, click } = setup({
        id: 'cui_ui:quiet', props: { v: '' }, state() { return { n: 0, t: 0 } },
        computed: { v() { return `${this.n}/${this.t}` } },
        methods: { hello() { this.n += 1 } },
        onOpen() { holder.ctx = this },
        view({ props, button }) { return new Panel().setSize(100, 40).add(new Label(props.v).setSize(50, 10), button('hello').setSize(30, 12)) },
    })
    let now = 1000
    const timeouts = []
    platform.now = () => now
    platform.timeout = (fn, ticks) => { timeouts.push({ fn, at: now + ticks * 50 }); return () => { } }
    platform.schedule = (fn) => fn()
    const closes = () => platform.log.filter((l) => l.startsWith('close')).length
    const advance = (ms) => { now += ms; for (const t of timeouts.splice(0)) if (t.at <= now) t.fn(); else timeouts.push(t) }

    screen.open(P)
    holder.ctx.t = 1                         // 刚显示就有定时器的更新
    assert.equal(closes(), 0, '推迟，不立即刷新')
    advance(450)
    assert.equal(closes(), 1, '安静 0.4 秒后刷新')
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|0/1')

    holder.ctx.t = 2                         // 又一次更新（刷新刚发生，推迟）
    await click('hello')                     // 推迟期间玩家点击：重新打开已带最新状态
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|1/2')
    const before = closes()
    advance(450)
    assert.equal(closes(), before, '正在显示的已是最新状态，到期的刷新跳过（少一次关闭再打开）')
    holder.ctx.t = 3                         // 之后的新变化照常刷新
    advance(450)
    assert.equal(closes(), before + 1)
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|1/3')
})

test('事件总线：方法中 this.emit() → 脚本 screen.on() 的处理函数在方法之后、重新打开之前执行；处理中 open() 更新数据，只重新打开一次；处理出错不影响界面', async () => {
    const seen = []
    const { screen, platform, click } = setup({
        id: 'cui_ui:bus', props: { coins: '' }, state() { return { n: 0 } },
        methods: { buy() { this.n += 1; this.emit('buy', '钻石', this.n) }, boom() { this.emit('boom') } },
        view({ props, button }) { return new Panel().setSize(100, 40).add(new Label(props.coins).setSize(50, 10), button('buy').setSize(30, 12), button('boom').setSize(30, 12)) },
    })
    screen.on('buy', (player, item, n) => { seen.push(`${player.id} ${item} ${n}`); screen.open(player, { coins: `金币 ${100 - n}` }) })
    screen.on('boom', () => { throw new Error('出错了') })
    screen.open(P, { coins: '金币 100' })
    await click('buy')
    assert.deepEqual(seen, ['player-1 钻石 1'])
    assert.equal(platform.shown.length, 2, '方法、事件、open() 的更新合并为一次重新打开')
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|金币 99')
    const warn = console.warn; console.warn = () => { }
    try { await click('boom') } finally { console.warn = warn }
    assert.equal(platform.shown.length, 3, '处理出错，界面照常重新打开')
})

test('合并队列：定时器回调中多次修改状态并发出事件——事件交给脚本，界面只刷新一次；对已打开的界面再次 open()，合并新数据、只刷新一次', async () => {
    const holder = {}, seen = []
    const { screen, platform } = setup({
        id: 'cui_ui:merge', props: { v: '', w: '' }, state() { return { a: 0, b: 0 } },
        computed: { v() { return `${this.a}-${this.b}` } },
        onOpen() { holder.ctx = this },
        view({ props }) { return new Panel().setSize(100, 40).add(new Label(props.v).setSize(50, 10), new Label(props.w).setSize(50, 10)) },
    })
    screen.on('tick', (player, a) => seen.push(a))
    platform.close = (player) => { platform.log.push(`close ${player.id}`) }
    screen.open(P, { w: 'x' })
    await tick()
    const closes = () => platform.log.filter((l) => l.startsWith('close')).length
    holder.ctx.a = 1; holder.ctx.b = 2; holder.ctx.emit('tick', 1); holder.ctx.a = 3     // 同一段代码中的多个变化
    await tick(); await tick()
    assert.deepEqual(seen, [1])
    assert.equal(closes(), 1, '只刷新一次')
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|3-2')
    screen.open(P, { w: 'y' }); screen.open(P, { w: 'z' })
    await tick(); await tick()
    assert.equal(closes(), 2, '两次 open() 合并为一次刷新')
    assert.equal(platform.shown.at(-1).form.buttons[1].text, '@p1|z')
})

test('诊断记录：记下显示、结果、替换、关闭等关键步骤（出现异常后取出）', async () => {
    const { screen, runtime, click } = setup(shopOptions([]))
    screen.open(P)
    await click('buy')
    await click('leave')
    const t = runtime.trace().join('\n')
    for (const s of ['显示 #1', '结果 #1：点击 3', '显示 #2', '结果 #2：点击 4', '关闭界面']) assert.ok(t.includes(s), `${s}\n${t}`)
})
