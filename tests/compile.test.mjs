// 编译器与静态检查
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Panel, Image, Label, FormButton, FormGate, compileNamespace, form } from '../dist/index.js'

test('动态文字：text = "#text"、声明 #form_text、字面量提升成变量', () => {
    const { json } = compileNamespace('t', { props: new Label({ text: form.text.minus('ITM:3;|') }) })
    assert.deepEqual(json.props, {
        type: 'label', text: '#text', layer: 1,
        bindings: [{ binding_name: '#form_text' }, { binding_type: 'view', source_property_name: '(#form_text - $t0_0)', target_property_name: '#text' }],
        $t0_0: 'ITM:3;|',
    })
})

test('FormButton：正方形网格 + grid_position + 内层负偏移；按钮继承 common.button；前缀门控与运行期数据', () => {
    const fb = new FormButton({ index: 4, tag: 'l0|', size: [116, 18] })
    fb.hover.add(new Image({ texture: 'hl', keepRatio: false, size: ['100%', '100%'] }))
    fb.add(new Label({ name: 'info', text: fb.payload() }))
    const { json, issues } = compileNamespace('t', { row: fb })
    assert.deepEqual(issues, [])
    const grid = json.row.controls[0].grid
    assert.deepEqual([grid.type, grid.collection_name, grid.grid_dimensions, grid.size], ['grid', 'form_buttons', [1, 1], [116, 116]])
    const item = grid.controls[0].grid_item_004
    assert.deepEqual(item.grid_position, [0, 4])
    const cell = item.controls[0].cell
    assert.deepEqual(cell.offset, ['0%', '-400%'])
    const btn = cell.controls[0]['button@common.button']
    assert.equal(btn.$pressed_button_name, 'button.form_button_click')
    assert.deepEqual(btn.bindings.map((b) => b.binding_type ?? 'global'), ['collection_details', 'collection', 'view'])
    assert.equal(btn.bindings[2].source_property_name, '(not ((#form_button_text - $v0_0) = #form_button_text))')
    assert.deepEqual(btn.controls.map((c) => Object.keys(c)[0]), ['default', 'hover', 'pressed', 'info'])
    assert.equal(btn.controls[1].hover.controls[0].image0.keep_ratio, false)
    assert.deepEqual(btn.controls[2].pressed, btn.controls[1].hover, '按下态没写内容 → 沿用悬停态')
    assert.equal(btn.controls[3].info.bindings[2].source_property_name, '(#form_button_text - $t0_0)')
})

test('输出可复现；FormGate 编译成按正文显示的面板', () => {
    const make = () => new FormGate({ tag: 'HOME|p0;' }).add(new Label({ text: '目录' }))
    assert.deepEqual(compileNamespace('t', { page: make() }).json, compileNamespace('t', { page: make() }).json)
    assert.equal(compileNamespace('t', { page: make() }).json.page.bindings[1].source_property_name, '(not ((#form_text - $v0_0) = #form_text))')
})

test('静态检查：keep_ratio、集合引用越界、collection_index、重名、坏尺寸', () => {
    const textures = (p) => ({ 'tex/px': { size: [1, 1] } })[p]
    const root = new Panel({ size: [100, 20] })
    root.add(
        new Image({ name: 'stretch', texture: 'tex/px', size: [116, 18] }),
        new Image({ name: 'ok', texture: 'tex/px', size: [116, 18], keepRatio: false }),
        new Image({ name: 'square', texture: 'tex/px', size: [18, 18] }),
        new Label({ name: 'oops', text: form.buttonText }),
        new Panel({ name: 'dup' }), new Panel({ name: 'dup' }),
        new Panel({ name: 'ci', raw: { collection_index: 3 } }),
        new Panel({ name: 'bad', size: ['100% ? 3', 10] }))
    const { issues } = compileNamespace('t', { root }, { textures })
    const rules = issues.map((i) => `${i.rule}@${i.path.split('/').pop()}`).sort()
    assert.deepEqual(rules, ['bad-size@bad', 'collection-index@ci', 'collection-ref-outside@oops', 'duplicate-name@dup', 'keep-ratio@stretch'])
})
