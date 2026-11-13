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
import { buildBook, ARROWS, FORM, T, TEXTURE_INFO } from './toggle-book.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outRoot = path.resolve(process.argv[2] ?? path.join(here, '..', 'out'))
const VERSION = [1, 5, 4]
const UUID = { bp: '6a3f0e2c-91d4-4b7a-8c55-0e1f7a2b9c31', bpScript: 'c2e8b7d1-4f6a-4c9e-a1b2-3d4e5f607182', rp: '1f9c3a7e-2b4d-4e6f-8a90-b1c2d3e4f5a6', rpRes: '7d8e9f0a-1b2c-4d3e-9f4a-5b6c7d8e9f01' }
const NAME = 'cui_toggle_test'

// 诊断：两个变体——无动画（重定义 third_party_server_screen）/ 有动画（原版屏幕），看目录开关失灵是不是屏幕重定义导致的
const VARIANT = process.env.CUI_VARIANT ?? '无动画'
const { files, issues } = serverForm({ namespace: NAME, panelId: FORM.title, content: buildBook({ variant: VARIANT }), textures: (p) => TEXTURE_INFO[p], screenAnimation: VARIANT === '有动画' })
const ROUTES = Object.fromEntries(ARROWS.map((a) => [a.index, { target: a.target, from: a.from, dir: a.dir }]))
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
const FILE = { [T.book]: 'book', [T.line]: 'line', [T.rowHover]: 'row_hover', [T.arrowL]: 'arrow_left', [T.arrowLH]: 'arrow_left_hover', [T.arrowR]: 'arrow_right', [T.arrowRH]: 'arrow_right_hover', [T.tab]: 'tab', [T.tabHover]: 'tab_hover', [T.ruler]: 'ruler' }
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
write(path.join(bp, 'scripts', 'main.js'), `import { InputPermissionCategory, ItemStack, system, world } from '@minecraft/server'
import { ActionFormData } from '@minecraft/server-ui'

// 与界面约定：标题、正文前缀 CUI;|、按钮 0–3 = 格子 s0|…s3|（运行期数据跟在 | 后面）、按钮 4 = close|
const TITLE = ${JSON.stringify(FORM.title)}
// 翻页箭头：表单按钮序号 → { 目标页, 所在页, 方向 }（构建期从界面生成）
const ROUTES = ${JSON.stringify(ROUTES)}
const SLOT_ITEMS = ['minecraft:diamond_sword', 'minecraft:diamond', 'minecraft:diamond', 'minecraft:stick']

/** 背包里有几个 */
function count(player, id) {
    const inv = player.getComponent('minecraft:inventory')?.container
    let n = 0
    if (inv) for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it?.typeId === id) n += it.amount }
    return n
}

/** 运行期信息：耐久 + 背包数量 */
function info(player, id) {
    const lines = []
    try { const d = new ItemStack(id).getComponent('minecraft:durability'); if (d?.maxDurability) lines.push('§7耐久 ' + d.maxDurability) } catch {}
    const n = count(player, id)
    lines.push(n ? '§a背包里有 ' + n + ' 个' : '§8背包里没有')
    return lines.join('\\n')
}

/** 运行期长文本（按钮 5）：玩家名 + 背包物品清单（带颜色，长度不固定） */
function inventoryText(player) {
    const inv = player.getComponent('minecraft:inventory')?.container
    const counts = new Map()
    if (inv) for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it) counts.set(it.typeId, (counts.get(it.typeId) ?? 0) + it.amount) }
    // 米黄纸上用深色：物品名深灰、数量黑、玩家名金、说明深绿
    const list = [...counts].map(([id, n]) => '§8' + id.replace('minecraft:', '') + ' §0×' + n).join('§8、')
    return '§6' + player.name + '§r 的背包（' + counts.size + ' 种物品）：\\n' + (list || '§8背包是空的') + '\\n§2这段文字由脚本在运行期生成，长度不固定，由引擎负责折行。'
}

// 书打开期间锁视角：混合翻页每次翻页都会关表单、再打开（表单之间的空档不让视角偏转）
const camera = (player, on) => { try { player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, on) } catch {} }
system.run(() => { for (const p of world.getAllPlayers()) camera(p, true) })

/**
 * 打开测试书；page = 服务端页码（标题总是带 P:<页>;，界面按它显示那一页）；
 * dir = 默认聚焦哪个方向的箭头（给新页面上该方向箭头的按钮文字加 F → 聚焦版显示、优先级最高）
 */
function open(player, page = 'home', dir = 'right') {
    camera(player, false)
    const form = new ActionFormData().title(TITLE + '|P:' + page + ';').body('CUI;|' + info(player, 'minecraft:diamond_sword') + '\\n§8（这段来自表单正文）')
    SLOT_ITEMS.forEach((id, i) => form.button('s' + i + '|' + info(player, id)))
    form.button('close|')
    form.button('txt|' + inventoryText(player))
    const last = Math.max(...Object.keys(ROUTES).map(Number))
    const here = page
    for (let i = 6; i <= last; i++) {
        const a = ROUTES[i]
        // 9 = 「原地不动」：当前方向没有箭头时接住鼠标没动的点击
        form.button(i === 9 ? 'stay|' : a ? 'go' + i + '|' + (a.from === here && a.dir === dir ? 'F' : '') : '')
    }
    form.show(player).then((r) => {
        if (r.canceled) { camera(player, true); player.sendMessage('§7[CUI] 表单关闭（Esc）：' + (r.cancelationReason ?? '')); return }
        const a = ROUTES[r.selection]
        // 诊断：每次点击都回报收到的按钮序号与当时所在的页
        player.sendMessage('§7[CUI] 在「' + here + '」收到按钮 ' + r.selection + (a ? ' → 翻到「' + a.target + '」' : r.selection === 9 ? '（原地不动）' : r.selection === 4 ? '（右上角 ×）' : '（不是翻页按钮）'))
        if (a) return open(player, a.target, a.dir)
        if (r.selection === 9) return open(player, here, dir)
        camera(player, true)
        player.sendMessage('§a[CUI] 服务端收到表单按钮 ' + r.selection + (r.selection === 4 ? '（右上角 ×）' : ''))
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
