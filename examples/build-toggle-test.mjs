/**
 * 构建真机测试包 cui_toggle_test.mcaddon（资源包 + 行为包）——全部交给库的 CuiApp：挂界面、导出翻页路由、字形图、清单与 UUID、运行时、.mcaddon、脚本类型检查。
 *   node examples/build-toggle-test.mjs [输出目录]
 * 游戏里：手持书（minecraft:book）右键 = 测试书（静态界面、混合翻页）；纸（minecraft:paper）= 响应式演示。也可以 /scriptevent cui:open、cui:responsive。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CuiApp } from 'bedrock-cui/node'
import { buildBook, FORM, GLYPHS, T, TEXTURE_INFO } from './toggle-book.mjs'
import { buildResponsiveDemo, RESPONSIVE_FORM } from './responsive-demo.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outRoot = path.resolve(process.argv[2] ?? path.join(here, '..', 'out'))
const NAME = 'cui_toggle_test'
// 测试用的自绘贴图（preview-src/public/textures）：贴图路径 → 文件名
const src = path.join(here, '..', 'preview-src', 'public', 'textures')
const FILE = { [T.book]: 'book', [T.line]: 'line', [T.rowHover]: 'row_hover', [T.arrowL]: 'arrow_left', [T.arrowLH]: 'arrow_left_hover', [T.arrowR]: 'arrow_right', [T.arrowRH]: 'arrow_right_hover', [T.tab]: 'tab', [T.tabHover]: 'tab_hover', [T.ruler]: 'ruler', [T.teal]: 'teal_bg' }

// 两个界面同一个命名空间，按标题显示：测试书（静态界面：默认聚焦可靠）、响应式演示
const app = new CuiApp(NAME)
    .screen(FORM.title, buildBook())
    .screen(RESPONSIVE_FORM.title, buildResponsiveDemo())
    .setTextures((p) => TEXTURE_INFO[p])
    // 字形图标（emoji 页 E2）：读物品贴图、算墨迹，与代码不符就报错
    .glyphSheet(GLYPHS, (p) => path.join(src, `${FILE[p] ?? path.basename(p)}.png`))

// 行为包脚本（与在 sapdon 项目里的写法相同：运行时从 bedrock-cui/runtime 导入，翻页路由表从 ./cui.generated.js 导入）
const script = `import { ItemStack, system, world } from '@minecraft/server'
import { ActionFormData } from '@minecraft/server-ui'
import { softWrap } from 'bedrock-cui/runtime'
import { ServerPagesForm, lockCamera } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'

const TITLE_RESPONSIVE = ${JSON.stringify(RESPONSIVE_FORM.title)}
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
    return lines.join('\\\\n')
}

/** 运行期长文本（按钮 5）：玩家名 + 背包物品清单（带颜色，长度不固定） */
function inventoryText(player) {
    const inv = player.getComponent('minecraft:inventory')?.container
    const counts = new Map()
    if (inv) for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it) counts.set(it.typeId, (counts.get(it.typeId) ?? 0) + it.amount) }
    // 米黄纸上用深色：物品名深灰、数量黑、玩家名金、说明深绿
    const list = [...counts].map(([id, n]) => '§8' + id.replace('minecraft:', '') + ' §0×' + n).join('§8、')
    return '§6' + player.name + '§r 的背包（' + counts.size + ' 种物品）：\\\\n' + (list || '§8背包是空的') + '\\\\n§2这段文字由脚本在运行期生成：背包里一共 ' + counts.size + ' 种物品，其中钻石有 ' + (counts.get('minecraft:diamond') ?? 0) + ' 个，每 2 个钻石加 1 根木棍可以合成 1 把钻石剑。'
}

/**
 * 测试书：混合翻页交给库的 ServerPagesForm（按新页码重开、给刚才方向的箭头默认聚焦、「原地不动」、锁视角、翻页过程中不发聊天消息）。
 * 这里只给界面自己的表单按钮：0–3 物品格子的提示框、4 右上角关闭、5 / 7 运行期长文本（7 = 脚本软换行）、8 详情弹层
 */
const book = new ServerPagesForm(paging[${JSON.stringify(FORM.title)}])
    .setButtons((player) => ({
        ...Object.fromEntries(SLOT_ITEMS.map((id, i) => [i, 's' + i + '|' + info(player, id)])),
        4: 'close|',
        5: 'txt|' + inventoryText(player),
        7: 'txw|' + softWrap(inventoryText(player), 110),
        8: 'od|' + info(player, 'minecraft:diamond_sword') + '\\\\n§8（这段来自 8 号表单按钮）',
    }))
    .onSelect((player, index) => player.sendMessage('§a[CUI] 服务端收到表单按钮 ' + index + (index === 4 ? '（右上角 ×）' : '')))

function openResponsive(player) {
    const form = new ActionFormData().title(TITLE_RESPONSIVE).body('')
    for (const b of ${JSON.stringify(RESPONSIVE_FORM.buttons)}) form.button(b)
    form.show(player).then((r) => {
        if (r.selection === 1) player.sendMessage('§a[CUI] 查看配方：两颗钻石 + 一根木棍')
    })
}

// 上次关游戏时书还开着，视角可能还锁着
system.run(() => { for (const p of world.getAllPlayers()) lockCamera(p, false) })
world.afterEvents.itemUse.subscribe((e) => {
    if (e.source.typeId !== 'minecraft:player') return
    const id = e.itemStack.typeId
    if (id === 'minecraft:book') book.open(e.source)
    else if (id === 'minecraft:paper') openResponsive(e.source)
})
system.afterEvents.scriptEventReceive.subscribe((e) => {
    const player = world.getAllPlayers().find((p) => p.id === e.sourceEntity?.id)
    if (!player) return
    if (e.id === 'cui:open') book.open(player)
    if (e.id === 'cui:responsive') openResponsive(player)
})
`

// 打包：清单与 UUID（沿用先前的，游戏里已装的测试包仍认作同一个包）、贴图、运行时、.mcaddon、脚本类型检查
const mcaddon = await app.build({
    out: outRoot, title: 'CUI 测试包', description: 'CUI 真机测试：静态界面、混合翻页、软换行、行内图标、叠放规则', version: [1, 31, 0],
    uuidFile: path.join(here, `${NAME}.uuid.json`), scripts: { 'main.js': script },
    resources: Object.fromEntries(Object.entries(FILE).map(([tex, file]) => [`${tex}.png`, path.join(src, `${file}.png`)])),
})
console.log('输出：', mcaddon, fs.statSync(mcaddon).size, '字节')
