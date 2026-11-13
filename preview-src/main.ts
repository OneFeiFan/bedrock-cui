/**
 * 预览：开关翻页测试书（examples/toggle-book.mjs，与真机测试包同一份代码）。
 * 表单正文、按钮文字与真机脚本发的一样；点开关在客户端翻页，不经过「服务端」。
 */
import { signal } from 'cui'
import { mountDevtools, mountPreview, type PreviewTexture } from 'cui/web'
// @ts-ignore 示例是纯 JS
import { buildBook, FORM, T, TEXTURE_INFO } from '../examples/toggle-book.mjs'

const FILE: Record<string, string> = {
    [T.book]: 'book', [T.line]: 'line', [T.rowHover]: 'row_hover', [T.arrowL]: 'arrow_left', [T.arrowLH]: 'arrow_left_hover',
    [T.arrowR]: 'arrow_right', [T.arrowRH]: 'arrow_right_hover', [T.tab]: 'tab', [T.tabHover]: 'tab_hover',
    [T.cell]: 'cell_image', [T.highlight]: 'highlight_slot', [T.purple]: 'purpleBorder',
    [T.sword]: 'diamond_sword', [T.diamond]: 'diamond', [T.stick]: 'stick', [T.book_item]: 'book_normal',
    [T.ruler]: 'ruler', [T.paper]: 'paper', [T.name_tag]: 'name_tag', [T.map]: 'map_empty', [T.writable]: 'book_writable', [T.emerald]: 'emerald',
}
const textures: Record<string, PreviewTexture> = Object.fromEntries(Object.entries(FILE).map(([p, f]) => [p, { url: `./textures/${f}.png`, ...TEXTURE_INFO[p] }]))

const book = buildBook()
const preview = mountPreview(document.getElementById('app')!, {
    root: book, viewport: [300, 190], scale: 3, textures,
    formText: signal(FORM.body), formButtons: signal(FORM.buttons), title: signal(FORM.title),
    onFormButton: (i) => console.log('表单按钮', i, '（真机里这会关掉表单，服务端收到选择）'),
    // 像素字体（scripts/fetch-fonts.mjs 准备）：照游戏画文字
    fonts: { unifont: './font/unifont.hex.gz', ascii: './font/ascii.png' },
})
mountDevtools(document.getElementById('devtools')!, preview)
;(window as any).__cui = { preview }
