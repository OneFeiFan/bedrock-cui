/**
 * 把界面挂到原版服务端表单上（ActionFormData）：与 sapdon ServerFormUI 同一套挂法（真机验证）——
 *   server_form.json：主内容区插入表单工厂（long_form → @命名空间.root）；标题以前缀开头时隐藏原版长表单
 *   命名空间文件：root = 全屏面板，标题包含 panelId 时显示
 * 脚本里 `new ActionFormData().title(panelId)` 打开。
 */
import { form } from '../core/expr.js'
import { Panel, Raw, type Element } from '../core/element.js'
import { compileNamespace, type CompileResult } from './compile.js'
import type { LintOptions } from './lint.js'

export interface ServerFormPanel {
    /** 表单标题（脚本里 ActionFormData.title 用它）；必须以 prefix 开头 */
    panelId: string
    content: Element
}

export interface ServerFormOptions extends LintOptions {
    /** UI 命名空间（文件名 ui/<namespace>.json） */
    namespace: string
    /** 隐藏原版长表单用的标题前缀，缺省 'cui_ui:' */
    prefix?: string
    /** 单个界面：标题 + 内容 */
    panelId?: string
    content?: Element
    /**
     * 多个界面放在同一个命名空间里，按标题路由：只创建标题**完全等于** panelId 的那一个（标题里不要再附加别的内容，
     * 页码之类放进表单正文）
     */
    panels?: ServerFormPanel[]
    /**
     * 屏幕进出场动画（缺省 false = 去掉）：服务端翻页每次重开表单都会滑入（真机 1.4.0）。
     * 去掉的写法与 sapdon 相同（真机验证）：重定义 third_party_server_screen，动画换成不位移的等待。
     * ⚠️ 作用于所有服务端表单（包括别的附加包的）。
     */
    screenAnimation?: boolean
}

export interface ServerFormFiles {
    /** 资源包里的相对路径 → JSON */
    files: Record<string, unknown>
    issues: CompileResult['issues']
}

export function serverForm(options: ServerFormOptions): ServerFormFiles {
    const prefix = options.prefix ?? 'cui_ui:'
    const panels = options.panels ?? (options.panelId && options.content ? [{ panelId: options.panelId, content: options.content }] : [])
    if (!panels.length) throw new Error('serverForm：要给 panelId + content，或 panels')
    for (const p of panels) {
        if (!p.panelId.startsWith(prefix)) throw new Error(`panelId 必须以 ${prefix} 开头：${p.panelId}`)
        if (panels.filter((q) => q.panelId === p.panelId).length > 1) throw new Error(`两个界面用了同一个标题：${p.panelId}`)
    }
    // 只创建需要的界面（与 @bedrock-core/ui 的表单路由同一机制）：一个带工厂的 collection_panel，属性包里
    // 「#route_<标题>」= [界面 id]；('#route_' + #title_text) 求出的是一个属性名，引擎再读它的值（界面 id 列表）写进
    // #collection_length，工厂只实例化列表里的那一个——其它界面根本不创建。标题必须与 panelId 完全相同。
    const routeId = (i: number) => `screen_${i}`
    const router = new Raw({
        name: 'router', size: ['100%', '100%'], anchor: 'top_left',
        json: {
            type: 'collection_panel',
            property_bag: { '#route_': [], ...Object.fromEntries(panels.map((p, i) => [`#route_${p.panelId}`, [routeId(i)]])) },
            factory: { name: `${options.namespace}_title_screen`, control_ids: Object.fromEntries(panels.map((_, i) => [routeId(i), `@${options.namespace}.${routeId(i)}`])) },
            bindings: [
                { binding_name: '#title_text', binding_condition: 'always' },
                { binding_type: 'view', source_property_name: "('#route_' + #title_text)", target_property_name: '#collection_length', binding_condition: 'always' },
            ],
        },
    })
    const screens: Record<string, Element> = { root: new Panel({ size: ['100%', '100%'], visible: form.title.contains(prefix), children: [router] }) }
    panels.forEach((p, i) => { screens[routeId(i)] = new Panel({ size: ['100%', '100%'], children: [p.content] }) })
    const { json, issues } = compileNamespace(options.namespace, screens, options)
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
        ...(options.screenAnimation ? {} : {
            screen_exit_animation_pop_wait: { anim_type: 'offset', easing: 'linear', duration: 0.1, from: [0, 0], to: [0, 0], play_event: 'screen.exit_pop', end_event: 'screen.exit_end' },
            'third_party_server_screen@common.base_screen': {
                type: 'screen',
                button_mappings: [{ from_button_id: 'button.menu_cancel', to_button_id: 'button.menu_exit', mapping_type: 'global' }],
                $screen_content: 'server_form.main_screen_content',
                $screen_animations: ['@server_form.screen_exit_animation_pop_wait'],
                $background_animations: ['@server_form.screen_exit_animation_pop_wait'],
            },
        }),
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
