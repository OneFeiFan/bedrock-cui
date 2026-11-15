/**
 * 最小例子：两页的小书——服务端翻页箭头（鼠标不动也能连点）、软换行的正文、一个关闭按钮。界面、脚本、打包都在这一个文件里。
 *
 *   npm run build && node examples/hello-book.mjs [输出目录]     → <输出目录>/hello_book.mcaddon
 *
 * 游戏里：手持书（minecraft:book）右键，或 /scriptevent hello:open。
 * 不用自带贴图：背景是原版的 textures/ui/dialog_background_opaque，箭头是文字。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Anchor, Color, FormButton, Image, Label, Pages, Panel, Paragraph, Size } from 'bedrock-cui'
import { CuiApp } from 'bedrock-cui/node'

const ID = 'cui_ui:hello_book'                       // 界面 id：表单标题以它开头时显示这个界面
const outDir = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'out'))
const INK = Color.hex('#3c2814')

// ───────── 界面 ─────────

const root = new Panel().setSize(240, 150)
root.add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()))

// 分页：目录、书签这类客户端跳转用 pages.link()；翻页箭头走服务端（pages.serverArrow），脚本端由 ServerPagesForm 处理
const pages = new Pages('hb').startAt('p1').setSize(Size.full()).useServerPages()
const arrowArt = (text) => (hover) => new Label(hover ? `§e§l${text}` : `§l${text}`)
const page = (key, title, body) => pages.page(key).add(
    new Label(title).setColor(INK).setAnchor(Anchor.TOP_CENTER).setOffset(0, 10),
    // 正文：Paragraph 缺省软换行——交给游戏按当前平台的字宽排，CUI 只调整汉字与英文 / 数字交界处的间隔
    new Paragraph(body, 210).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(15, 28),
)
page('p1', '第 1 页', '这是用 CUI 做的一本小书。右下角的箭头是服务端翻页：点了以后脚本按新页码重开表单，鼠标不动也能连续点。正文由游戏按当前平台的字宽折行，PC 与手机都排得整齐。')
    .add(pages.serverArrow('p1', 'p2', 'next', arrowArt('>'), 16, 12).setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-8, -6))
page('p2', '第 2 页', '最后一页。左下角的箭头翻回去；在这一页再点「下一页」的位置，由「原地不动」按钮接住，不会跳到别处。')
    .add(pages.serverArrow('p2', 'p1', 'prev', arrowArt('<'), 16, 12).setAnchor(Anchor.BOTTOM_LEFT).setOffset(8, -6))
root.add(pages, pages.stayButton())

// 关闭：界面自己的表单按钮（序号 0；翻页按钮从 10 起，由 Pages 分配）
const close = new FormButton(0, 'close|', 12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
close.default.add(new Label('§4x'))
close.hover.add(new Label('§cx'))
root.add(close)

// ───────── 脚本（独立打包与嵌入 sapdon 时写法相同） ─────────

const script = `import { system, world } from '@minecraft/server'
import { ServerPagesForm, lockCamera } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'          // 构建时生成：界面 id → 翻页路由表

const book = new ServerPagesForm(paging['${ID}'])
    .setButtons(() => ({ 0: 'close|' }))
    .onSelect((player, index) => { if (index === 0) player.sendMessage('§7合上了书') })

system.run(() => { for (const p of world.getAllPlayers()) lockCamera(p, false) })
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:book') book.open(e.source) })
system.afterEvents.scriptEventReceive.subscribe((e) => {
    const player = world.getAllPlayers().find((p) => p.id === e.sourceEntity?.id)
    if (player && e.id === 'hello:open') book.open(player)
})
`

// ───────── 打包：挂界面、导出翻页路由、清单与 UUID、.mcaddon、脚本类型检查，一步完成 ─────────

const file = await new CuiApp('hello_book').screen(ID, root)
    .build({ out: outDir, title: 'CUI 小书', version: [1, 0, 0], scripts: { 'main.js': script } })
console.log('输出：', file)
