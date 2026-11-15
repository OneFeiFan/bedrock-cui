import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { Image, Pages, compileNamespace } from '../dist/index.js'
import { Addon } from '../dist/node/index.js'

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

test('附加包：清单（RP、带脚本的 BP 依赖 RP 与脚本模块）、UUID 存进文件且下次不变、.mcaddon 是标准 zip（unzip -t 校验）、运行时放进行为包', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-addon-'))
    const uuidFile = path.join(dir, 'cui.uuid.json')
    const make = () => {
        const a = new Addon('demo').setTitle('演示').setVersion(1, 2, 3).useUuidFile(uuidFile).setScript().addRuntime()
        a.resources.add('ui/demo.json', { namespace: 'demo' }).add('texts/zh_CN.lang', '名字=值')
        a.behavior.add('scripts/main.js', "import { softWrap } from './cui/runtime/index.js'\n")
        return a
    }
    const first = make(), m = first.manifests()
    assert.equal(m.rp.header.name, '演示 RP')
    assert.deepEqual(m.rp.header.version, [1, 2, 3])
    assert.equal(m.bp.modules[0].type, 'script')
    assert.deepEqual(m.bp.dependencies.map((d) => d.module_name ?? d.uuid), ['@minecraft/server', '@minecraft/server-ui', m.rp.header.uuid])
    const file = first.pack(dir)
    assert.ok(fs.existsSync(uuidFile))
    assert.equal(make().manifests().rp.header.uuid, m.rp.header.uuid, '第二次构建 UUID 不变')
    const listing = execSync(`unzip -t ${JSON.stringify(file)}`, { encoding: 'utf8' })
    assert.match(listing, /No errors detected/)
    const names = execSync(`unzip -Z1 ${JSON.stringify(file)}`, { encoding: 'utf8' }).trim().split('\n')
    for (const f of ['demo_RP/manifest.json', 'demo_RP/ui/demo.json', 'demo_BP/manifest.json', 'demo_BP/scripts/main.js', 'demo_BP/scripts/cui/runtime/index.js', 'demo_BP/scripts/cui/runtime/serverPages.js', 'demo_BP/scripts/cui/font/unifontWidths.js'])
        assert.ok(names.includes(f), f)
    assert.equal(execSync(`unzip -p ${JSON.stringify(file)} demo_RP/texts/zh_CN.lang`, { encoding: 'utf8' }), '名字=值', 'UTF-8 内容原样')
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
