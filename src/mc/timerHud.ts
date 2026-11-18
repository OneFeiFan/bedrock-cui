import type { TimerHud, TimerHudManifest } from '../core/timerHud.js'
import { ACTIONBAR_INPUT, actionbarTimerExpressions, compileTimerExpression, TimerHudRef } from '../core/timerHud.js'
import { ACTIONBAR_TIMER_PREFIX, timerFrameCodec } from '../core/timerFrame.js'
import { compileNamespace } from './compile.js'
import type { LintIssue } from './lint.js'

type Json = Record<string, any>
const globalPrefix = 'cui.timers|'
/** 标题和 actionbar 各用一个原生工厂，分别将 CUI 数据和普通消息路由到对应模板。 */
export function compileTimerHuds(namespace: string, huds: readonly TimerHud[]): {
    files: Record<string, object>, manifests: Record<string, TimerHudManifest>, issues: LintIssue[]
} {
    const roots: Record<string, ReturnType<TimerHud['build']>['root']> = {}, manifests: Record<string, TimerHudManifest> = {}
    for (const hud of huds) {
        if (manifests[hud.id]) throw new Error(`重复的计时 HUD：${hud.id}`)
        const built = hud.build(namespace)
        roots[`hud_${hud.id}`] = built.root
        manifests[hud.id] = built.manifest
    }
    const result = compileNamespace(namespace, roots)
    const ui = result.json as Json
    const source = () => ({ binding_name: '#hud_title_text_string', binding_condition: 'always' })
    const gate = (prefix: string, positive: boolean) => [source(), { binding_type: 'view',
        source_property_name: positive ? `(not ((#hud_title_text_string - '${prefix}') = #hud_title_text_string))`
            : `((#hud_title_text_string - '${prefix}') = #hud_title_text_string)`,
        target_property_name: '#visible', binding_condition: 'always' }]
    const receivers: Json[] = [], views: Json[] = [], actionbarViews: Json[] = []
    for (const manifest of Object.values(manifests)) {
        const byActionbar = manifest.transport === 'actionbar'
        const receiver = byActionbar
            ? { property_bag: { '#cui_retained': ACTIONBAR_INPUT } }
            : { property_bag: { '#cui_retained': manifest.prefix + timerFrameCodec(manifest).encode(Object.fromEntries(manifest.names.map((name) => [name, 0]))) },
                bindings: [{ binding_name: '#hud_title_text_string', binding_name_override: '#cui_retained', binding_type: 'global' }] }
        const instance: Json[] = [{ [manifest.receiver]: { type: 'panel', size: [0, 0], ...receiver } }]
        // 每个槽独立保存已解析字段。尺寸绑定只读取数字属性，禁止把字符串格式化嵌入减法/比较。
        for (const [slot, name] of manifest.names.entries()) {
            const decoder = new TimerHudRef(manifest, name, slot)._decoder()
            instance.push({ [decoder.name]: { type: 'panel', size: [0, 0], property_bag: decoder.initial,
                bindings: decoder.stages.map((stage) => ({ binding_type: 'view',
                    ...(stage.source ? { source_control_name: stage.source } : {}),
                    source_property_name: compileTimerExpression(stage.value), target_property_name: stage.target })),
            } })
        }
        if (byActionbar) {
            actionbarViews.push(compileActionbarView(ui, manifest, instance))
            continue
        }
        receivers.push(...instance)
        views.push({ [`view_${manifest.id}`]: { type: 'panel', size: ['100%', '100%'], bindings: gate(manifest.prefix, true),
            controls: [{ [`content@${namespace}.hud_${manifest.id}`]: {} }] } })
    }
    ui.overlay_root = { type: 'panel', size: ['100%', '100%'], layer: 1000, controls: [
        { title_factory: { type: 'panel', size: ['100%', '100%'], factory: { name: 'hud_title_text_factory',
            control_ids: { hud_title_text: `hud_title_text@${namespace}.title_router` } } } },
        { actionbar_factory: { type: 'panel', size: ['100%', '100%'], factory: { name: 'hud_actionbar_text_factory',
            control_ids: { hud_actionbar_text: actionbarViews.length ? `hud_actionbar_text@${namespace}.actionbar_router` : 'hud_actionbar_text@hud.hud_actionbar_text' } } } },
    ] }
    if (actionbarViews.length) {
        ui.actionbar_router = { type: 'panel', size: ['100%', '100%'], [ACTIONBAR_INPUT]: '$actionbar_text', controls: [
            // 原版提示动画结束时销毁工厂实例。计时快照须完全跳过这个模板。
            { 'normal_actionbar@hud.hud_actionbar_text': { ignored: actionbarMatches(ACTIONBAR_TIMER_PREFIX) } },
            ...actionbarViews,
        ] }
    }
    ui.title_router = { type: 'panel', size: ['100%', '100%'], controls: [
        // 原生工厂重建动画时一并创建本次快照，避免新动画读到常驻接收器上一帧的值。
        ...receivers,
        { normal_wrapper: { type: 'panel', size: ['100%', '100%'], bindings: gate(globalPrefix, false),
            controls: [{ 'normal_title@hud.hud_title_text': {} }] } },
        ...views,
    ] }
    // 隐藏的原版标题不能发出 hud_title_text_complete 或销毁工厂根，否则会提前删除计时 HUD。
    // 保留原版模板与时长/透明度，但淡出后只销毁其自己的 normal_title 节点。
    const alphaChain = (name: string, background: boolean, subtitle = false, destroy = false) => {
        ui[`${name}_in`] = { anim_type: 'alpha', easing: 'linear', duration: '$title_fade_in_time', from: 0,
            to: background ? '$title_alpha' : 1, next: `@${namespace}.${name}_stay`,
            ...(subtitle ? { play_event: 'anim_subtitle_text_alpha_in_play_event' } : {}) }
        ui[`${name}_stay`] = { anim_type: 'wait', duration: '$title_stay_time', next: `@${namespace}.${name}_out` }
        ui[`${name}_out`] = { anim_type: 'alpha', easing: 'linear', duration: '$title_fade_out_time',
            from: background ? '$title_alpha' : 1, to: 0, ...(destroy ? { destroy_at_end: 'normal_title' } : {}) }
    }
    alphaChain('normal_text', false, false, true)
    alphaChain('normal_bg', true)
    alphaChain('normal_sub_text', false, true)
    alphaChain('normal_sub_bg', true, true)
    const hud: Json = {
        namespace: 'hud',
        hud_screen: { render_only_when_topmost: false, screen_draws_last: true, low_frequency_rendering: false,
            $screen_animations: [], $background_animations: [], modifications: [
                { array_name: 'controls', operation: 'insert_back', value: [{ [`cui_timers@${namespace}.overlay_root`]: {} }] },
            ] },
        'root_panel/hud_title_text_area': { ignored: true },
        'root_panel/hud_actionbar_text_area': { ignored: true },
        hud_title_text: { alpha: `@${namespace}.normal_text_in` },
        'hud_title_text/title_frame/title_background': { alpha: `@${namespace}.normal_bg_in` },
        'hud_title_text/subtitle_frame/subtitle_background': { variables: [
            { requires: '$subtitle_initially_visible', $subtitle_bg: `@${namespace}.normal_bg_in` },
            { requires: '(not $subtitle_initially_visible)', $subtitle_bg: `@${namespace}.normal_sub_bg_in` },
        ] },
        'hud_title_text/subtitle_frame/subtitle': { variables: [
            { requires: '$subtitle_initially_visible', $anim_type: 1 },
            { requires: '(not $subtitle_initially_visible)', $anim_type: `@${namespace}.normal_sub_text_in` },
            { requires: '(not $title_shadow)', $show_shadow: false }, { requires: '$title_shadow', $show_shadow: true },
        ] },
    }
    return { files: { [`ui/${namespace}.json`]: ui, 'ui/hud_screen.json': hud,
        'ui/_ui_defs.json': { ui_defs: [`ui/${namespace}.json`, 'ui/hud_screen.json'] } }, manifests, issues: result.issues }
}

function actionbarMatches(prefix: string): string {
    return `(('%.${prefix.length}s' * ${ACTIONBAR_INPUT}) = '${prefix}')`
}

function compileActionbarView(ui: Json, manifest: TimerHudManifest, receivers: Json[]): Json {
    const { namespace, id } = manifest
    const { seconds, noticeTicks, noticeAlpha, noticeText } = actionbarTimerExpressions(manifest)
    const name = `actionbar_instance_${id}`, notice = `cui_${id}_notice`
    const backgroundAlpha = '$cui_actionbar_background_alpha'
    ui[`${notice}_text_out`] = { anim_type: 'alpha', easing: 'linear', duration: seconds(3), from: noticeAlpha, to: 0 }
    ui[`${notice}_bg_out`] = { ...ui[`${notice}_text_out`], from: `(${noticeAlpha} * ${backgroundAlpha})` }
    ui[notice] = { type: 'image', size: ['100%c + 12px', '100%c + 5px'], offset: [0, '50%-68px'],
        texture: 'textures/ui/hud_tip_text_background', alpha: `@${namespace}.${notice}_bg_out`, layer: 40,
        controls: [{ message: { type: 'label', text: noticeText, color: '$tool_tip_text',
            enable_profanity_filter: true, localize: false, shadow: true,
            alpha: `@${namespace}.${notice}_text_out`, layer: 1 } }],
    }
    ui[name] = { type: 'panel', size: ['100%', '100%'], [ACTIONBAR_INPUT]: '$actionbar_text',
        [backgroundAlpha]: '$actionbar_text_background_alpha',
        controls: [...receivers, { [`content@${namespace}.hud_${id}`]: {} },
            { [`cui_notice@${namespace}.${notice}`]: { ignored: `(${noticeTicks} = 0)` } }],
    }
    return { [`view_${id}`]: { type: 'panel', size: ['100%', '100%'], ignored: `(not ${actionbarMatches(manifest.prefix)})`,
        controls: [{ [`instance@${namespace}.${name}`]: {} }] } }
}
