/**
 * 混合翻页的脚本端（行为包里用；依赖 @minecraft/server 与 @minecraft/server-ui，所以与 cui/runtime 分开）。
 * 构建时 `pages.serverPaging('cui_ui:my_book')` 导出路由表，写进脚本；这里按它打开表单、处理翻页：
 *
 *   import { ServerPagesForm } from './cui/runtime/serverPages.js'
 *   const book = new ServerPagesForm(ROUTES)
 *       .setButtons((player, page) => ({ 0: 'info|' + text }))   // 界面自己的表单按钮（序号 → 文字），翻页按钮由它填
 *       .onSelect((player, index, page) => { ... })             // 点了非翻页按钮（表单已关）
 *   book.open(player)
 *
 * 照真机结论做（见 core/serverPagesShared.ts）：重开时给刚才点击方向的箭头加 F（鼠标不动能连点）；「原地不动」原样重开；
 * 标题写页码；视角只在打开时锁一次、关时解开；**翻页过程中不发聊天消息**——否则进入地图后第一次翻页界面会消失一阵子。
 */
import { InputPermissionCategory, type Player } from '@minecraft/server'
import { ActionFormData } from '@minecraft/server-ui'
import { buttonIconOf, pageTitle, pagingButtons, pagingResponse, type FormButtonSpec, type ServerPaging } from '../core/serverPagesShared.js'

export type { FormButtonSpec, ServerArrowRoute, ServerPaging } from '../core/serverPagesShared.js'

/**
 * 书打开期间锁视角（混合翻页关表单再开的空档里，视角不随鼠标偏转）；状态已对就不再设置。
 * 脚本启动时对所有玩家调一次 lockCamera(p, false)：上次关游戏时书还开着，视角可能还锁着
 */
export function lockCamera(player: Player, lock: boolean): void {
    try {
        const perms = player.inputPermissions
        if (perms.isPermissionCategoryEnabled(InputPermissionCategory.Camera) === lock) perms.setPermissionCategory(InputPermissionCategory.Camera, !lock)
    } catch { /* 玩家已离开等 */ }
}

export class ServerPagesForm {
    private buttons: (player: Player, page: string) => Record<number, FormButtonSpec> = () => ({})
    private body: (player: Player, page: string) => string = () => ''
    private selected?: (player: Player, index: number, page: string) => void
    private closed?: (player: Player, page: string) => void
    private camera = true

    constructor(readonly routes: ServerPaging) { }

    /** 界面自己的表单按钮：序号 → 按钮文字，或 { text, icon }（图标路径，界面里用 form.buttonTexture 显示）。翻页箭头与「原地不动」的序号由路由表决定，不要占用 */
    setButtons(fn: (player: Player, page: string) => Record<number, FormButtonSpec>): this { this.buttons = fn; return this }
    /** 表单正文 */
    setBody(fn: (player: Player, page: string) => string): this { this.body = fn; return this }
    /** 点了非翻页按钮（表单已关） */
    onSelect(fn: (player: Player, index: number, page: string) => void): this { this.selected = fn; return this }
    /** 玩家关掉了表单（Esc 等） */
    onClose(fn: (player: Player, page: string) => void): this { this.closed = fn; return this }
    /** 打开期间锁视角（缺省 true） */
    setLockCamera(on: boolean): this { this.camera = on; return this }

    /** 打开到某页；dir = 默认聚焦哪个方向的箭头（缺省 next） */
    open(player: Player, page: string = this.routes.start, dir: 'prev' | 'next' = 'next'): void {
        if (this.camera) lockCamera(player, true)
        const form = new ActionFormData().title(pageTitle(this.routes, page)).body(this.body(player, page))
        const own = this.buttons(player, page)
        pagingButtons(this.routes, page, dir, own).forEach((text, i) => { const icon = buttonIconOf(own[i]); if (icon) form.button(text, icon); else form.button(text) })
        form.show(player).then((r) => {
            if (r.canceled || r.selection === undefined) { if (this.camera) lockCamera(player, false); this.closed?.(player, page); return }
            const next = pagingResponse(this.routes, r.selection, page, dir)
            if (next.kind !== 'own') return this.open(player, next.page, next.dir)
            if (this.camera) lockCamera(player, false)
            this.selected?.(player, next.index, page)
        })
    }
}
