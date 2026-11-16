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
