import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Back, Button, Close, Item, Label, Link, Next, Page, Panel, Prev, Router, Tabs, defineUI, _setScreenRuntime } from '../dist/index.js'
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
    const screen = defineUI(options)
    const manifests = CuiApp.fromConfig({ namespace: 'n', screens: [screen] }).compile().screens
    const platform = fakePlatform()
    const runtime = new ScreenRuntime(platform)
    runtime.register(manifests)
    _setScreenRuntime(runtime)
    const m = manifests[screen.id]
    const click = async (name, nth = 0) => { const b = m.buttons.filter((x) => x.method === name)[nth]; platform.shown.at(-1).resolve({ canceled: false, selection: b.index }); await tick(); await tick() }
    return { screen, platform, runtime, m, click }
}

const P = { id: 'player-1' }
const shopOptions = (calls = []) => ({
    id: 'cui_ui:shop',
    props: { item: { type: Item, default: { text: '钻石', icon: 'textures/items/diamond' } }, vip: { type: Boolean } },
    state() { return { coins: 10 } },
    computed: { coinText() { return `金币：${this.coins}` } },
    methods: {
        buy(n = 1) { calls.push(`buy ${this.player.id} ${n}`); this.coins -= n },
        leave() { this.close() },
        async slow() { await tick(); this.coins = 100 },
    },
    onOpen() { calls.push('onOpen') },
    onUpdate() { calls.push('onUpdate') },
    onClose() { calls.push(`onClose ${this.coins}`) },
    page: ({ coinText, item, vip, buy, leave, slow }) => new Page().setSize(200, 100).add(
        new Label(coinText).setSize(180, 10), new Label(item).setSize(100, 10), new Label('会员').setSize(40, 10).setVisible(vip),
        new Button().onClick(buy).setSize(40, 16), new Button().onClick(leave).setSize(40, 16), new Button().onClick(slow).setSize(40, 16), new Button().onClick(buy, 5).setSize(40, 16)),
})

test('open：按清单生成表单——标题为界面 id；props 取 open() 传入的值或默认值，computed 由状态计算；布尔值为 true 时写标记', async () => {
    const calls = []
    const { screen, platform, m } = setup(shopOptions(calls))
    screen.open(P, { vip: true })
    const form = platform.shown[0].form
    assert.equal(form.title, 'cui_ui:shop')
    const at = (name) => form.buttons[m.data.find((p) => p.name === name).slots[0].index]
    assert.deepEqual(at('coinText'), { text: '@p0|金币：10' }, 'computed')
    assert.deepEqual(at('item'), { text: '@p1|钻石', icon: 'textures/items/diamond' }, '默认值（文字与图标）')
    assert.deepEqual(at('vip'), { text: '@p2|' }, 'open() 传入的布尔值')
    assert.equal(form.buttons[m.buttons[0].index].text, '@b3|', '按钮写普通版的标记')
    assert.deepEqual(calls, ['onOpen'])
    assert.ok(screen.isOpen(P))
})

test('点击按钮：调用绑定的方法（带参数；this 可读写状态、this.player）→ onUpdate → 以新的数据重新打开，刚才点击的按钮写聚焦标记', async () => {
    const calls = []
    const { screen, platform, click } = setup(shopOptions(calls))
    screen.open(P)
    await click('buy')
    assert.deepEqual(calls, ['onOpen', 'buy player-1 1', 'onUpdate'])
    const form = platform.shown.at(-1).form
    assert.equal(platform.shown.length, 2)
    assert.equal(form.buttons[0].text, '@p0|金币：9', 'computed 随状态变化')
    assert.equal(form.buttons[3].text, '@b3|F', '刚才点击的 buy 获得默认焦点')
    assert.equal(form.buttons[4].text, '@b4|')
    await click('buy', 1)
    assert.equal(calls.at(-2), 'buy player-1 5', '同一个方法绑定到另一个按钮，带参数 5')
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|金币：4')
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
        id: 'cui_ui:book',
        methods: { note() { calls.push('note') } },
        page: ({ note }) => new Page().setSize(200, 120).add(
            new Router({ p1: () => new Page().add(new Next().setSize(16, 12)), p2: () => new Page().add(new Label('2')) }),
            new Button().onClick(note).setSize(12, 12)),
    })
    screen.open(P)
    assert.match(platform.shown[0].form.title, /^cui_ui:book\|.*p1/)
    platform.shown[0].resolve({ canceled: false, selection: m.buttons.find((b) => b.method === '__next').index }); await tick(); await tick()
    assert.match(platform.shown.at(-1).form.title, /p2/)
    assert.deepEqual(calls, [])

    const lonely = defineUI({ id: 'cui_ui:lonely', page: () => new Panel() })
    assert.throws(() => lonely.open(P), /cui\.generated\.js/)
})

test('界面以外的状态变化（例如定时器）：安排刷新——关闭当前表单、以新的状态重新打开，不调用 onClose；同一刻多次修改只刷新一次；方法中的修改不额外刷新；this.refresh()', async () => {
    const calls = [], holder = {}
    const { screen, platform, click } = setup({
        id: 'cui_ui:clock',
        state() { return { n: 5, other: 0 } },
        computed: { left() { return `剩余 ${this.n} 秒` } },
        methods: { tap() { this.n = 99; this.other = 1 } },
        onOpen() { holder.ctx = this },
        onClose() { calls.push('onClose') },
        page: ({ left, tap }) => new Panel().setSize(200, 60).add(new Label(left).setSize(100, 10), new Button().onClick(tap).setSize(30, 12)),
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

test('this.setInterval / setTimeout：与界面生命周期绑定——回调中修改状态触发刷新，界面关闭时自动取消', async (t) => {
    const holder = {}
    const { screen, platform, runtime } = setup({
        id: 'cui_ui:timer',
        state() { return { n: 3 } },
        computed: { left() { return String(this.n) } },
        onOpen() {
            holder.ctx = this
            holder.stop = this.setInterval(() => { this.n -= 1 }, 1)
            this.setTimeout(() => { this.n = 0 }, 4)
        },
        page: ({ left }) => new Panel().setSize(100, 30).add(new Label(left).setSize(50, 10)),
    })
    let interval, timeout, canceled = false
    runtime.quietMs = 0
    platform.interval = (fn, ticks) => { assert.equal(ticks, 1); interval = fn; return () => { canceled = true } }
    platform.timeout = (fn, ticks) => { assert.equal(ticks, 4); timeout = fn; return () => { } }
    t.after(() => screen.close(P))
    screen.open(P)
    interval(); await tick()
    interval(); await tick()
    assert.equal(platform.shown.length, 3)
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|1')
    timeout(); await tick()
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|0')
    platform.shown.at(-1).resolve({ canceled: true, cancelationReason: 'UserClosed' }); await tick()
    assert.ok(canceled, '关闭时取消平台定时器')
    interval(); await tick()
    assert.equal(holder.ctx.n, 0, '关闭后迟到的定时器回调不再执行')
    assert.equal(platform.shown.length, 4)
})

test('刷新：关闭后同一刻立即显示新表单，不等旧表单的结果；旧表单迟到的取消被忽略，不调用 onClose', async () => {
    const calls = [], holder = {}
    const { screen, platform, runtime } = setup({
        id: 'cui_ui:replace', state() { return { n: 1 } },
        computed: { v() { return String(this.n) } },
        onOpen() { holder.ctx = this }, onClose() { calls.push('onClose') },
        page: ({ v }) => new Panel().setSize(100, 30).add(new Label(v).setSize(50, 10)),
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
            id: `cui_ui:noloss_${mode}`, state() { return { n: 0, t: 0 } },
            computed: { v() { return `${this.n}/${this.t}` } },
            methods: { hello() { this.n += 1 } },
            onOpen() { holder.ctx = this },
            page: ({ v, hello }) => new Panel().setSize(100, 40).add(new Label(v).setSize(50, 10), new Button().onClick(hello).setSize(30, 12)),
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
        id: 'cui_ui:quiet', state() { return { n: 0, t: 0 } },
        computed: { v() { return `${this.n}/${this.t}` } },
        methods: { hello() { this.n += 1 } },
        onOpen() { holder.ctx = this },
        page: ({ v, hello }) => new Panel().setSize(100, 40).add(new Label(v).setSize(50, 10), new Button().onClick(hello).setSize(30, 12)),
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
        id: 'cui_ui:bus', props: { coins: { type: String } }, state() { return { n: 0 } },
        methods: { buy() { this.n += 1; this.emit('buy', '钻石', this.n) }, boom() { this.emit('boom') } },
        page: ({ coins, buy, boom }) => new Panel().setSize(100, 40).add(new Label(coins).setSize(50, 10), new Button().onClick(buy).setSize(30, 12), new Button().onClick(boom).setSize(30, 12)),
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
        id: 'cui_ui:merge', props: { w: { type: String } }, state() { return { a: 0, b: 0 } },
        computed: { v() { return `${this.a}-${this.b}` } },
        onOpen() { holder.ctx = this },
        page: ({ v, w }) => new Panel().setSize(100, 40).add(new Label(v).setSize(50, 10), new Label(w).setSize(50, 10)),
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

test('深层响应式：state 中数组的 push、嵌套对象的修改都触发更新；this.名字 可读 props；this.mc 来自平台；内置 close 关闭界面', async () => {
    const holder = {}, calls = []
    const { screen, platform, click } = setup({
        id: 'cui_ui:deep', props: { owner: { type: String, default: '无名' } },
        state() { return { bag: { items: ['苹果'] } } },
        computed: { count() { return `${this.owner}：${this.bag.items.length} 件` } },
        methods: { pick() { calls.push(typeof this.mc.marker); this.bag.items.push('面包') } },
        onOpen() { holder.ctx = this }, onClose() { calls.push('onClose') },
        page: ({ count, pick }) => new Panel().setSize(100, 40).add(new Label(count).setSize(80, 10), new Button().onClick(pick).setSize(20, 12), new Close().setSize(12, 12)),
    })
    platform.mc = { marker: 'mc' }
    platform.close = (player) => { platform.log.push(`close ${player.id}`) }
    screen.open(P, { owner: '史蒂夫' })
    assert.equal(platform.shown[0].form.buttons[0].text, '@p0|史蒂夫：1 件')
    holder.ctx.bag.items.push('牛奶')                    // 界面以外修改数组的内部：触发刷新
    await tick()
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|史蒂夫：2 件')
    holder.ctx.bag.items[0] = '金苹果'; holder.ctx.bag.extra = { n: 1 }; holder.ctx.bag.extra.n = 2
    await tick()
    assert.equal(platform.log.filter((l) => l.startsWith('close')).length, 2, '同一刻的多次深层修改只刷新一次')
    await click('pick')
    assert.equal(calls[0], 'string', 'this.mc 来自平台')
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|史蒂夫：3 件')
    await click('__close')
    assert.ok(!screen.isOpen(P)); assert.ok(calls.includes('onClose'))
})

test('多页（Router）：Link / Back / Prev / Next 编译为运行时处理的按钮；跳转记下历史，Back 返回；跳转后新页中动作相同的按钮获得焦点；无处可去时隐藏', async () => {
    const Entry = (title) => () => new Page().add(new Label(title), new Back().setSize(12, 12), new Next().setSize(12, 12))
    const guide = {
        id: 'cui_ui:guide',
        page: () => new Page().setSize(200, 120).add(
            new Link('home').setSize(20, 12),                          // 公共部分
            new Prev().setSize(12, 12), new Close().setSize(12, 12),
            new Router({
                home: () => new Page().add(new Label('目录'), new Link('sword').setSize(40, 12), new Link('apple').setSize(40, 12)),
                sword: Entry('钻石剑'),
                apple: Entry('苹果'),
            }).startAt('home'),
        ),
    }
    const { screen, platform, m } = setup(guide)
    const btn = (method, page, arg) => m.buttons.find((b) => b.method === method && b.page === page && (arg === undefined || b.args[0] === arg))
    assert.deepEqual(m.router.pages, ['home', 'sword', 'apple'])
    assert.ok(!btn('__next', 'apple'), '末页的 Next 编译时隐藏')
    assert.ok(m.paging.stay !== undefined, '「原地不动」按钮')
    const shown = () => platform.shown.at(-1).form
    const text = (b) => shown().buttons[b.index]?.text ?? ''
    const clickIndex = async (i) => { platform.shown.at(-1).resolve({ canceled: false, selection: i }); await tick(); await tick() }
    screen.open(P)
    assert.match(shown().title, /home/)
    assert.equal(text(btn('__back', 'sword')), '', '没有历史时 Back 不显示')
    assert.equal(text(btn('__prev', undefined)), '', '首页：公共部分的 Prev 不显示')
    await clickIndex(btn('__link', 'home', 'sword').index)          // 目录 → 钻石剑
    assert.match(shown().title, /sword/)
    assert.equal(text(btn('__back', 'sword')), btn('__back', 'sword').tag, '有历史时显示 Back')
    assert.equal(text(btn('__prev', undefined)), btn('__prev', undefined).tag)
    await clickIndex(btn('__next', 'sword').index)                  // 钻石剑 → 苹果
    assert.match(shown().title, /apple/)
    await clickIndex(btn('__back', 'apple').index)                  // Back → 钻石剑
    assert.match(shown().title, /sword/)
    assert.equal(text(btn('__back', 'sword')), btn('__back', 'sword').focusTag, '新页中动作相同的按钮（Back）获得焦点：鼠标不动也能连续返回')
    await clickIndex(btn('__back', 'sword').index)                  // Back → 目录
    assert.match(shown().title, /home/)
    assert.equal(text(btn('__back', 'sword')), '', '历史用完')
    await clickIndex(btn('__link', undefined, 'home').index)        // 公共部分的 Link：焦点不变
    assert.equal(text(btn('__link', undefined, 'home')), btn('__link', undefined, 'home').focusTag)
})

test('多页：写错时在构建时报出', () => {
    const ui = (page) => defineUI({ id: 'cui_ui:p', page }).build()
    assert.throws(() => ui(() => new Page().add(new Router({ a: () => new Page().add(new Link('c').setSize(10, 10)) }))), /找不到所属的页面组/)
    assert.throws(() => ui(() => new Page().add(new Router({ a: () => new Page() }), new Router({ b: () => new Page() }))), /最多一个 Router/)
    assert.throws(() => ui(() => new Page().add(new Tabs({ a: () => new Page().add(new Back().setSize(10, 10)) }))), /没有 Back/)
    assert.throws(() => new Router({ a: () => new Page() }).startAt('x'), /没有这个子页面/)
    assert.throws(() => defineUI({ id: 'cui_ui:p' }), /缺少 page/)
})

test('刷新期间旧、新表单的异步点击依次执行，状态不丢失，一批点击只重新显示一次', async () => {
    const holder = {}, releases = [], calls = []
    const { screen, platform, runtime, m } = setup({
        id: 'cui_ui:serial', state() { return { n: 0, t: 0 } },
        computed: { v() { return `${this.n}/${this.t}` } },
        onOpen() { holder.ctx = this },
        methods: { async add() {
            const n = this.n
            calls.push(`start ${n}`)
            await new Promise((resolve) => releases.push(resolve))
            this.n = n + 1
            calls.push(`end ${this.n}`)
        } },
        page: ({ v, add }) => new Panel().setSize(100, 40).add(new Label(v).setSize(60, 10), new Button().onClick(add).setSize(20, 12)),
    })
    platform.close = () => { }                          // 旧表单的结果稍后传回
    runtime.quietMs = 0
    screen.open(P)
    holder.ctx.t = 1
    await tick()
    const [old, current] = platform.shown
    old.resolve({ canceled: false, selection: m.buttons[0].index })
    await tick()
    current.resolve({ canceled: false, selection: m.buttons[0].index })
    await tick()
    assert.deepEqual(calls, ['start 0'], '第二次点击等待第一次完成')
    releases.shift()()
    await tick()
    assert.deepEqual(calls, ['start 0', 'end 1', 'start 1'])
    assert.equal(platform.shown.length, 2, '队列尚未处理完，不插入刷新')
    releases.shift()()
    await tick()
    assert.equal(holder.ctx.n, 2)
    assert.equal(platform.shown.length, 3)
    assert.equal(platform.shown.at(-1).form.buttons[0].text, '@p0|2/1')
    screen.close(P)
})

test('生命周期中关闭界面后不再显示：onOpen、onUpdate；等待异步方法时关闭也不重开', async () => {
    for (const hook of ['onOpen', 'onUpdate']) {
        const calls = []
        const c = setup({ ...shopOptions(calls), [hook]() { this.close() } })
        c.screen.open(P)
        if (hook === 'onUpdate') await c.click('buy')
        assert.equal(c.platform.shown.length, hook === 'onOpen' ? 0 : 1, hook)
        assert.ok(!c.screen.isOpen(P))
        assert.equal(c.platform.log.at(-1), 'camera false')
    }
    let release
    const c = setup({ ...shopOptions(), methods: { ...shopOptions().methods, slow() { return new Promise((r) => { release = r }) } } })
    c.screen.open(P)
    await c.click('slow')
    c.screen.close(P)
    release()
    await tick()
    assert.equal(c.platform.shown.length, 1)
    assert.ok(!c.screen.isOpen(P))
})

test('方法、生命周期或显示表单出错时清理实例、定时器与视角；清理本身出错仍继续', async (t) => {
    const warnings = []
    t.mock.method(console, 'warn', (s) => warnings.push(s))
    for (const where of ['method', 'onOpen', 'onUpdate', 'show', 'form']) {
        let armed = false, stopped = false
        const options = shopOptions()
        options.onOpen = function () { this.setInterval(() => { }, 20) }
        const boom = () => { throw new Error(`review ${where}`) }
        if (where === 'method') options.methods.buy = boom
        if (where === 'onOpen' || where === 'onUpdate') options[where] = boom
        if (where === 'form') options.computed.coinText = function () { if (armed) boom(); return String(this.coins) }
        const c = setup(options)
        c.platform.interval = () => () => { stopped = true }
        if (where === 'show') c.platform.show = async () => boom()
        armed = true
        c.screen.open(P)
        if (where === 'method' || where === 'onUpdate') await c.click('buy')
        await tick()
        assert.ok(!c.screen.isOpen(P), where)
        assert.equal(c.platform.log.at(-1), 'camera false', where)
        if (where !== 'onOpen') assert.ok(stopped, `${where}：取消定时器`)
    }
    const calls = [], c = setup(shopOptions(calls))
    c.screen.open(P)
    c.platform.close = () => { throw new Error('close failed') }
    c.screen.close(P)
    assert.equal(c.platform.log.at(-1), 'camera false')
    assert.ok(calls.some((s) => s.startsWith('onClose')))
    assert.equal(warnings.length, 6)
})

test('相同值、同一个嵌套对象与删除不存在的属性不刷新；真正的深层变化仍合并刷新', async () => {
    const holder = {}
    const c = setup({
        id: 'cui_ui:unchanged', state() { return { n: 0, bag: { n: 0 }, list: [1] } },
        computed: { v() { return `${this.n}/${this.bag.n}/${this.list.length}` } },
        onOpen() { holder.ctx = this },
        page: ({ v }) => new Panel().setSize(100, 30).add(new Label(v).setSize(80, 10)),
    })
    c.screen.open(P)
    holder.ctx.n = 0
    holder.ctx.bag.n = 0
    holder.ctx.bag = holder.ctx.bag
    holder.ctx.list = holder.ctx.list
    delete holder.ctx.bag.missing
    await tick()
    assert.equal(c.platform.shown.length, 1)
    holder.ctx.bag.n = 1
    holder.ctx.list.push(2)
    await tick()
    assert.equal(c.platform.shown.length, 2)
    assert.equal(c.platform.shown.at(-1).form.buttons[0].text, '@p0|0/1/2')
    c.screen.close(P)
})

test('异步事件处理与点击串行执行；事件处理期间收到当前表单的关闭会立即取消后续显示', async () => {
    for (const canceled of [false, true]) {
        const holder = {}, calls = []
        let release
        const c = setup({
            ...shopOptions(), onOpen() { holder.ctx = this },
            methods: { ...shopOptions().methods, buy() { calls.push('buy') } },
        })
        c.screen.on('wait', async () => { calls.push('event'); await new Promise((r) => { release = r }); calls.push('done') })
        c.screen.open(P)
        holder.ctx.emit('wait')
        await tick()
        c.platform.shown[0].resolve({ canceled, selection: canceled ? undefined : c.m.buttons[0].index })
        await tick()
        assert.deepEqual(calls, ['event'])
        if (canceled) assert.ok(!c.screen.isOpen(P), '异步事件尚未完成，也立即关闭实例')
        release()
        await tick()
        assert.deepEqual(calls, canceled ? ['event', 'done'] : ['event', 'done', 'buy'])
        assert.equal(c.platform.shown.length, canceled ? 1 : 2)
        c.screen.close(P)
    }
})

test('显示请求在替换与关闭后失效；关闭时取消推迟刷新，旧异步方法不能关闭新实例', async () => {
    const holder = {}, requests = [], deferred = []
    let release
    const c = setup({
        ...shopOptions(), onOpen() { holder.ctx = this },
        methods: { ...shopOptions().methods, async slow() { await new Promise((r) => { release = r }); this.close() } },
    })
    c.platform.show = (player, form, onBusy, isActive) => new Promise((resolve) => {
        requests.push(isActive)
        c.platform.shown.push({ player, form, resolve })
    })
    c.platform.now = () => 1000
    c.platform.timeout = (fn) => { const task = { fn, canceled: false }; deferred.push(task); return () => { task.canceled = true } }
    c.screen.open(P)
    assert.ok(requests[0]())
    holder.ctx.coins++
    await tick()
    assert.equal(deferred.length, 1)
    c.screen.close(P)
    assert.ok(deferred[0].canceled)
    assert.ok(!requests[0]())
    c.screen.open(P)
    c.runtime.quietMs = 0
    holder.ctx.coins++
    await tick()
    assert.ok(!requests[1](), '替换后旧显示请求失效')
    assert.ok(requests[2]())
    await c.click('slow')
    c.screen.close(P)
    c.screen.open(P)
    release()
    await tick()
    assert.ok(c.screen.isOpen(P), '旧实例迟到的 this.close() 不影响新实例')
    assert.ok(requests.at(-1)())
    c.screen.close(P)
})

test('防护：点击以外的刷新 10 秒内达到 3 次时提示一次（每秒修改状态的倒计时会吞点击），之后不再重复提示', async () => {
    const holder = {}
    const warns = [], warn = console.warn
    console.warn = (s) => warns.push(String(s))
    try {
        const { screen } = setup({
            id: 'cui_ui:busy', state() { return { n: 0 } }, computed: { v() { return String(this.n) } },
            onOpen() { holder.ctx = this },
            page: ({ v }) => new Panel().setSize(100, 30).add(new Label(v).setSize(50, 10)),
        })
        screen.open(P)
        for (let i = 1; i <= 5; i++) { holder.ctx.n = i; await tick(); await tick() }
    } finally { console.warn = warn }
    const hits = warns.filter((w) => w.includes('cui_ui:busy') && w.includes('ProgressBar'))
    assert.equal(hits.length, 1)
})
