/**
 * 把界面挂到原版服务端表单上（ActionFormData）：与 sapdon ServerFormUI 同一套挂法（真机验证）——
 *   server_form.json：主内容区插入表单工厂（long_form → @命名空间.root）；标题以前缀开头时隐藏原版长表单
 *   命名空间文件：root = 全屏面板，标题包含 panelId 时显示
 * 脚本里 `new ActionFormData().title(panelId)` 打开。
 */
import { form, toggleState } from '../core/expr.js'
import { Button, Panel, Raw, Toggle, type Element } from '../core/element.js'
import { Anchor } from '../core/values.js'
import { compileNamespace, type CompileResult } from './compile.js'
import type { LintOptions } from './lint.js'

export interface ServerFormPanel {
    /** 表单标题（脚本里 ActionFormData.title 用它）；必须以 prefix 开头 */
    panelId: string
    content: Element
    /**
     * 路由变量：base 设在界面根上（通常带 |default）；variants 的每一项生成一个路由 `<panelId>/<名字>` →
     * 「同一个界面 + 这些变量」的派生元素。服务端分页：`routes: pages.serverRoutes()`，标题用 serverTitle(panelId, 页名)。
     */
    routes?: { base?: Record<string, unknown>, variants?: Record<string, Record<string, unknown>> }
    /**
     * 是否走标题路由（只在打开它时才创建；缺省 true）。false = 静态界面：表单打开时就创建，按「标题包含 panelId」显示——
     * 要靠默认聚焦连点翻页的界面用静态（真机 1.10.0：路由界面由工厂在打开之后才创建，默认聚焦不可靠；1.5.4 的静态写法可靠）。
     */
    routed?: boolean
    /**
     * 焦点交接（路由界面用）：静态部分放一个 1×1 透明的「焦点缓冲」按钮（聚焦优先级 1000），表单一打开焦点先落在它身上；
     * 路由界面里放一个「已加载」标记（默认选中的隐藏开关），界面创建好之后缓冲按钮隐藏——游戏若按优先级重选焦点，就会落到界面里
     * 优先级最高的按钮（例如聚焦版翻页箭头）。缓冲按钮发的是空事件，被点到也不会关表单。
     * 背景：真机 1.10.0 路由界面由工厂在打开之后才创建，默认聚焦不可靠（翻页乱跳）。⏳ 待真机确认。
     */
    focusHandoff?: boolean
}

/** 焦点交接：路由界面 i 的「已加载」标记开关名 */
const readyMarker = (i: number) => `cui_ready_${i}`

/** 服务端分页的表单标题：`<panelId>/<页名>`（与 serverForm 的路由一致） */
export function serverTitle(panelId: string, variant?: string): string {
    return variant ? `${panelId}/${variant}` : panelId
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
    // 路由表：标题 → 界面 id。界面带 routes.variants 时，每个变体一条路由（派生元素 = 同一界面 + 变量）
    const routes: { title: string, id: string }[] = []
    const derived: Record<string, Record<string, unknown>> = {}
    panels.forEach((p, i) => {
        if (p.routed === false) return
        routes.push({ title: p.panelId, id: routeId(i) })
        for (const [v, vars] of Object.entries(p.routes?.variants ?? {})) {
            if (!/^[A-Za-z0-9_-]+$/.test(v)) throw new Error(`路由名只能用字母、数字、_ 与 -：${v}`)
            const id = `${routeId(i)}_${v}`
            routes.push({ title: serverTitle(p.panelId, v), id })
            derived[`${id}@${options.namespace}.${routeId(i)}`] = { ...vars }
        }
    })
    const router = new Raw({
        name: 'router', size: ['100%', '100%'], anchor: 'top_left',
        json: {
            type: 'collection_panel',
            property_bag: { '#route_': [], ...Object.fromEntries(routes.map((r) => [`#route_${r.title}`, [r.id]])) },
            factory: { name: `${options.namespace}_title_screen`, control_ids: Object.fromEntries(routes.map((r) => [r.id, `@${options.namespace}.${r.id}`])) },
            bindings: [
                { binding_name: '#title_text', binding_condition: 'always' },
                { binding_type: 'view', source_property_name: "('#route_' + #title_text)", target_property_name: '#collection_length', binding_condition: 'always' },
            ],
        },
    })
    // 静态界面：直接放在根下，按「标题包含 panelId」显示（与 1.5.4 相同）
    const statics: Element[] = panels.filter((p) => p.routed === false).map((p) => new Panel({ size: ['100%', '100%'], visible: form.title.contains(p.panelId), children: [p.content] }))
    // 焦点交接：静态部分的缓冲按钮（按标题包含 panelId 显示；路由界面里的「已加载」标记出现后隐藏）
    panels.forEach((p, i) => {
        if (!p.focusHandoff || p.routed === false) return
        const clash = panels.find((q) => q !== p && q.panelId.includes(p.panelId))
        if (clash) throw new Error(`焦点交接按「标题包含 ${p.panelId}」显示缓冲按钮，但 ${clash.panelId} 也包含它`)
        const gate = new Panel({ name: `focus_gate_${i}`, size: ['100%', '100%'], visible: form.title.contains(p.panelId) })
        gate.add(new Button().setName(`focus_sink_${i}`).setSize(1, 1).setAnchor(Anchor.TOP_LEFT)
            .setFocusPrecedence(1000).setPressedName('button.cui_focus_sink')
            .setVisible(toggleState(readyMarker(i)).not()).setBindingAlways())
        statics.push(gate)
    })
    const screens: Record<string, Element> = { root: new Panel({ size: ['100%', '100%'], visible: form.title.contains(prefix), children: [...statics, router] }) }
    panels.forEach((p, i) => {
        if (p.routed === false) return
        const screen = new Panel({ size: ['100%', '100%'], children: [p.content] })
        // 焦点交接：「已加载」标记（默认选中的隐藏开关；静态部分的缓冲按钮读它）
        if (p.focusHandoff) screen.add(new Toggle(readyMarker(i), 0).setName(readyMarker(i)).setRadio(false).setDefaultState(true).setSize(0, 0))
        for (const [k, v] of Object.entries(p.routes?.base ?? {})) screen.setVariable(k, v)
        screens[routeId(i)] = screen
    })
    // binding_condition: always 只给路由界面（静态界面保持 1.5.4 的输出）
    const { json, issues } = compileNamespace(options.namespace, screens, { ...options, alwaysRoots: Object.keys(screens).filter((k) => k !== 'root') })
    Object.assign(json, derived)
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
