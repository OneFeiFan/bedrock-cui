// 绑定表达式：编译成 JSON UI 字符串 / 预览求值（node --test tests/）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileExpr, evalExpr, toggleState, lit, variable } from '../dist/index.js'
import { form } from '../dist/internal.js'

test('编译：包含判断、字面量提升成变量、全局绑定声明', () => {
    const c = compileExpr(form.text.contains("ITM:3;"))
    assert.equal(c.text, '(not ((#form_text - $v0) = #form_text))')
    assert.deepEqual(c.variables, { $v0: 'ITM:3;' })
    assert.deepEqual(c.globals, ['#form_text'])
    // 含单引号的字面量也安全（提升成变量）
    assert.deepEqual(compileExpr(form.text.eq("it's")).variables, { $v0: "it's" })
    // 同一字面量复用同一个变量
    assert.equal(compileExpr(form.text.minus('a').plus('a')).text, '((#form_text - $v0) + $v0)')
})

test('编译：集合引用与控件引用（先读进局部属性）', () => {
    const c = compileExpr(form.buttonText.minus('l3|'))
    assert.deepEqual(c.collections, [{ collection: 'form_buttons', name: '#form_button_text' }])
    const t = compileExpr(toggleState('tab_a').and(toggleState('tab_b').not()))
    assert.equal(t.text, '(#cui_tab_a_toggle_state and (not #cui_tab_b_toggle_state))')
    assert.equal(t.controls.length, 2)
    assert.equal(compileExpr(variable('x').gt(3)).text, '($x > 3)')
    assert.equal(compileExpr(lit(true)).text, 'true')
})

test('求值：按 JSON UI 语义（字符串减法去掉所有出现、拼接、比较、逻辑）', () => {
    const env = (text, btn = '') => ({ ref: (name) => (name === '#form_text' ? text : btn) })
    assert.equal(evalExpr(form.text.contains('ITM:3;'), env('ITM:3;|耐久 250')), true)
    assert.equal(evalExpr(form.text.contains('ITM:3;'), env('ITM:31;|')), false, '分号结尾的标记不会误中')
    assert.equal(evalExpr(form.text.minus('ab'), env('xabyab')), 'xy')
    assert.equal(evalExpr(form.buttonText.minus('l0|'), env('', 'l0|耐久 250')), '耐久 250')
    assert.equal(evalExpr(form.text.isEmpty().not(), env('')), false)
    assert.equal(evalExpr(lit(2).plus(3).times(2), env('')), 10)
})
