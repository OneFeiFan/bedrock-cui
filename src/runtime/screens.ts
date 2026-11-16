/**
 * 界面（defineScreen）的脚本端运行时：用游戏的 ActionFormData 显示表单（bedrock-cui/runtime/screens）。
 * 构建生成的 cui.generated.js 导入本模块并登记清单；行为包脚本的入口导入 cui.generated.js 之后，界面的 open() / close() 即可使用。
 */
import type { Player } from '@minecraft/server'
import { ActionFormData, uiManager } from '@minecraft/server-ui'
import { _setScreenRuntime } from '../core/screen.js'
import { lockCamera, showForm } from './serverPages.js'
import { ScreenRuntime } from './screenRuntime.js'

export { ScreenRuntime, type FormPlatform, type FormResult, type FormSpec, type ScreenPlayer } from './screenRuntime.js'

/** 行为包中的运行时 */
export const screenRuntime = new ScreenRuntime<Player>({
    show(player, spec) {
        const form = new ActionFormData().title(spec.title).body(spec.body)
        for (const b of spec.buttons) { if (b.icon) form.button(b.text, b.icon); else form.button(b.text) }
        return showForm(player, form)
    },
    close(player) { uiManager.closeAllForms(player) },
    lockCamera,
})
_setScreenRuntime(screenRuntime as unknown as Parameters<typeof _setScreenRuntime>[0])

/** 登记构建生成的清单（由 cui.generated.js 调用） */
export function registerScreens(manifests: Parameters<ScreenRuntime['register']>[0]): void {
    screenRuntime.register(manifests)
}
