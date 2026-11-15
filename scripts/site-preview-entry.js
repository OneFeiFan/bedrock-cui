/**
 * 手册网站的在线示例：把 bedrock-cui 与浏览器预览打包成一个脚本（scripts/build-site.mjs 用 Vite 构建为 assets/cui-preview.js）。
 * 页面里的示例代码从 window.CUI 取用 bedrock-cui 的导出，再调用 CUI_PREVIEW() 显示。
 * 字体只用 Unifont（英文字母也用它画——Minecraft 的 ascii.png 不能公开发布）；字宽仍按游戏的规则，折行与排版位置与游戏一致。
 */
import * as CUI from 'bedrock-cui'
import { mountPreview } from 'bedrock-cui/web'

/** 替代贴图（原版贴图是 Mojang 的资源）：由 build-site.mjs 生成在 assets/textures/ */
const STANDINS = {
    'textures/ui/dialog_background_opaque': { file: 'dialog.png', size: [16, 16], nineslice: 4 },
    'textures/ui/purpleBorder': { file: 'purple.png', size: [16, 16], nineslice: 4 },
    'textures/ui/white': { file: 'white.png', size: [2, 2] },
    'textures/items/diamond': { file: 'diamond.png', size: [16, 16] },
    'textures/items/stick': { file: 'stick.png', size: [16, 16] },
    'textures/items/diamond_sword': { file: 'sword.png', size: [16, 16] },
}

window.CUI = CUI
/** form：模拟的表单数据 { title, text, buttons } */
window.CUI_PREVIEW = (id, root, { w, h, base, form }) => {
    const el = document.getElementById(id)
    const textures = Object.fromEntries(Object.entries(STANDINS).map(([path, t]) => [path, { url: `${base}assets/textures/${t.file}`, size: t.size, ...(t.nineslice ? { nineslice: t.nineslice } : {}) }]))
    const scale = Math.max(1, Math.min(3, Math.floor((el.clientWidth || 600) / w)))
    const buttons = form?.buttons ?? []
    const data = form ? {
        title: CUI.signal(form.title ?? ''), formText: CUI.signal(form.text ?? ''),
        formButtons: CUI.signal(buttons.map((b) => (typeof b === 'string' ? b : b.text))),
        formButtonIcons: CUI.signal(buttons.map((b) => (typeof b === 'string' ? '' : b.icon ?? ''))),
    } : {}
    mountPreview(el, { root, viewport: [w, h], scale, textures, fonts: { unifont: `${base}font/unifont.hex.gz` }, ...data })
}
