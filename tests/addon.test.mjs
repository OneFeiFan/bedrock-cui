import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { Image, Pages, compileNamespace } from '../dist/index.js'
import { Addon, checkScripts } from '../dist/node/index.js'

/** 读 zip（只用 Node：Windows 上没有 unzip 命令）：按中央目录逐个解压、校验 CRC，返回 文件名 → 内容 */
function readZip(buf) {
    const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
    const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
    const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    const count = buf.readUInt16LE(end + 10)
    let p = buf.readUInt32LE(end + 16)
    const out = new Map()
    for (let i = 0; i < count; i++) {
        assert.equal(buf.readUInt32LE(p), 0x02014b50, '中央目录')
        const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24)
        const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42)
        const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8')
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
        const raw = buf.subarray(start, start + csize)
        const data = method === 8 ? zlib.inflateRawSync(raw) : raw
        assert.equal(data.length, size, name)
        assert.equal(crc32(data), crc, `${name} 的 CRC`)
        out.set(name, data)
        p += 46 + nlen + xlen + clen
    }
    return out
}

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

test('附加包：清单（RP、带脚本的 BP 依赖 RP 与脚本模块）、UUID 存进文件且下次不变、.mcaddon 是标准 zip（逐个解压校验 CRC）、运行时放进行为包', () => {
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
    const entries = readZip(fs.readFileSync(file))
    for (const f of ['demo_RP/manifest.json', 'demo_RP/ui/demo.json', 'demo_BP/manifest.json', 'demo_BP/scripts/main.js', 'demo_BP/scripts/cui/runtime/index.js', 'demo_BP/scripts/cui/runtime/serverPages.js', 'demo_BP/scripts/cui/font/unifontWidths.js'])
        assert.ok(entries.has(f), f)
    assert.equal(entries.get('demo_RP/texts/zh_CN.lang').toString('utf8'), '名字=值', 'UTF-8 内容原样')
    assert.deepEqual(JSON.parse(entries.get('demo_BP/manifest.json').toString('utf8')).header.version, [1, 2, 3])
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
        const a = new Addon(name).useUuidFile(path.join(dir, `${name}.uuid.json`)).setScript().addRuntime()
        a.behavior.add('scripts/main.js', code)
        return a.write(dir).bp
    }
    const head = "import { world } from '@minecraft/server'\nimport { ServerPagesForm } from './cui/runtime/serverPages.js'\nimport { softWrap } from './cui/runtime/index.js'\n" +
        "/** @type {import('./cui/runtime/serverPages.js').ServerPaging} */\nconst PAGING = { title: 'cui_ui:x', prefix: 'P:', start: 'a', arrows: [] }\nconst book = new ServerPagesForm(PAGING)\n"
    assert.deepEqual(await checkScripts(build('ok', head + "world.afterEvents.itemUse.subscribe((e) => book.open(e.source))\nsoftWrap('文字', 110)\n")), [])
    const bad = await checkScripts(build('bad', head + "world.afterEvents.itemUse.subscribe((e) => book.opne(e.source))\nsoftWrap('文字', '110')\n"))
    assert.equal(bad.length, 2, bad.join('\n'))
    assert.match(bad.join('\n'), /opne/)
    assert.match(bad[0], /^scripts\/main\.js:\d+:\d+ /)
})
