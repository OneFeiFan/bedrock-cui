import { test } from 'node:test'
import assert from 'node:assert/strict'
import { retryForm } from '../dist/runtime/formRetry.js'

const busy = { canceled: true, cancelationReason: 'UserBusy' }

test('表单重试：只重试 UserBusy，遵守次数上限；成功、玩家关闭与后续异常原样返回', async () => {
    let shows = 0, waits = 0, notices = 0
    assert.equal(await retryForm(async () => { shows++; return busy }, async () => { waits++ }, 2, () => notices++), busy)
    assert.deepEqual([shows, waits, notices], [3, 2, 2])
    for (const result of [{ canceled: false, selection: 0 }, { canceled: true, cancelationReason: 'UserClosed' }]) {
        let tries = 0
        assert.equal(await retryForm(async () => { tries++; return result }, async () => assert.fail('不应等待')), result)
        assert.equal(tries, 1)
    }
    let tries = 0
    await assert.rejects(retryForm(async () => { if (++tries === 1) return busy; throw new Error('show failed') }, async () => { }), /show failed/)
    assert.equal(tries, 2)
})

test('表单重试：请求失效后不再关闭其他表单；等待期间失效也不再显示', async () => {
    let shows = 0
    await retryForm(async () => { shows++; return busy }, async () => assert.fail('已失效，不应等待'), 30, () => assert.fail('已失效，不应再次关闭表单'), () => false)
    assert.equal(shows, 1)
    let active = true, release
    const pending = retryForm(async () => { shows++; return busy }, () => new Promise((r) => { release = r }), 30, undefined, () => active)
    await Promise.resolve()
    active = false
    release()
    assert.equal(await pending, busy)
    assert.equal(shows, 2, '等待后没有发出第二次显示请求')
})
