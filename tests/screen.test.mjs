import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Anchor, Image, Item, Label, Next, Page, Panel, Router, Timer, compileNamespace, Button, Close, defineUI, finalize } from '../dist/index.js'
import { CuiApp } from '../dist/node/index.js'

const shop = () => defineUI({
    id: 'cui_ui:shop',
    props: {
        greeting: { type: String, default: '欢迎光临' },
        item: { type: Item, default: { text: '钻石', icon: 'textures/items/diamond' } },
        vip: { type: Boolean },
        goods: { type: Array, of: Item, max: 2, default: ['苹果', { text: '面包', icon: 'textures/items/bread' }] },
    },
    state() { return { coins: 10 } },
    computed: { coinText() { return `金币：${this.coins}` } },
    methods: { buy() { }, help() { } },
    page: ({ greeting, item, vip, goods, coinText, buy }) => new Page().setSize(200, 120).add(
        new Label(greeting).setName('greeting').setSize(180, 10).setAnchor(Anchor.TOP_LEFT).setOffset(4, 4),
        new Image(item).setName('icon').setSize(16, 16),
        new Label('会员').setName('vip').setSize(40, 10).setVisible(vip),
        new Label(goods[1]).setName('second').setSize(100, 10),
        new Label(coinText).setName('coins').setSize(100, 10),
        new Button().onClick(buy, '钻石', 2).setSize(60, 18),
    ),
})

test('defineUI：视图用到的数据按使用顺序分配按钮（列表每项一个）；清单记下来源、种类、默认值；按钮记下绑定的方法与参数', () => {
    const { manifest } = shop().build()
    assert.deepEqual(manifest.data.map((d) => [d.name, d.source, d.kind, d.slots.map((s) => s.index)]),
        [['greeting', 'prop', 'text', [0]], ['item', 'prop', 'item', [1]], ['vip', 'prop', 'flag', [2]], ['goods', 'prop', 'list', [3, 4]], ['coinText', 'computed', 'text', [5]]])
    assert.deepEqual(manifest.buttons, [{ index: 6, tag: '@b6|', focusTag: '@b6|F', method: 'buy', args: ['钻石', 2] }])
    assert.equal(manifest.data[4].default, '金币：10', 'computed 用初始状态算出示例值')
})

test('defineUI：声明与名字的错误在构建时报出并说明改法', () => {
    const make = (extra) => defineUI({ id: 'cui_ui:x', methods: { ok() { } }, page: () => new Panel(), ...extra }).build()
    assert.throws(() => make({ props: { a: '欢迎' } }), /props\.a 应写成声明，例如 \{ type: String/)
    assert.throws(() => make({ props: { a: { type: Array } } }), /max/)
    assert.throws(() => make({ props: { a: { type: Timer } } }), /Timer.*默认值/)
    assert.throws(() => make({ props: { ok: { type: String } } }), /「ok」同时出现在 props 与 methods/)
    assert.doesNotThrow(() => make({ state() { return { button: 1 } }, page: ({ button }) => new Label(button).setSize(10, 10) }), '没有保留名：数据可以叫 button')
    assert.throws(() => make({ page: ({ greting }) => new Label(greting) }), /未定义的名字「greting」/)
    assert.equal(defineUI({ id: 'cui_ui:y', page: () => new Panel().add(new Button().setSize(10, 10)) }).build().manifest.buttons.length, 0, '没有绑定方法的 Button 是界面内部的按钮')
    assert.throws(() => make({ page: () => new Panel().add(new Button().onClick('ok')) }), /解构得到的方法/)
    assert.throws(() => make({ page: ({ ok }) => new Panel().add(new Button().onClick(ok, () => 1)) }), /JSON/)
    assert.throws(() => make({ state() { return { obj: { a: 1 } } }, page: ({ obj }) => new Label(obj) }), /不能直接显示/)
    assert.throws(() => defineUI({ id: 'shop', page: () => new Panel() }), /cui_ui:/)
})

test('使用数据的控件：快照时自动包上读取对应按钮的容器——位置与尺寸移到容器上，控件填满容器；一个控件用两项数据报错', () => {
    const { root } = shop().build()
    const [r] = finalize(root)
    const g = r.children.find((c) => c.name === 'greeting')
    assert.equal(g.type, 'collection_item')
    assert.deepEqual([g.props.collection, g.props.index, g.props.size, g.props.offset], ['form_buttons', 0, [180, 10], [4, 4]])
    assert.equal(g.children[0].type, 'label')
    assert.deepEqual(g.children[0].props.size, ['100%', '100%'])
    assert.equal(r.children.find((c) => c.name === 'second').props.index, 4, '列表的第 2 项')
    const two = defineUI({ id: 'cui_ui:t', props: { a: { type: String }, b: { type: Boolean } }, page: ({ a, b }) => new Panel().add(new Label(a).setSize(10, 10).setVisible(b)) })
    assert.throws(() => finalize(two.build().root), /只能使用一个 prop/)
})

test('编译：数据的文字去掉标记显示、图标照原版按钮图标绑定、显示条件为「包含标记」；没有像素尺寸时静态检查报错', () => {
    const r = compileNamespace('t', { root: shop().build().root })
    assert.deepEqual(r.issues.filter((i) => i.level === 'error'), [])
    const json = JSON.stringify(r.json ?? r)
    assert.ok(json.includes('@p0|') && json.includes('"binding_name_override":"#texture"') && json.includes('@p2|'))
    const bad = defineUI({ id: 'cui_ui:b', props: { a: { type: String } }, page: ({ a }) => new Panel().setSize(100, 20).add(new Label(a)) })
    assert.ok(compileNamespace('t', { root: bad.build().root }).issues.some((i) => i.level === 'error'))
})

test('Button.onClick()：构建时编译为服务端按钮——同一序号的普通版（优先级 10）与聚焦版（100）；状态与内容同时加进两个版本（聚焦版放副本）；尺寸与位置沿用', () => {
    const s = defineUI({
        id: 'cui_ui:btn', methods: { hello() { } },
        page: ({ hello }) => {
            const b = new Button().onClick(hello).setSize(70, 18).setAnchor(Anchor.TOP_LEFT).setOffset(3, 4)
            b.default.add(new Label('点我'))
            b.hover.add(new Label('§e点我'))
            return new Page().setSize(200, 100).add(b)
        },
    })
    const { root } = s.build()
    const made = root.children.find((c) => c.normal)
    assert.ok(made, '替换为服务端按钮')
    assert.deepEqual(made.offset.toJSON(), [3, 4])
    const { normal, focused } = made
    assert.deepEqual([normal.index, focused.index, normal.focusPrecedence, focused.focusPrecedence], [0, 0, 10, 100])
    assert.notEqual(normal.default.children[0], focused.default.children[0], '聚焦版放的是副本')
    assert.deepEqual([made.size.toJSON(), normal.button.size.toJSON()].map(String), ['70,18', '70,18'])
    assert.deepEqual(compileNamespace('t', { root }).issues.filter((i) => i.level === 'error'), [])
})

test('配置用界面数组：CuiApp 编译出清单（附翻页路由表）；预览的表单内容：props 默认值、state 初始值、computed 示例值、翻页箭头', () => {
    const book = defineUI({
        id: 'cui_ui:book',
        props: { title: { type: String, default: '目录' } },
        state() { return { count: 1 } },
        page: ({ title, count }) => new Page().setSize(200, 120).add(
            new Label(title).setSize(100, 10), new Label(count).setSize(20, 10), new Close().setSize(12, 12),
            new Router({ p1: () => new Page().add(new Next().setSize(16, 12)), p2: () => new Page().add(new Label('2')) }),
        ),
    })
    const c = CuiApp.fromConfig({ namespace: 'n', screens: [shop(), book] }).compile()
    const m = c.screens['cui_ui:book']
    assert.deepEqual(m.buttons.map((b) => b.method), ['__close', '__next'])
    const used = [...m.data.flatMap((d) => d.slots.map((s) => s.index)), ...m.buttons.map((b) => b.index), m.paging.stay]
    assert.equal(new Set(used).size, used.length, '数据、按钮、「原地不动」共用分配器，序号不重复')
    const f = book.previewForm()
    assert.ok(f.buttons.some((b) => /^@p\d+\|目录$/.test(b)) && f.buttons.some((b) => /^@p\d+\|1$/.test(b)), 'props 默认值与 state 初始值')
    assert.ok(f.buttons.includes(m.buttons[1].tag) && f.buttons.includes('stay|'), '起始页的 Next 与「原地不动」')
})
