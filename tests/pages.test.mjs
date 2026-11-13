// 开关分页（客户端翻页，不经过服务端）与服务端表单挂接
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Panel, Label, Image, Toggle, Pages, compileNamespace, finalize, layout, findBox, serverForm, walk } from '../dist/index.js'

function book() {
    const pages = new Pages({ group: 'book', start: 'home', size: [200, 100], anchor: 'top_left' })
    pages.page('home').add(new Label({ name: 'home_text', text: '目录' }))
    pages.page('sword').add(new Label({ name: 'sword_text', text: '钻石剑' }))
    const toSword = pages.link('sword', { name: 'row_sword', size: [100, 18], anchor: 'top_left' })
    toSword.unchecked.add(new Label({ text: '去钻石剑' }))
    toSword.checkedHover.add(new Image({ texture: 'hl', keepRatio: false, size: ['100%', '100%'] }))
    pages.page('home').add(toSword)
    const back = pages.link('home', { name: 'back', size: [20, 10] })
    pages.page('sword').add(back)
    return pages
}

test('Pages：每页 visible =「任意指向本页的开关被选中」；同组单选；初始页；开关名全局唯一', () => {
    const [root] = finalize(book())
    const toggles = []
    walk([root], (n) => { if (n.type === 'toggle') toggles.push(n) })
    assert.deepEqual(toggles.map((t) => [t.name, t.props.group, t.props.index, t.props.defaultSelected]).sort(),
        [['back', 'book', 0, 0], ['book__home', 'book', 0, 0], ['book__sword', 'book', 1, 0], ['row_sword', 'book', 1, 0]].sort())
    const { json, issues } = compileNamespace('t', { root: book() })
    assert.deepEqual(issues, [])
    const sword = json.root.controls.find((c) => c.book_sword).book_sword
    const views = sword.bindings.filter((b) => b.source_control_name)
    assert.deepEqual(views.map((b) => b.source_control_name).sort(), ['book__sword', 'row_sword'])
    assert.ok(views.every((b) => b.source_property_name === '#toggle_state' && !('resolve_sibling_scope' in b)), '跨区域读开关：不写 resolve_sibling_scope')
    assert.equal(sword.bindings.at(-1).source_property_name, '(#cui_book__sword_toggle_state or #cui_row_sword_toggle_state)')
    assert.equal(sword.bindings.at(-1).target_property_name, '#visible')
})

test('开关编译：继承 common.toggle；单选组变量；不读全局初始状态；悬停态没写内容时沿用普通态', () => {
    const { json } = compileNamespace('t', { root: book() })
    const home = json.root.controls.find((c) => c.book_home).book_home
    const t = home.controls.find((c) => c['row_sword@common.toggle'])['row_sword@common.toggle']
    assert.equal(t.$toggle_name, 'book')
    assert.equal(t.$radio_toggle_group, true)
    assert.equal(t.$toggle_group_forced_index, 1)
    assert.equal(t.$toggle_group_default_selected, 0)
    assert.equal(t.$toggle_binding_type, 'none')
    const states = Object.fromEntries(t.controls.map((c) => Object.entries(c)[0]))
    assert.deepEqual(Object.keys(states), ['unchecked', 'checked', 'unchecked_hover', 'checked_hover', 'unchecked_locked', 'checked_locked', 'unchecked_locked_hover', 'checked_locked_hover'])
    assert.deepEqual(states.unchecked_hover, { ...states.unchecked_hover, controls: states.unchecked.controls }, '悬停态没写 → 沿用普通态')
    assert.equal(states.checked_hover.controls[0].image0.keep_ratio, false)
})

test('排版（预览语义）：选中哪个序号就显示哪页；点到的开关显示 checked 态', () => {
    const run = (sel, hover) => layout(finalize(book()), {
        viewport: [200, 100],
        toggleChecked: (n) => n.props.index === sel,
        data: (name, src) => (src.kind === 'control' ? ({ book__home: sel === 0, back: sel === 0, book__sword: sel === 1, row_sword: sel === 1 })[src.control] : ''),
        buttonState: (p) => (p === hover ? 'hover' : 'default'),
    })
    let b = run(0)
    assert.ok(findBox(b, 'home_text'))
    assert.equal(findBox(b, 'sword_text'), undefined)
    b = run(1)
    assert.equal(findBox(b, 'home_text'), undefined)
    assert.ok(findBox(b, 'sword_text'))
})

test('静态检查：开关名重复', () => {
    const root = new Panel({ size: [10, 10], children: [new Toggle({ name: 'x', group: 'g', index: 0 }), new Panel({ children: [new Toggle({ name: 'x', group: 'g', index: 1 })] })] })
    assert.deepEqual(compileNamespace('t', { root }).issues.map((i) => i.rule), ['toggle-name-unique'])
})

test('serverForm：挂到原版服务端表单（工厂 + 标题门控 + 隐藏原版长表单）', () => {
    const { files, issues } = serverForm({ namespace: 'cui_test', panelId: 'cui_ui:test', content: book() })
    assert.deepEqual(issues, [])
    assert.deepEqual(Object.keys(files).sort(), ['ui/_ui_defs.json', 'ui/cui_test.json', 'ui/server_form.json'])
    const hook = files['ui/server_form.json']
    assert.equal(hook.main_screen_content.modifications[0].value[0].cui_form_factory_cui_test.factory.control_ids.long_form, '@cui_test.root')
    assert.equal(hook.long_form.modifications[0].value[1].source_property_name, "((#title_text - 'cui_ui:') = #title_text)")
    const root = files['ui/cui_test.json'].root
    assert.equal(root.bindings[0].binding_name, '#title_text')
    assert.equal(root[root.bindings[1].source_property_name.match(/\$\w+/)[0]], 'cui_ui:test')
    assert.throws(() => serverForm({ namespace: 'x', panelId: 'nope', content: book() }), /cui_ui:/)
})

test('静态检查：开关里读外层集合项的数据（真机读不到）；集合项放进开关状态面板里则可以', async () => {
    const { CollectionItem, Toggle, Label, Panel, compileNamespace, form } = await import('../dist/index.js')
    const bad = new CollectionItem({ collection: 'form_buttons', index: 0, size: [20, 20] })
    const t = new Toggle({ name: 'tg', group: 'g', index: 0, size: [20, 20] })
    t.uncheckedHover.add(new Label({ name: 'info', text: form.buttonText.minus('s0|') }))
    bad.add(t)
    assert.deepEqual(compileNamespace('t', { root: new Panel({ children: [bad] }) }).issues.map((i) => i.rule), ['collection-through-toggle'])
    const t2 = new Toggle({ name: 'tg2', group: 'g', index: 0, size: [20, 20] })
    t2.uncheckedHover.add(new CollectionItem({ collection: 'form_buttons', index: 0, size: [20, 20] }).add(new Label({ text: form.buttonText.minus('s0|') })))
    assert.deepEqual(compileNamespace('t', { root: new Panel({ children: [t2] }) }).issues, [])
})

test('启用 / 禁用：enabled 表达式 → #enabled 绑定；禁用的开关显示 locked 态（lockedVisible: false 则不画）；预览不参与鼠标判定', async () => {
    const { Toggle, Label, Panel, compileNamespace, finalize, layout, findBox, toggleState } = await import('../dist/index.js')
    const t = new Toggle({ name: 'arrow', group: 'g', index: 1, size: [20, 10], enabled: toggleState('page0'), lockedVisible: false })
    t.unchecked.add(new Label({ name: 'art', text: '→' }))
    const { json } = compileNamespace('t', { root: new Panel({ children: [t] }) })
    const tj = json.root.controls[0]['arrow@common.toggle']
    assert.equal(tj.bindings.at(-1).target_property_name, '#enabled')
    const states = Object.fromEntries(tj.controls.map((c) => Object.entries(c)[0]))
    assert.deepEqual(states.unchecked_locked.controls, [], 'lockedVisible: false → 禁用时什么都不画')
    assert.equal(states.unchecked.controls.length, 1)
    const run = (on) => layout(finalize(new Panel({ size: [100, 50], children: [t.clone()] })), { viewport: [100, 50], data: (n, src) => (src.kind === 'control' ? on : '') })
    assert.ok(findBox(run(true), 'art'))
    assert.equal(findBox(run(true), 'arrow').enabled, true)
    assert.equal(findBox(run(false), 'art'), undefined)
    assert.equal(findBox(run(false), 'arrow').enabled, false)
})

test('serverForm 多个界面：同一命名空间按标题区分；标题互为子串时报错', async () => {
    const { serverForm, Panel, Label } = await import('../dist/index.js')
    const { files } = serverForm({ namespace: 'two', panels: [{ panelId: 'cui_ui:book', content: new Panel({ children: [new Label({ text: '书' })] }) }, { panelId: 'cui_ui:pager', content: new Panel({ children: [new Label({ text: '翻页' })] }) }] })
    const root = files['ui/two.json'].root
    assert.equal(root.controls.length, 2, '两个界面面板')
    assert.equal(root[root.bindings[1].source_property_name.match(/\$\w+/)[0]], 'cui_ui:', '根面板按前缀显示')
    assert.throws(() => serverForm({ namespace: 'x', panels: [{ panelId: 'cui_ui:a', content: new Panel() }, { panelId: 'cui_ui:ab', content: new Panel() }] }), /子串/)
})

test('混合翻页：Pages 服务端页码——刚打开时按标题里的页码显示（没有页码 = 初始页）；点了开关就由开关接管', async () => {
    const { Pages, Label, Panel, finalize, layout, findBox, compileNamespace, serverForm } = await import('../dist/index.js')
    const make = () => {
        const p = new Pages({ group: 'bk', start: 'home', server: {}, size: [200, 100], anchor: 'top_left' })
        p.page('home').add(new Label({ name: 'home_t', text: '目录' }))
        p.page('sword').add(new Label({ name: 'sword_t', text: '剑' }))
        p.page('home').add(p.link('sword', { name: 'row_sword', size: [10, 10] }))
        return p
    }
    assert.equal(make().serverTag('sword'), 'P:sword;')
    // checked：哪个开关被点了（undefined = 刚打开表单，服务端锚点选中）
    const run = (title, clicked) => layout(finalize(make()), {
        viewport: [200, 100],
        toggleChecked: (n) => (clicked ? n.name === clicked : n.name === 'bk__server'),
        data: (name, src) => (src.kind === 'control' ? (clicked ? src.control === clicked : src.control === 'bk__server') : name === '#title_text' ? title : ''),
    })
    assert.ok(findBox(run('cui_ui:book', undefined), 'home_t'), '没有页码 → 初始页')
    assert.equal(findBox(run('cui_ui:book', undefined), 'sword_t'), undefined)
    assert.ok(findBox(run('cui_ui:book|P:sword;', undefined), 'sword_t'), '标题带 P:sword; → 剑那一页')
    assert.equal(findBox(run('cui_ui:book|P:sword;', undefined), 'home_t'), undefined)
    assert.ok(findBox(run('cui_ui:book|P:sword;', 'bk__home'), 'home_t'), '点了开关（例如书签回目录）→ 开关接管，忽略标题里的页码')
    const { json } = compileNamespace('t', { root: make() })
    const anchor = json.root.controls.find((c) => c['bk__server@common.toggle'])['bk__server@common.toggle']
    assert.deepEqual([anchor.$toggle_group_forced_index, anchor.$toggle_group_default_selected], [2, 2], '服务端锚点：序号 = 页数（不能用 -1），初始选中')
    const row = json.root.controls.find((c) => c.bk_home).bk_home.controls.find((c) => c['row_sword@common.toggle'])['row_sword@common.toggle']
    assert.equal(row.$toggle_group_default_selected, 2, '同组所有开关的初始选中都是服务端锚点')
    // 去掉屏幕进出场动画（缺省）
    const { files } = serverForm({ namespace: 'x', panelId: 'cui_ui:x', content: new Panel() })
    const screen = files['ui/server_form.json']['third_party_server_screen@common.base_screen']
    assert.deepEqual(screen.$screen_animations, ['@server_form.screen_exit_animation_pop_wait'])
    assert.equal(serverForm({ namespace: 'x', panelId: 'cui_ui:x', content: new Panel(), screenAnimation: true }).files['ui/server_form.json']['third_party_server_screen@common.base_screen'], undefined)
})

test('静态检查：开关序号必须是非负整数（-1 = 不强制、自动分配，会撞号）', async () => {
    const { Toggle, Panel, compileNamespace } = await import('../dist/index.js')
    const root = new Panel({ children: [new Toggle({ name: 'a', group: 'g', index: -1 }), new Toggle({ name: 'b', group: 'g', index: 1.5 })] })
    assert.deepEqual(compileNamespace('t', { root }).issues.map((i) => i.rule), ['toggle-index', 'toggle-index'])
})
