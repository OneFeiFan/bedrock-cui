/**
 * 预览：响应式布局演示（examples/responsive-demo.mjs）。上方按钮切换屏幕尺寸，看同一份界面在不同屏幕上的样子。
 */
import { signal, Texture } from 'cui'
import { mountDevtools, mountPreview, type PreviewTexture } from 'cui/web'
// @ts-ignore 示例是纯 JS
import { buildResponsiveDemo, RESPONSIVE_FORM, SCREENS, Textures } from '../examples/responsive-demo.mjs'

export function mountResponsive(app: HTMLElement, tools: HTMLElement): void {
    // 贴图：信息跟着 Texture 走；文件名 = 路径最后一段
    const textures: Record<string, PreviewTexture> = {}
    for (const t of Object.values(Textures) as Texture[]) {
        textures[t.path] = { url: `./textures/${t.path.split('/').pop()}.png`, ...Texture.info(t.path) }
    }
    const bar = document.createElement('div')
    Object.assign(bar.style, { display: 'flex', gap: '8px', marginBottom: '8px', fontFamily: 'sans-serif' })
    const wrap = document.createElement('div')
    app.append(bar, wrap)
    const first = SCREENS[0].size as [number, number]
    const preview = mountPreview(wrap, {
        root: buildResponsiveDemo(), viewport: first, scale: 2, textures,
        formButtons: signal(RESPONSIVE_FORM.buttons), title: signal(RESPONSIVE_FORM.title),
        onFormButton: (i) => console.log('表单按钮', i),
        fonts: { unifont: './font/unifont.hex.gz', ascii: './font/ascii.png' },
    })
    for (const s of SCREENS as { name: string, size: [number, number] }[]) {
        const b = document.createElement('button')
        b.textContent = `${s.name} ${s.size[0]}×${s.size[1]}`
        b.onclick = () => preview.resize(...s.size)
        bar.append(b)
    }
    mountDevtools(tools, preview)
    ;(window as any).__cui = { preview }
}
