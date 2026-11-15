import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Image, Pages, compileNamespace } from '../dist/index.js'
import { checkScripts, copyRuntime } from '../dist/node/index.js'


test('混合翻页（构建端）：serverArrow = 两个同序号表单按钮（优先级 10 / 带 F 的 100）；stayButton 优先级 50；serverPaging 导出路由表', () => {
    const pages = new Pages('book').startAt('home').setButtonBase(20)
    const art = (hover) => new Image(hover ? 'textures/a_h' : 'textures/a')
    const next = pages.serverArrow('home', 'p2', 'next', art, 16, 10)
    const prev = pages.serverArrow('p2', 'home', 'prev', art, 16, 10)
    const stay = pages.stayButton()
    pages.page('home').add(next); pages.page('p2').add(prev); pages.page('home').add(stay)
    assert.deepEqual(pages.serverPaging('cui_ui:book'), {
        title: 'cui_ui:book', prefix: 'P:', start: 'home', stay: 22,
        arrows: [{ index: 20, from: 'home', to: 'p2', dir: 'next' }, { index: 21, from: 'p2', to: 'home', dir: 'prev' }],
    })
    const [a, b] = next.children
    assert.deepEqual([a.props.index, b.props.index, a.button.focusPrecedence, b.button.focusPrecedence], [20, 20, 10, 100])
    assert.match(JSON.stringify(b.button.visible), /go20\|F/)
    assert.equal(stay.button.focusPrecedence, 50)
    assert.throws(() => pages.setButtonBase(30), /之前/)
    assert.deepEqual(compileNamespace('t', { root: pages }).issues.filter((i) => i.level === 'error'), [])
})

test('混合翻页的共享逻辑（脚本端 ServerPagesForm 与预览 ServerPagesPreview 共用）：按钮文字、刚才方向的箭头加 F、原地不动、翻页结果', async () => {
    const { pagingButtons, pagingResponse, pageTitle } = await import('../dist/index.js')
    const { ServerPagesPreview } = await import('../dist/web/index.js')
    const paging = { title: 'cui_ui:b', prefix: 'P:', start: 'a', stay: 12, arrows: [{ index: 10, from: 'a', to: 'b', dir: 'next' }, { index: 11, from: 'b', to: 'a', dir: 'prev' }] }
    assert.equal(pageTitle(paging, 'b'), 'cui_ui:b|P:b;')
    assert.deepEqual(pagingButtons(paging, 'a', 'next', { 0: 'close|' }), ['close|', '', '', '', '', '', '', '', '', '', 'go10|F', 'go11|', 'stay|'])
    assert.deepEqual(pagingButtons(paging, 'b', 'next').slice(10), ['go10|', 'go11|', 'stay|'], '在 b 页刚才是 next：b 页上只有 prev 箭头，不加 F（交给原地不动）')
    assert.deepEqual(pagingResponse(paging, 10, 'a', 'next'), { kind: 'turn', page: 'b', dir: 'next' })
    assert.deepEqual(pagingResponse(paging, 12, 'b', 'next'), { kind: 'stay', page: 'b', dir: 'next' })
    assert.deepEqual(pagingResponse(paging, 0, 'a', 'next'), { kind: 'own', index: 0 })
    const sim = new ServerPagesPreview(paging, () => ({ 0: 'close|' }))
    let resets = 0
    assert.equal(sim.press(10, { resetToggles: () => resets++ }), true)
    assert.deepEqual([sim.current, sim.title.value, resets], ['b', 'cui_ui:b|P:b;', 1])
    assert.equal(sim.press(0), false, '界面自己的按钮不翻页')
})

test('checkScripts：生成的脚本做类型检查——正确的通过；拼错运行时的方法、给游戏 API 传错类型都报出来', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-check-'))
    const build = (name, code) => {
        const bp = path.join(dir, name)
        copyRuntime(path.join(bp, 'scripts', 'cui'))
        fs.writeFileSync(path.join(bp, 'scripts', 'main.js'), code)
        return bp
    }
    const head = "import { world } from '@minecraft/server'\nimport { ServerPagesForm } from './cui/runtime/serverPages.js'\nimport { softWrap } from './cui/runtime/index.js'\n" +
        "/** @type {import('./cui/runtime/serverPages.js').ServerPaging} */\nconst PAGING = { title: 'cui_ui:x', prefix: 'P:', start: 'a', arrows: [] }\nconst book = new ServerPagesForm(PAGING)\n"
    assert.deepEqual(await checkScripts(build('ok', head + "world.afterEvents.itemUse.subscribe((e) => book.open(e.source))\nsoftWrap('文字', 110)\n")), [])
    const bad = await checkScripts(build('bad', head + "world.afterEvents.itemUse.subscribe((e) => book.opne(e.source))\nsoftWrap('文字', '110')\n"))
    assert.equal(bad.length, 2, bad.join('\n'))
    assert.match(bad.join('\n'), /opne/)
    assert.match(bad[0], /^scripts\/main\.js:\d+:\d+ /)
})
