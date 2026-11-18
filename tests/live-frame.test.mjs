import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileExpr, evalExpr, ref } from '../dist/index.js'
import { LIVE_FRAME_MAX, LiveFrameCodec, LiveFrameSender, liveFrameFields, livePixels } from '../dist/internal.js'

const schema = { pixels: { max: 160 }, phase: { max: 4 }, seconds: { max: 60 }, detail: { max: 1 } }
const initial = { pixels: 0, phase: 0, seconds: 60, detail: 0 }

test('数值帧：编码与 JSON UI 整数表达式一致，低位进位不会串改其他字段', () => {
    const codec = new LiveFrameCodec(schema)
    const packed = ref('#retained', { kind: 'control', control: 'receiver' }).minus('cui.live|').times(1)
    const fields = liveFrameFields(codec, packed)
    for (let pixels = 0; pixels <= 160; pixels++) for (let phase = 0; phase <= 4; phase++) {
        for (const seconds of [0, 1, 59, 60]) for (const detail of [0, 1]) {
            const expected = { pixels, phase, seconds, detail }
            const n = codec.encode(expected)
            assert.deepEqual(codec.decode(n), expected)
            const env = { ref: () => `cui.live|${n}` }
            assert.deepEqual(Object.fromEntries(Object.entries(fields).map(([k, e]) => [k, evalExpr(e, env)])), expected)
        }
    }
    assert.equal(codec.maxValue, 98209)
    for (const expr of Object.values(fields)) {
        const c = compileExpr(expr)
        assert.equal(c.controls.length, 1)
        assert.ok(!c.text.includes('%'), 'UI 解码不依赖未经真机确认的取模运算符')
    }
})

test('数值帧：数值限制范围、负数范围、容量边界及坏输入', () => {
    const codec = new LiveFrameCodec({ temperature: { min: -10, max: 10 }, flag: { max: 1 } })
    assert.deepEqual(codec.decode(codec.encode({ temperature: -100, flag: 99 })), { temperature: -10, flag: 1 })
    assert.deepEqual(codec.decode(codec.encode({ temperature: 2.9, flag: 0 })), { temperature: 2, flag: 0 })
    const full = new LiveFrameCodec({ value: { max: LIVE_FRAME_MAX } })
    assert.equal(full.encode({ value: LIVE_FRAME_MAX }), LIVE_FRAME_MAX)
    for (const bad of [{}, { x: { max: Infinity } }, { x: { min: 1, max: 0 } }, { x: { max: LIVE_FRAME_MAX }, y: { max: 1 } }]) {
        assert.throws(() => new LiveFrameCodec(bad))
    }
    for (const bad of [{ temperature: NaN, flag: 0 }, { temperature: 0 }, { temperature: 0, flag: 0, missing: 1 }]) assert.throws(() => codec.encode(bad))
    for (const bad of [-1, 0.5, NaN, Infinity, codec.maxValue + 1]) assert.throws(() => codec.decode(bad))
    const expr = liveFrameFields(codec, ref('#n')).temperature
    for (const temperature of [-10, -1, 0, 10]) {
        assert.equal(evalExpr(expr, { ref: () => codec.encode({ temperature, flag: 1 }) }), temperature)
    }
})

test('发送器：合并为完整最新帧、跳过同值及窗口内回退，不拆开相关字段', () => {
    const codec = new LiveFrameCodec(schema), sent = []
    const sender = new LiveFrameSender(codec, initial, (n) => sent.push(codec.decode(n)), { minIntervalTicks: 4 })
    assert.equal(sender.flush(0), true)
    sender.update({ pixels: 10, phase: 1 })
    sender.update({ pixels: 20, seconds: 50 })
    assert.equal(sender.flush(2), false)
    assert.equal(sender.flush(4), true)
    assert.deepEqual(sent.at(-1), { pixels: 20, phase: 1, seconds: 50, detail: 0 })
    sender.update({ pixels: 21 })
    sender.update({ pixels: 20 })
    assert.equal(sender.flush(8), false)
    assert.equal(sender.flush(1000), false, '稳定时无周期心跳或重复发送')
    sender.update({ pixels: 999, seconds: -1 })
    assert.equal(sender.flush(1001), true)
    assert.deepEqual(sent.at(-1), { pixels: 160, phase: 1, seconds: 0, detail: 0 })
    const saved = sender.state
    assert.throws(() => sender.update({ pixels: 5, seconds: NaN }))
    assert.throws(() => sender.update({ unknown: 1 }))
    assert.deepEqual(sender.state, saved, '整帧验证失败时没有部分写入')
    saved.pixels = -10
    assert.equal(sender.state.pixels, 160, '外部修改返回值不能绕过去重和范围检查')
})

test('发送器：失败保留最新状态、同刻限频、UI 重建后重发完整快照、停止后不再发送', () => {
    const codec = new LiveFrameCodec({ pixels: { max: 160 } }), sent = []
    let fail = true
    const sender = new LiveFrameSender(codec, { pixels: 0 }, (n) => { if (fail) throw Error('busy'); sent.push(n) })
    assert.throws(() => sender.flush(0), /busy/)
    fail = false
    sender.update({ pixels: 40 })
    assert.equal(sender.flush(0), false)
    assert.equal(sender.flush(1), false)
    assert.equal(sender.flush(2), true)
    sender.requestSnapshot()
    assert.equal(sender.flush(2), false)
    assert.equal(sender.flush(4), true)
    assert.deepEqual(sent, [40, 40])
    assert.equal(sender.sentCount, 2)
    sender.stop()
    sender.update({ pixels: 80 })
    sender.requestSnapshot()
    assert.equal(sender.flush(999), false)
    assert.equal(sender.sentCount, 2)
})

test('像素投影：越界不产生屏外宽度，1200 tick 的 160px 单字段进度最多发送 161 次', () => {
    assert.equal(livePixels(-1, 100, 160), 0)
    assert.equal(livePixels(101, 100, 160), 160)
    assert.equal(livePixels(40.1, 100, 160), 64)
    assert.equal(livePixels(40.2, 100, 160), 64)
    assert.throws(() => livePixels(NaN, 100, 160))
    assert.throws(() => livePixels(10, 0, 160))
    const sender = new LiveFrameSender(new LiveFrameCodec({ pixels: { max: 160 } }), { pixels: 0 }, () => {})
    for (let tick = 0; tick <= 1200; tick++) {
        sender.update({ pixels: livePixels(tick, 1200, 160) })
        sender.flush(tick)
    }
    assert.equal(sender.sentCount, 161)
    for (let tick = 1201; tick <= 2400; tick++) sender.flush(tick)
    assert.equal(sender.sentCount, 161, '长时间暂停没有新发送')
})
