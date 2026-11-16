import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Anchor, Image, Label, Panel, compileNamespace, defineScreen, finalize } from '../dist/index.js'
import { CuiApp } from '../dist/node/index.js'

const shop = () => defineScreen({
    id: 'cui_ui:shop',
    props: {
        greeting: '欢迎光临',
        item: { text: '钻石', icon: 'textures/items/diamond' },
        vip: false,
        goods: ['苹果', { text: '面包', icon: 'textures/items/bread' }],
    },
    methods: { buy() { }, help() { } },
    view({ props, button }) {
        return new Panel().setSize(200, 120).add(
            new Label(props.greeting).setName('greeting').setSize(180, 10).setAnchor(Anchor.TOP_LEFT).setOffset(4, 4),
            new Image(props.item).setName('icon').setSize(16, 16),
            new Label('会员').setName('vip').setSize(40, 10).setVisible(props.vip),
            new Label(props.goods[1]).setName('second').setSize(100, 10),
            button('buy').setSize(60, 18),
        )
    },
})

test('defineScreen：props 按定义顺序分配按钮（列表每项一个），button() 接着分配；清单记下名字、序号、标记、种类与默认值', () => {
    const { manifest } = shop().build()
    assert.deepEqual(manifest.props.map((p) => [p.name, p.kind, p.slots.map((s) => s.index)]),
        [['greeting', 'text', [0]], ['item', 'item', [1]], ['vip', 'flag', [2]], ['goods', 'list', [3, 4]]])
    assert.deepEqual(manifest.buttons, [{ name: 'buy', index: 5, tag: '@b5|', focusTag: '@b5|F' }])
    assert.equal(manifest.props[0].slots[0].tag, '@p0|')
})

test('defineScreen：未定义的 prop、按钮没有同名方法、按钮重名、id 不以 cui_ui: 开头，都在构建时报错并说明改法', () => {
    const make = (view, extra = {}) => defineScreen({ id: 'cui_ui:x', props: { a: '' }, methods: { ok() { } }, view, ...extra }).build()
    assert.throws(() => make(({ props }) => new Label(props.greting)), /未定义的 prop「greting」/)
    assert.throws(() => make(({ button }) => button('buyy')), /button\('buyy'\) 没有同名的方法/)
    assert.throws(() => make(({ button }) => new Panel().add(button('ok'), button('ok'))), /创建了两次/)
    assert.throws(() => defineScreen({ id: 'shop', view: () => new Panel() }), /cui_ui:/)
})

test('使用 prop 的控件：快照时自动包上读取对应按钮的容器——位置与尺寸移到容器上，控件填满容器；一个控件用两个 prop 报错', () => {
    const { root } = shop().build()
    const [r] = finalize(root)
    const g = r.children.find((c) => c.name === 'greeting')
    assert.equal(g.type, 'collection_item')
    assert.deepEqual([g.props.collection, g.props.index, g.props.size, g.props.offset], ['form_buttons', 0, [180, 10], [4, 4]])
    assert.equal(g.children[0].type, 'label')
    assert.equal(g.children[0].path, `${g.path}/value`)
    assert.deepEqual(g.children[0].props.size, ['100%', '100%'])
    assert.equal(r.children.find((c) => c.name === 'second').props.index, 4, '列表的第 2 项')
    assert.equal(r.children.find((c) => c.name === 'vip').props.index, 2, '显示条件')
    const two = defineScreen({ id: 'cui_ui:t', props: { a: '', b: false }, view: ({ props }) => new Panel().add(new Label(props.a).setSize(10, 10).setVisible(props.b)) })
    assert.throws(() => finalize(two.build().root), /只能使用一个 prop/)
})

test('编译：prop 的文字去掉标记显示、图标照原版按钮图标绑定、显示条件为「包含标记」；没有像素尺寸时静态检查报错', () => {
    const { root } = shop().build()
    const r = compileNamespace('t', { root })
    assert.deepEqual(r.issues.filter((i) => i.level === 'error'), [])
    const json = JSON.stringify(r.json ?? r)
    assert.ok(json.includes('@p0|'), '文字中去掉标记')
    assert.ok(json.includes('"binding_name_override":"#texture"'), '图标')
    assert.ok(json.includes('@p2|'), '显示条件')
    const bad = defineScreen({ id: 'cui_ui:b', props: { a: '' }, view: ({ props }) => new Panel().setSize(100, 20).add(new Label(props.a)) })
    assert.ok(compileNamespace('t', { root: bad.build().root }).issues.some((i) => i.level === 'error'), '显示 prop 的控件需要像素尺寸')
})

test('配置用界面数组：CuiApp 编译出清单（附翻页路由表），预览的表单内容取 props 的默认值', () => {
    const book = defineScreen({
        id: 'cui_ui:book',
        props: { title: '目录' },
        methods: { close() { } },
        view({ props, button, pages }) {
            const p = pages('b').startAt('p1')
            p.page('p1').add(p.serverArrow('p1', 'p2', 'next', () => new Label('>'), 16, 12))
            p.page('p2').add(new Label('2'))
            return new Panel().setSize(200, 120).add(new Label(props.title).setSize(100, 10), button('close').setSize(12, 12), p, p.stayButton())
        },
    })
    const c = CuiApp.fromConfig({ namespace: 'n', screens: [shop(), book] }).compile()
    assert.deepEqual(Object.keys(c.screens).sort(), ['cui_ui:book', 'cui_ui:shop'])
    const m = c.screens['cui_ui:book']
    // props 先分配；之后按创建的先后：pages() 先创建，翻页箭头先拿到序号，button('close') 在后
    const used = [m.props[0].slots[0].index, m.buttons[0].index, ...m.paging.arrows.map((a) => a.index), m.paging.stay]
    assert.equal(m.props[0].slots[0].index, 0)
    assert.equal(new Set(used).size, used.length, '翻页按钮与 props、按钮共用分配器，序号不重复')
    const form = shop().previewForm()
    assert.deepEqual(form.buttons.slice(0, 6), ['@p0|欢迎光临', '@p1|钻石', '', '@p3|苹果', '@p4|面包', '@b5|'])
    assert.equal(form.icons[1], 'textures/items/diamond')
})

test('button()：同一序号的普通版（优先级 10）与聚焦版（100，含聚焦标记时显示）；状态与内容同时加进两个版本（聚焦版放副本）；尺寸同步', () => {
    let made
    const s = defineScreen({
        id: 'cui_ui:btn', methods: { hello() { } },
        view({ button }) {
            made = button('hello').setSize(70, 18)
            made.default.add(new Label('点我'))
            made.hover.add(new Label('§e点我'))
            made.add(new Image('textures/ui/white').setSize(4, 4))
            return new Panel().setSize(200, 100).add(made)
        },
    })
    const { root } = s.build()
    const { normal, focused } = made
    assert.deepEqual([normal.index, focused.index], [0, 0])
    assert.deepEqual([normal.focusPrecedence, focused.focusPrecedence], [10, 100])
    assert.deepEqual([normal.tag, focused.tag], ['@b0|', '@b0|F'])
    assert.equal(normal.default.children.length, 1); assert.equal(focused.default.children.length, 1)
    assert.notEqual(normal.default.children[0], focused.default.children[0], '聚焦版放的是副本')
    assert.equal(focused.hover.children[0].text, '§e点我')
    assert.deepEqual([made.size.toJSON(), normal.size.toJSON(), focused.size.toJSON(), normal.button.size.toJSON()].map(String), Array(4).fill('70,18'))
    assert.deepEqual(compileNamespace('t', { root }).issues.filter((i) => i.level === 'error'), [])
})

test('previewForm：包含起始页的翻页箭头与「原地不动」按钮（手册网站的预览据此显示箭头）', () => {
    const s = defineScreen({
        id: 'cui_ui:pv', methods: { close() { } },
        view({ button, pages }) {
            const p = pages('b').startAt('p1')
            p.page('p1').add(p.serverArrow('p1', 'p2', 'next', () => new Label('>'), 16, 12))
            p.page('p2').add(p.serverArrow('p2', 'p1', 'prev', () => new Label('<'), 16, 12))
            return new Panel().setSize(200, 100).add(p, p.stayButton(), button('close').setSize(12, 12))
        },
    })
    const { manifest } = s.build()
    const f = s.previewForm(manifest)
    assert.ok(f.buttons.some((t) => /^go\d+\|F?$/.test(t)), `有翻页箭头：${JSON.stringify(f.buttons)}`)
    assert.ok(f.buttons.includes('stay|'))
    assert.ok(f.buttons.includes(manifest.buttons[0].tag), '自己的按钮仍在')
})
