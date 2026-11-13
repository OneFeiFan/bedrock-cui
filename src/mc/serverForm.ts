/**
 * 把界面挂到原版服务端表单上（ActionFormData）：与 sapdon ServerFormUI 同一套挂法（真机验证）——
 *   server_form.json：主内容区插入表单工厂（long_form → @命名空间.root）；标题以前缀开头时隐藏原版长表单
 *   命名空间文件：root = 全屏面板，标题包含 panelId 时显示
 * 脚本里 `new ActionFormData().title(panelId)` 打开。
 */
import { form } from '../core/expr.js'
import { Panel, type Element } from '../core/element.js'
import { compileNamespace, type CompileResult } from './compile.js'
import type { LintOptions } from './lint.js'

export interface ServerFormOptions extends LintOptions {
    /** UI 命名空间（文件名 ui/<namespace>.json） */
    namespace: string
    /** 表单标题（脚本里 ActionFormData.title 用它）；必须以 prefix 开头 */
    panelId: string
    /** 隐藏原版长表单用的标题前缀，缺省 'cui_ui:' */
    prefix?: string
    content: Element
}

export interface ServerFormFiles {
    /** 资源包里的相对路径 → JSON */
    files: Record<string, unknown>
    issues: CompileResult['issues']
}

export function serverForm(options: ServerFormOptions): ServerFormFiles {
    const prefix = options.prefix ?? 'cui_ui:'
    if (!options.panelId.startsWith(prefix)) throw new Error(`panelId 必须以 ${prefix} 开头：${options.panelId}`)
    const root = new Panel({ size: ['100%', '100%'], visible: form.title.contains(options.panelId), children: [options.content] })
    const { json, issues } = compileNamespace(options.namespace, { root }, options)
    const hook = {
        namespace: 'server_form',
        main_screen_content: {
            // 与 sapdon 的挂法一致（真机验证）：主内容区填满，工厂实例化出的根面板才能铺满屏幕
            size: ['fill', 'fill'],
            modifications: [{
                array_name: 'controls', operation: 'insert_back',
                value: [{ [`cui_form_factory_${options.namespace}`]: { type: 'panel', factory: { name: 'server_form_factory', control_ids: { long_form: `@${options.namespace}.root` } } } }],
            }],
        },
        long_form: {
            modifications: [{
                array_name: 'bindings', operation: 'insert_back',
                value: [{ binding_name: '#title_text' }, { binding_type: 'view', source_property_name: `((#title_text - '${prefix}') = #title_text)`, target_property_name: '#visible' }],
            }],
        },
    }
    return {
        files: {
            [`ui/${options.namespace}.json`]: json,
            'ui/server_form.json': hook,
            'ui/_ui_defs.json': { ui_defs: [`ui/${options.namespace}.json`, 'ui/server_form.json'] },
        },
        issues,
    }
}
