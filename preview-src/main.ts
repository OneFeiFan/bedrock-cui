/**
 * 预览：开关翻页测试书（examples/toggle-book.mjs，与真机测试包同一份代码）。
 * 表单正文、按钮文字与真机脚本发的一样；点开关在客户端翻页，不经过「服务端」。
 */
import { signal, setMetricsProfile } from 'bedrock-cui'
import { mountDevtools, mountPreview, type PreviewTexture, ServerPagesPreview } from 'bedrock-cui/web'
// @ts-ignore 示例是纯 JS
import { buildBook, FORM, PAGING, T, TEXTURE_INFO } from '../examples/toggle-book.mjs'
import { mountResponsive } from './responsive'

// ?demo=responsive：响应式布局演示；否则：开关翻页测试书
const DEMO = new URLSearchParams(location.search).get('demo')
// ?platform=android：按安卓字宽（汉字与全角标点 9）排版与绘制——预先看到安卓上的折行（要在构建界面之前设）
setMetricsProfile(new URLSearchParams(location.search).get('platform') === 'android' ? 'android' : 'pc')
// ?scale=5：预览的界面缩放（与游戏「界面缩放」一致时可以和游戏截图逐像素对比；缺省 3）
const SCALE = Math.max(1, Math.min(8, Number(new URLSearchParams(location.search).get('scale')) || 3))

const FILE: Record<string, string> = {
    [T.book]: 'book', [T.line]: 'line', [T.rowHover]: 'row_hover', [T.arrowL]: 'arrow_left', [T.arrowLH]: 'arrow_left_hover',
    [T.arrowR]: 'arrow_right', [T.arrowRH]: 'arrow_right_hover', [T.tab]: 'tab', [T.tabHover]: 'tab_hover',
    [T.cell]: 'cell_image', [T.highlight]: 'highlight_slot', [T.purple]: 'purpleBorder',
    [T.sword]: 'diamond_sword', [T.diamond]: 'diamond', [T.stick]: 'stick', [T.book_item]: 'book_normal',
    [T.ruler]: 'ruler', [T.teal]: 'teal_bg', [T.paper]: 'paper', [T.name_tag]: 'name_tag', [T.map]: 'map_empty', [T.writable]: 'book_writable', [T.emerald]: 'emerald',
}
const textures: Record<string, PreviewTexture> = Object.fromEntries(Object.entries(FILE).map(([p, f]) => [p, { url: `./textures/${f}.png`, ...TEXTURE_INFO[p] }]))

function mountBook(): void {
    const book = buildBook()
    // 混合翻页：库的 ServerPagesPreview（与真机脚本的 ServerPagesForm 同一套逻辑）；界面自己的表单按钮 0–8 是样例数据
    const own = (): Record<number, string> => ({ ...Object.fromEntries(FORM.buttons.map((b: string, i: number) => [i, b])), 8: 'od|§7耐久 1561\n§7可附魔：锋利 V、耐久 III\n§8（这段来自 8 号表单按钮）' })
    const sim = new ServerPagesPreview(PAGING, own)
    const formText = signal(FORM.body)
    const preview = mountPreview(document.getElementById('app')!, {
        root: book, viewport: [300, 220], scale: SCALE, textures,
        formText, formButtons: sim.formButtons, title: sim.title,
        // 翻页箭头 / 「原地不动」→ 模拟脚本重开表单；其余按钮在真机里会关掉表单、服务端收到选择
        onFormButton: (i) => { if (!sim.press(i, preview)) console.log('表单按钮', i, '（真机里这会关掉表单，服务端收到选择）') },
        // 像素字体（scripts/fetch-fonts.mjs 准备）：照游戏画文字
        fonts: { unifont: './font/unifont.hex.gz', ascii: './font/ascii.png' },
    })
    mountDevtools(document.getElementById('devtools')!, preview)
    ;(window as any).__cui = { preview, formText, title: sim.title }
}

if (DEMO === 'responsive') mountResponsive(document.getElementById('app')!, document.getElementById('devtools')!)
else mountBook()
