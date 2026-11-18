import { Color } from '../core/values.js'

type Json = Record<string, any>

/**
 * V11 真机通过的单计时器绘制片段（internal）。调用方须放在原生 hud_title_text_factory 的子树，
 * 将本函数的动画定义并入同一命名空间，并在 HUD screen 直属树安放工厂和接收器。
 * 与 EventTimerSender 配套，width 必须一致；此处不提供普通表单 props 或多个独立计时器的调度。
 */
export function eventTimerBarParts(namespace: string, options: {
    receiverName: string
    sourceProperty?: string
    width?: number
    height?: number
    fill?: Color
    track?: Color
    progressExpression?: string
    runningExpression?: string
    pausedExpression?: string
    clockVariable?: string
    animationNames?: { grow: string, shrink: string }
    /** 静态布局上下限；V13 真机显示它不能可靠钳制绑定后的尺寸，不能替代正确的宽度计算。 */
    boundDimensions?: boolean
}): { track: Json, grow: Json, shrink: Json, animations: Record<string, Json> } {
    const W = options.width ?? 160, H = options.height ?? 8
    if (!namespace || /[\s@/]/.test(namespace) || !options.receiverName) throw new Error('Event timer requires a namespace and receiver name')
    if (![W, H].every((n) => Number.isSafeInteger(n) && n > 0)) throw new Error('Event timer dimensions must be positive integer pixels')
    const rgb = (color: Color) => {
        if (!(color instanceof Color)) throw new Error('Event timer colors must be Color values')
        const result = color.toJSON()
        if (!result.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('Event timer color is out of range')
        return result
    }
    const fill = rgb(options.fill ?? Color.fromJSON([0.12, 0.9, 0.62]))
    const track = rgb(options.track ?? Color.fromJSON([0.18, 0.23, 0.29]))
    const bind = (expr: string, target: string): Json => ({
        binding_type: 'view', source_control_name: options.receiverName,
        source_property_name: expr, target_property_name: target, binding_condition: 'always',
    })
    const p = options.progressExpression ?? "(((((#cui_retained - 'cui.live|') - 'R') - 'P') - 'D') * 1)"
    const remaining = `(${W} - ${p})`
    const running = options.runningExpression ?? "(not ((#cui_retained - 'R') = #cui_retained))"
    const paused = options.pausedExpression ?? "((#cui_retained - 'R') = #cui_retained)"
    const clock = options.clockVariable ?? '$title_fade_in_time'
    const names = options.animationNames ?? { grow: 'grow_remaining', shrink: 'shrink_remaining' }
    const dimensions = (width: string): Json[] => [
        bind(width, '#size_binding_x'), bind(`((${options.sourceProperty ?? '#cui_retained'} = ${options.sourceProperty ?? '#cui_retained'}) * ${H})`, '#size_binding_y'),
    ]
    const image = (color: number[], size: (number | string)[] = [1, 1], layer = 1): Json => ({
        type: 'image', size, texture: 'textures/bedrock_cui/solid', keep_ratio: false,
        color: [...color], layer, anchor_from: 'top_left', anchor_to: 'top_left',
        ...(options.boundDimensions ? { min_size: [0, 0], max_size: [W, H] } : {}),
    })
    const unit = (controls: Json[]): Json => ({ type: 'panel', size: [1, 1], anchor_from: 'top_left', anchor_to: 'top_left', controls })
    return {
        track: image(track, [W, H], 0),
        grow: unit([{ growing_stack: {
            type: 'stack_panel', orientation: 'horizontal', size: [1, 1], anchor_from: 'top_left', anchor_to: 'top_left',
            controls: [
                { completed: { ...image(fill), bindings: dimensions(p) } },
                { remaining: {
                    ...image(track), bindings: dimensions(remaining),
                    controls: [{ fill: {
                        ...image(fill, [0, '100%'], 2), anims: [`@${namespace}.${names.grow}`], bindings: [bind(running, '#visible')],
                    } }],
                } },
            ],
        } }]),
        shrink: unit([{ remaining: {
            ...image(track), bindings: dimensions(remaining),
            controls: [
                { still: { ...image(fill, ['100%', '100%'], 2), bindings: [bind(paused, '#visible')] } },
                { countdown: { ...image(fill, ['100%', '100%'], 2), anims: [`@${namespace}.${names.shrink}`], bindings: [bind(running, '#visible')] } },
            ],
        } }]),
        animations: {
            [names.grow]: { anim_type: 'size', easing: 'linear', duration: clock, from: [0, '100%'], to: ['100%', '100%'] },
            [names.shrink]: { anim_type: 'size', easing: 'linear', duration: clock, from: ['100%', '100%'], to: [0, '100%'] },
        },
    }
}
