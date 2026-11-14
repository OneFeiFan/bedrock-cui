/**
 * 预览：开关翻页测试书（examples/toggle-book.mjs，与真机测试包同一份代码）。
 * 表单正文、按钮文字与真机脚本发的一样；点开关在客户端翻页，不经过「服务端」。
 */
import { signal } from 'cui'
import { mountDevtools, mountPreview, type PreviewTexture } from 'cui/web'
// @ts-ignore 示例是纯 JS
import { buildBook, ARROWS, FORM, T, TEXTURE_INFO } from '../examples/toggle-book.mjs'
import { mountResponsive } from './responsive'

// ?demo=responsive：响应式布局演示；否则：开关翻页测试书
const DEMO = new URLSearchParams(location.search).get('demo')
// ?scale=5：预览的界面缩放（与游戏「界面缩放」一致时可以和游戏截图逐像素对比；缺省 3）
const SCALE = Math.max(1, Math.min(8, Number(new URLSearchParams(location.search).get('scale')) || 3))

const FILE: Record<string, string> = {
    [T.book]: 'book', [T.line]: 'line', [T.rowHover]: 'row_hover', [T.arrowL]: 'arrow_left', [T.arrowLH]: 'arrow_left_hover',
    [T.arrowR]: 'arrow_right', [T.arrowRH]: 'arrow_right_hover', [T.tab]: 'tab', [T.tabHover]: 'tab_hover',
    [T.cell]: 'cell_image', [T.highlight]: 'highlight_slot', [T.purple]: 'purpleBorder',
    [T.sword]: 'diamond_sword', [T.diamond]: 'diamond', [T.stick]: 'stick', [T.book_item]: 'book_normal',
    [T.ruler]: 'ruler', [T.paper]: 'paper', [T.name_tag]: 'name_tag', [T.map]: 'map_empty', [T.writable]: 'book_writable', [T.emerald]: 'emerald',
}
const textures: Record<string, PreviewTexture> = Object.fromEntries(Object.entries(FILE).map(([p, f]) => [p, { url: `./textures/${f}.png`, ...TEXTURE_INFO[p] }]))

function mountBook(): void {
    const book = buildBook()
    // 表单按钮：0–5 与真机脚本相同，6–9 空，10 起是翻页箭头（服务端翻页）；与真机脚本同一套逻辑：
    // 箭头文字 goN|，新页面上「刚才点击方向」的箭头加 F（聚焦版显示）
    type Arrow = { index: number, from: string, target: string, dir: string }
    const arrows = ARROWS as Arrow[]
    const buttonsFor = (here: string, dir: string) => {
        const b = [...FORM.buttons, '', '', '', '']
        for (const a of arrows) b[a.index] = `go${a.index}|` + (a.from === here && a.dir === dir ? 'F' : '')
        b[8] = 'od|§7耐久 1561\n§7可附魔：锋利 V、耐久 III\n§8（这段来自 8 号表单按钮）'
        b[9] = 'stay|'
        return b
    }
    const routes = Object.fromEntries(arrows.map((a) => [a.index, a]))
    // 标题 = <界面 id>|P:<页名>;（静态界面的服务端分页）
    const title = signal(`${FORM.title}|P:home;`)
    const formText = signal(FORM.body)
    const formButtons = signal(buttonsFor('home', 'right'))
    const preview = mountPreview(document.getElementById('app')!, {
        root: book, viewport: [300, 220], scale: SCALE, textures,
        formText, formButtons, title,
        // 模拟服务端：翻页箭头 → 重新打开表单（标题带 P:<页>;、开关回到初始状态）
        onFormButton: (i) => {
            const a = routes[i]
            // 模拟服务端重开：标题换成那一页，开关回到初始状态（锚点选中 → 按标题显示）
            if (a) { title.value = `${FORM.title}|P:${a.target};`; formButtons.value = buttonsFor(a.target, a.dir); preview.resetToggles() }
            else console.log('表单按钮', i, '（真机里这会关掉表单，服务端收到选择）')
        },
        // 像素字体（scripts/fetch-fonts.mjs 准备）：照游戏画文字
        fonts: { unifont: './font/unifont.hex.gz', ascii: './font/ascii.png' },
    })
    mountDevtools(document.getElementById('devtools')!, preview)
    ;(window as any).__cui = { preview, formText, title }
}

if (DEMO === 'responsive') mountResponsive(document.getElementById('app')!, document.getElementById('devtools')!)
else mountBook()
