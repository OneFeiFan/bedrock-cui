// 真机测试包的行为包脚本：手持书 = 测试书，纸 = 响应式演示（也可以 /scriptevent cui:open、cui:responsive）
import { ItemStack, system, world } from '@minecraft/server'
import { ActionFormData } from '@minecraft/server-ui'
import { softWrap } from 'bedrock-cui/runtime'
import { ServerPagesForm, lockCamera } from 'bedrock-cui/internal/server-pages'
import { paging } from './cui.generated.js'
import propsDemo from '../ui/props-demo.screen.mjs'
import animLab from '../ui/anim-lab.screen.mjs'
import progressLab from '../ui/progress-lab.screen.mjs'
import measureLab from '../ui/measure-lab.screen.mjs'
import compareLab from '../ui/compare-lab.screen.mjs'
import timerLab from '../ui/timer-lab.screen.mjs'
import pagesLab from '../ui/pages-lab.screen.mjs'
import { screenRuntime } from 'bedrock-cui/runtime/screens'

const TITLE_RESPONSIVE = "cui_ui:responsive"
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
    return '§6' + player.name + '§r 的背包（' + counts.size + ' 种物品）：\\n' + (list || '§8背包是空的') + '\\n§2这段文字由脚本在运行期生成：背包里一共 ' + counts.size + ' 种物品，其中钻石有 ' + (counts.get('minecraft:diamond') ?? 0) + ' 个，每 2 个钻石加 1 根木棍可以合成 1 把钻石剑。'
}

/**
 * 测试书：混合翻页交给库的 ServerPagesForm（按新页码重开、给刚才方向的箭头默认聚焦、「原地不动」、锁视角、翻页过程中不发聊天消息）。
 * 这里只给界面自己的表单按钮：0–3 物品格子的提示框、4 右上角关闭、5 / 7 运行期长文本（7 = 脚本软换行）、8 详情弹层
 */
const book = new ServerPagesForm(paging["cui_ui:toggle_test"])
    .setButtons((player) => ({
        ...Object.fromEntries(SLOT_ITEMS.map((id, i) => [i, 's' + i + '|' + info(player, id)])),
        4: 'close|',
        5: 'txt|' + inventoryText(player),
        7: 'txw|' + softWrap(inventoryText(player), 110),
        8: 'od|' + info(player, 'minecraft:diamond_sword') + '\\n§8（这段来自 8 号表单按钮）',
        // 按钮图标测试（1.32.0）：button(文字, 图标路径)，界面里 Image(form.buttonTexture) 显示
        9: { text: 'ico|钻石（原版物品）', icon: 'textures/items/diamond' },
        10: { text: 'ico|草方块（原版方块）', icon: 'textures/blocks/grass_side_carried' },
        11: { text: 'ico|书本（本包贴图）', icon: 'textures/cui_test/book' },
        12: 'ico|没有图标',
    }))
    .onSelect((player, index) => player.sendMessage('§a[CUI] 服务端收到表单按钮 ' + index + (index === 4 ? '（右上角 ×）' : '')))

function openResponsive(player) {
    const form = new ActionFormData().title(TITLE_RESPONSIVE).body('')
    for (const b of ["cancel|","recipe|"]) form.button(b)
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
    if (e.id === 'cui:props') propsDemo.open(player)              // 不传 props：item 取默认值
    // 诊断（1.43.0）：出现异常后关掉表单，/scriptevent cui:dump 打印运行时最近的记录（时间为毫秒的后 5 位）
    if (e.id === 'cui:dump') {
        const lines = screenRuntime.trace().slice(-40)
        player.sendMessage(`§e[运行时记录] 最近 ${lines.length} 条：`)
        for (const l of lines) player.sendMessage(l)
    }
})

// ───── 界面模型：defineScreen 的界面由运行时打开（导入 ./cui.generated.js 时已登记清单） ─────
// 事件总线：界面中 this.emit('hello', 次数) → 播放音效，每满 5 次给一颗绿宝石（和游戏打交道的事留在脚本里）
propsDemo.on('hello', (player, n) => {
    player.playSound('random.orb')
    if (n % 5 === 0) player.getComponent('minecraft:inventory')?.container?.addItem(new ItemStack('minecraft:emerald', 1))
})

// 钟右键：动画实验（1.44.0）
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:clock') animLab.open(e.source) })
// 纸右键：页面实验（1.59.0）
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:paper') pagesLab.open(e.source) })
// 紫水晶碎片右键：计时实验（1.58.0）
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:amethyst_shard') timerLab.open(e.source) })
// 红石粉右键：比较运算实验（1.55.0）
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:redstone') compareLab.open(e.source) })
// 望远镜右键：测量实验（1.49.0）
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:spyglass') measureLab.open(e.source) })
// 指南针右键：进度实验（1.48.0）
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:compass') progressLab.open(e.source) })

// 绿宝石右键：脚本传入 item（其余 props 由界面中的 computed 计算）
world.afterEvents.itemUse.subscribe((e) => {
    if (e.itemStack.typeId === 'minecraft:emerald') propsDemo.open(e.source, { item: { text: '绿宝石（脚本传入）', icon: 'textures/items/emerald' } })
})
