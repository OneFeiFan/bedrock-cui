import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Panel, Timer, defineTimerHud } from '../dist/index.js'
import { TimerHudRuntime } from '../dist/runtime/timerHudRuntime.js'
import { checkTimerHudBaseline } from '../examples/timer-hud/check-baseline.mjs'

test('V15 真机基准：主示例的表单与计时 HUD 完整控件树保持一致', checkTimerHudBaseline)
test('拒绝 V17 清单以及通道与协议不一致的清单，兼容旧版标题清单', () => {
    const options = { id: 'baseline', timers: { a: Timer.idle(1) }, view: () => new Panel() }
    const manifest = defineTimerHud(options).build('baseline').manifest
    const dual = defineTimerHud({ ...options, id: 'dual', transport: 'actionbar' }).build('baseline').manifest
    const runtime = new TimerHudRuntime({ title() {}, actionbar() {} })
    assert.throws(() => runtime.register({ dual: { ...dual, prefix: dual.prefix.replace('|v4|', '|v3|') } }), /V17.*撤回/)
    assert.throws(() => runtime.register({ dual: { ...dual, transport: undefined } }), /通道与协议不匹配/)
    assert.throws(() => runtime.register({ baseline: { ...manifest, transport: 'actionbar' } }), /通道与协议不匹配/)
    runtime.register({ baseline: manifest })
    runtime.register({ dual })
})
