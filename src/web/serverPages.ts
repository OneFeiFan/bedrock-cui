/**
 * 预览里模拟混合翻页（与脚本端 ServerPagesForm 同一套逻辑：pagingButtons / pagingResponse）：
 *
 *   const sim = new ServerPagesPreview(PAGING, (page) => ({ 0: 'info|…' }))
 *   const preview = mountPreview(el, { root, title: sim.title, formButtons: sim.formButtons, onFormButton: (i) => sim.press(i, preview) })
 */
import { signal, type Signal } from '../core/reactivity.js'
import { buttonIconOf, pageTitle, pagingButtons, pagingResponse, type FormButtonSpec, type ServerPaging } from '../core/serverPagesShared.js'

export class ServerPagesPreview {
    readonly title: Signal<string>
    readonly formButtons: Signal<string[]>
    /** 按钮的图标路径（own 中写成 { text, icon } 的按钮） */
    readonly formButtonIcons: Signal<string[]>
    private page: string
    private dir: 'prev' | 'next' = 'next'

    constructor(readonly paging: ServerPaging, private own: (page: string) => Record<number, FormButtonSpec> = () => ({})) {
        this.page = paging.start
        this.title = signal(pageTitle(paging, this.page))
        this.formButtons = signal(pagingButtons(paging, this.page, this.dir, own(this.page)))
        this.formButtonIcons = signal(this.icons())
    }

    private icons(): string[] {
        const own = this.own(this.page)
        return this.formButtons.value.map((_, i) => buttonIconOf(own[i]) ?? '')
    }

    /** 当前页 */
    get current(): string { return this.page }

    /** 模拟点了第 index 个表单按钮：翻页 / 原地不动 → 「重开表单」（换标题与按钮、开关回到初始状态），返回 true；界面自己的按钮返回 false */
    press(index: number, preview?: { resetToggles(): void }): boolean {
        const next = pagingResponse(this.paging, index, this.page, this.dir)
        if (next.kind === 'own') return false
        this.page = next.page; this.dir = next.dir
        this.title.value = pageTitle(this.paging, this.page)
        this.formButtons.value = pagingButtons(this.paging, this.page, this.dir, this.own(this.page))
        this.formButtonIcons.value = this.icons()
        preview?.resetToggles()
        return true
    }
}
