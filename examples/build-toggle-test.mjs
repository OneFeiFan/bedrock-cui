/**
 * 构建真机测试包：cui_toggle_test.mcaddon（资源包 + 行为包），不依赖 sapdon。
 *   node examples/build-toggle-test.mjs [输出目录]
 * 游戏里：手持书（minecraft:book）右键，或 /scriptevent cui:open
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { serverForm } from 'cui'
import { buildBook, FORM, T, TEXTURE_INFO } from './toggle-book.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outRoot = path.resolve(process.argv[2] ?? path.join(here, '..', 'out'))
const VERSION = [1, 0, 0]
const UUID = { bp: '6a3f0e2c-91d4-4b7a-8c55-0e1f7a2b9c31', bpScript: 'c2e8b7d1-4f6a-4c9e-a1b2-3d4e5f607182', rp: '1f9c3a7e-2b4d-4e6f-8a90-b1c2d3e4f5a6', rpRes: '7d8e9f0a-1b2c-4d3e-9f4a-5b6c7d8e9f01' }
const NAME = 'cui_toggle_test'

const { files, issues } = serverForm({ namespace: NAME, panelId: FORM.title, content: buildBook(), textures: (p) => TEXTURE_INFO[p] })
if (issues.some((i) => i.level === 'error')) { console.error(issues); process.exit(1) }

const bp = path.join(outRoot, `${NAME}_BP`), rp = path.join(outRoot, `${NAME}_RP`)
fs.rmSync(bp, { recursive: true, force: true }); fs.rmSync(rp, { recursive: true, force: true })
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 1)) }

// 资源包：界面 + 书本贴图（原版贴图直接引用）
write(path.join(rp, 'manifest.json'), {
    format_version: 2,
    header: { name: 'CUI 开关翻页测试 RP', description: 'CUI toggle paging test', uuid: UUID.rp, version: VERSION, min_engine_version: [1, 21, 0] },
    modules: [{ type: 'resources', uuid: UUID.rpRes, version: VERSION }],
})
for (const [rel, json] of Object.entries(files)) write(path.join(rp, rel), json)
const src = path.join(here, '..', 'preview-src', 'public', 'textures')
const FILE = { [T.book]: 'book', [T.line]: 'line', [T.rowHover]: 'row_hover', [T.arrowL]: 'arrow_left', [T.arrowLH]: 'arrow_left_hover', [T.arrowR]: 'arrow_right', [T.arrowRH]: 'arrow_right_hover', [T.tab]: 'tab', [T.tabHover]: 'tab_hover' }
for (const [tex, file] of Object.entries(FILE)) {
    fs.mkdirSync(path.join(rp, path.dirname(tex)), { recursive: true })
    fs.copyFileSync(path.join(src, `${file}.png`), path.join(rp, `${tex}.png`))
}

// 行为包：脚本打开表单
write(path.join(bp, 'manifest.json'), {
    format_version: 2,
    header: { name: 'CUI 开关翻页测试 BP', description: 'CUI toggle paging test', uuid: UUID.bp, version: VERSION, min_engine_version: [1, 21, 0] },
    modules: [{ type: 'script', language: 'javascript', uuid: UUID.bpScript, version: VERSION, entry: 'scripts/main.js' }],
    dependencies: [{ module_name: '@minecraft/server', version: '2.0.0' }, { module_name: '@minecraft/server-ui', version: '2.0.0' }, { uuid: UUID.rp, version: VERSION }],
})
write(path.join(bp, 'scripts', 'main.js'), `import { system, world } from '@minecraft/server'
import { ActionFormData } from '@minecraft/server-ui'

// 与界面约定的表单数据（examples/toggle-book.mjs 的 FORM）
const FORM = ${JSON.stringify(FORM)}

function open(player) {
    const form = new ActionFormData().title(FORM.title).body(FORM.body)
    for (const b of FORM.buttons) form.button(b)
    form.show(player).then((r) => {
        if (r.canceled) player.sendMessage('§7[CUI] 表单关闭（Esc）：' + (r.cancelationReason ?? ''))
        else player.sendMessage('§a[CUI] 服务端收到表单按钮 ' + r.selection + (r.selection === 4 ? '（右上角 ×）' : ''))
    })
}

world.afterEvents.itemUse.subscribe((e) => {
    if (e.itemStack.typeId === 'minecraft:book' && e.source.typeId === 'minecraft:player') open(e.source)
})
system.afterEvents.scriptEventReceive.subscribe((e) => {
    if (e.id === 'cui:open' && e.sourceEntity?.typeId === 'minecraft:player') open(e.sourceEntity)
})
`)

const mcaddon = path.join(outRoot, `${NAME}.mcaddon`)
fs.rmSync(mcaddon, { force: true })
execSync(`zip -qr ${JSON.stringify(mcaddon)} ${NAME}_BP ${NAME}_RP`, { cwd: outRoot })
console.log('输出：', mcaddon, fs.statSync(mcaddon).size, '字节；界面 JSON', JSON.stringify(files[`ui/${NAME}.json`]).length, '字节')
