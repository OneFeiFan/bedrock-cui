/**
 * 手册网站的在线示例：把 bedrock-cui 与浏览器预览打包成一个脚本（scripts/build-site.mjs 用 Vite 构建为 assets/cui-preview.js）。
 * 页面里的示例代码从 window.CUI 取用 bedrock-cui 的导出，再调用 CUI_PREVIEW() 显示。
 * 字体只用 Unifont（英文字母也用它画——Minecraft 的 ascii.png 不能公开发布）；字宽仍按游戏的规则，折行与排版位置与游戏一致。
 */
import * as CUI from 'bedrock-cui'
import { mountPreview, runScreenInBrowser } from 'bedrock-cui/web'

/** 替代贴图（原版贴图是 Mojang 的资源）：由 build-site.mjs 生成在 assets/textures/ */
const STANDINS = {
    'textures/ui/dialog_background_opaque': { file: 'dialog.png', size: [16, 16], nineslice: 4 },
    'textures/ui/purpleBorder': { file: 'purple.png', size: [16, 16], nineslice: 4 },
    'textures/ui/white': { file: 'white_vanilla.png', size: [15, 15] },     // 原版：四周 2 像素黑边
    'textures/bedrock_cui/solid': { file: 'white.png', size: [2, 2] },     // Texture.SOLID
    'textures/items/diamond': { file: 'diamond.png', size: [16, 16] },
    'textures/items/stick': { file: 'stick.png', size: [16, 16] },
    'textures/items/diamond_sword': { file: 'sword.png', size: [16, 16] },
    'textures/cui_example/gem': { file: 'gem.png', size: [16, 16] },       // 首页商店：自己画的像素宝石
}

window.CUI = CUI
/** form：模拟的表单数据 { title, text, buttons } */
window.CUI_PREVIEW = (id, root, { w, h, base, form }) => {
    const el = document.getElementById(id)
    // 重新运行（修改并运行、参数滑块）：先清理上一次的预览（动画的时钟随之停止）
    el._cuiPreview?.dispose()
    el.innerHTML = ''
    // defineScreen 定义的界面：构建视图，并在浏览器中运行它的逻辑（点击按钮调用方法、状态变化后重新显示）
    let screen, manifest
    if (root instanceof CUI.Screen) {
        screen = root
        const built = root.build()
        manifest = built.manifest
        const f = root.previewForm(manifest)
        form = { title: root.id, buttons: f.buttons.map((b, i) => (f.icons[i] ? { text: b, icon: f.icons[i] } : b)) }
        root = built.root
    }
    const textures = Object.fromEntries(Object.entries(STANDINS).map(([path, t]) => [path, { url: `${base}assets/textures/${t.file}`, size: t.size, ...(t.nineslice ? { nineslice: t.nineslice } : {}) }]))
    const width = el.clientWidth || el.closest('.example')?.clientWidth || 600     // 预览区隐藏时（代码优先）按外层容器的宽度
    const scale = Math.max(1, Math.min(3, Math.floor(width / w)))
    const buttons = form?.buttons ?? []
    const data = form ? {
        title: CUI.signal(form.title ?? ''), formText: CUI.signal(form.text ?? ''),
        formButtons: CUI.signal(buttons.map((b) => (typeof b === 'string' ? b : b.text))),
        formButtonIcons: CUI.signal(buttons.map((b) => (typeof b === 'string' ? '' : b.icon ?? ''))),
    } : {}
    let runner
    el._cuiPreview = mountPreview(el, {
        root, viewport: [w, h], scale, textures, fonts: { unifont: `${base}font/unifont.hex.gz` }, ...data,
        onFormButton: (i) => { runner?.click(i) },
    })
    if (screen) {
        // 日志写在预览下方（最新的一条）
        const note = document.createElement('p')
        note.className = 'cui-preview-log'
        el.after(note)
        el._cuiLog?.remove()
        el._cuiLog = note
        runner = runScreenInBrowser(screen, {
            manifest, paging: screen.paging(), title: data.title, formButtons: data.formButtons, formButtonIcons: data.formButtonIcons,
            log: (m) => { note.textContent = m },
            onShow: () => el._cuiPreview?.restartAnimations(),
        })
        const dispose = el._cuiPreview.dispose
        el._cuiPreview.dispose = () => { runner.stop(); dispose() }
    }
}
