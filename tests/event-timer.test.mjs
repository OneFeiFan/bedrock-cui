import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Timer } from '../dist/index.js'
import { EventTimerSender, timerTitleEvent } from '../dist/internal.js'

test('事件计时器：逐 tick 检查只发送开始、界面快照、暂停、继续、完成五次', () => {
    const sent = []
    const sender = new EventTimerSender((event) => sent.push(event))
    let timer = Timer.idle(10).start(0)
    for (let now = 0; now <= 20000; now += 50) {
        if (now === 3000) sender.requestSnapshot()
        if (now === 4000) timer = timer.pause(now)
        if (now === 8000) timer = timer.resume(now)
        sender.publish(timer, now)
    }
    assert.deepEqual(sent.map((e) => [e.payload, e.options.fadeInDuration]), [
        ['cui.live|R0', 200], ['cui.live|R48', 140], ['cui.live|P64', 1], ['cui.live|R64', 120], ['cui.live|D160', 1],
    ])
    assert.equal(sender.sentCount, 5)
})

test('事件计时器：按计时锚点去重，新建等价 Timer 不会退化为逐帧发送', () => {
    const sent = []
    const sender = new EventTimerSender((e) => sent.push(e))
    for (let now = 0; now <= 20000; now += 50) {
        sender.publish(Timer.of({ seconds: 10, elapsed: now / 1000, running: true, now }), now)
    }
    assert.deepEqual(sent.map((e) => e.payload), ['cui.live|R0', 'cui.live|D160'])
})

test('事件计时器：失败可重试，停止后不发送，剩余段始终在条的实际范围内', () => {
    let fail = true
    const sent = [], timer = Timer.idle(10).start(0)
    const sender = new EventTimerSender((e) => { if (fail) throw Error('send failed'); sent.push(e) })
    assert.throws(() => sender.publish(timer, 0), /send failed/)
    fail = false
    assert.equal(sender.publish(timer, 1000), true)
    assert.equal(sent[0].payload, 'cui.live|R16')
    assert.equal(sent[0].options.fadeInDuration, 180)
    sender.stop()
    sender.requestSnapshot()
    assert.equal(sender.publish(timer, 5000), false)
    for (let pixels = 0; pixels <= 160; pixels++) {
        for (let step = 0; step <= 100; step++) {
            const completed = pixels + (160 - pixels) * step / 100
            const left = (160 - pixels) * (1 - step / 100)
            assert.ok(completed >= 0 && completed <= 160 && left >= 0 && left <= 160)
        }
    }
    assert.throws(() => timerTitleEvent(Timer.idle(Infinity), 160, 0), /finite/)
    assert.throws(() => timerTitleEvent(timer, 0, 0))
})
