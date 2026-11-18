import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Color, compileNamespace, evalExpr, lit, ref } from '../dist/index.js'
import { LiveBar } from '../dist/internal.js'

const source = (name = '#retained', control = 'receiver') => ref(name, { kind: 'control', control })
const value = () => source().minus('cui.live|').times(1)
const compile = (bar) => {
    const out = compileNamespace('probe', { bar })
    assert.deepEqual(out.issues.filter((i) => i.level === 'error'), [])
    return out.json.bar
}
const child = (node, name) => node.controls.find((c) => c[name])[name]
const fillOf = (bar) => child(child(bar, 'unit'), 'fill')

test('LiveBar：保留 V7 SIZE 的单位容器与直接尺寸绑定，无动画、位移或小数裁剪', () => {
    const bar = compile(new LiveBar(value(), 160).setSize(160, 8))
    const unit = child(bar, 'unit'), fill = fillOf(bar)
    assert.equal(bar.clips_children, true)
    assert.deepEqual(unit.size, [1, 1])
    assert.deepEqual(fill.size, [1, 1])
    assert.equal(fill.keep_ratio, false)
    assert.deepEqual(fill.bindings, [
        { binding_type: 'view', source_control_name: 'receiver', source_property_name: '((#retained - $live0) * 1)', target_property_name: '#size_binding_x', binding_condition: 'always' },
        { binding_type: 'view', source_control_name: 'receiver', source_property_name: '((#retained = #retained) * 8)', target_property_name: '#size_binding_y', binding_condition: 'always' },
    ])
    assert.equal(fill.$live0, 'cui.live|')
    assert.ok(!/anim_type|anchored_offset|clip_ratio|#cui_receiver/.test(JSON.stringify(bar)))
})

test('LiveBar：先乘后除，与整数运算语义一致；倒退与跳变均由当前值直接决定', () => {
    const v = value(), W = 160, max = 100
    const bar = compile(new LiveBar(v, max).setSize(W, 8))
    assert.equal(fillOf(bar).bindings[0].source_property_name, '((((#retained - $live0) * 1) * 160) / 100)')
    for (const [p, expected] of [[0, 0], [1, 1], [25, 40], [100, 160], [40, 64], [0, 0]]) {
        assert.equal(evalExpr(v.times(W).div(max), { ref: () => `cui.live|${p}` }), expected)
    }
})

test('LiveBar：拒绝没有稳定来源、混合控件/集合/全局与不合法范围或尺寸', () => {
    for (const v of [12, lit(12), source().plus(ref('#global')), source().plus(source('#other', 'other')), ref('#item', { kind: 'collection', collection: 'items' }), ref('#x', { kind: 'control', control: 'receiver', siblingScope: true })]) {
        assert.throws(() => new LiveBar(v, 160), /同一个控件/)
    }
    for (const max of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => new LiveBar(value(), max), /正整数/)
    for (const size of [undefined, [0, 8], [-1, 8], [160.5, 8], ['100%', 8]]) {
        const b = new LiveBar(value(), 160)
        if (size) b.setSize(...size)
        assert.throws(() => compile(b), /正整数像素尺寸/)
    }
})

test('LiveBar：重复编译、克隆与修改尺寸/颜色不残留旧结构，关闭底色仍保持单位尺寸', () => {
    const b = new LiveBar(value(), 160).setSize(160, 8).setFill(Color.WHITE).setTrack(Color.BLACK)
    const original = compile(b)
    assert.deepEqual(compile(b), original)
    const copy = b.clone().setSize(80, 4).setFill(Color.BLACK).setTrack(undefined)
    const changed = compile(copy)
    assert.equal(changed.controls.length, 1)
    assert.deepEqual(fillOf(changed).color, [0, 0, 0])
    assert.match(fillOf(changed).bindings[0].source_property_name, /\* 80\) \/ 160/)
    assert.match(fillOf(changed).bindings[1].source_property_name, /\* 4\)/)
    assert.deepEqual(compile(b), original)
})
