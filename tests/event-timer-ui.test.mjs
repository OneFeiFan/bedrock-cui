import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Color } from '../dist/index.js'
import { eventTimerBarParts } from '../dist/internal.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/event-timer-v11.json', import.meta.url), 'utf8'))
const child = (node, key) => node.controls.find((c) => c[key])[key]

test('事件计时 UI：完整保留用户确认的 V11 动画、尺寸、颜色、作用域和绑定，未引入裁剪或动态偏移', () => {
    const parts = eventTimerBarParts(fixture.namespace, { receiverName: fixture.receiver, width: fixture.width, height: fixture.height })
    const grow = child(fixture.event_bar, 'local_unit'), shrink = child(fixture.event_bar, 'left_unit')
    assert.deepEqual({ ...parts.grow, offset: grow.offset }, grow)
    assert.deepEqual({ ...parts.shrink, offset: shrink.offset }, shrink)
    const track = { ...child(fixture.event_bar, 'grow_track') }
    delete track.offset
    assert.deepEqual(parts.track, track)
    assert.deepEqual(parts.animations, { grow_remaining: fixture.grow_remaining, shrink_remaining: fixture.shrink_remaining })
    assert.ok(!/clips_children|anchored_offset/.test(JSON.stringify(parts)))
})

test('事件计时 UI：替换宽高与颜色时仍保留剩余段终点，非法输入提前报错', () => {
    const parts = eventTimerBarParts('timer_ui', { receiverName: 'receiver', width: 320, height: 10, fill: Color.WHITE, track: Color.BLACK })
    assert.deepEqual(parts.track.size, [320, 10])
    assert.deepEqual(parts.track.color, [0, 0, 0])
    const stack = child(parts.grow, 'growing_stack')
    assert.deepEqual(child(stack, 'completed').color, [1, 1, 1])
    const span = child(stack, 'remaining')
    assert.ok(span.bindings[0].source_property_name.startsWith('(320 - '))
    assert.equal(span.bindings[1].source_property_name, '((#cui_retained = #cui_retained) * 10)')
    assert.deepEqual(parts.animations.grow_remaining.to, ['100%', '100%'])
    for (const options of [{ receiverName: '' }, { receiverName: 'r', width: 0 }, { receiverName: 'r', height: 0.5 }, { receiverName: 'r', fill: '#34d399' }]) {
        assert.throws(() => eventTimerBarParts('timer_ui', options))
    }
})
