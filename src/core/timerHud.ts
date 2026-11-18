import { Element } from './element.js'
import { compileExpr, lit, ref, type Expr, type Source } from './expr.js'
import { Timer } from './timer.js'
import { ACTIONBAR_CLOCK_DIGITS, ACTIONBAR_CLOCK_MARKERS, ACTIONBAR_NOTICE_TICKS, ACTIONBAR_TIMER_PREFIX, TIMER_CLOCKS, timerFrameCodec } from './timerFrame.js'
import type { RawMessage } from '@minecraft/server'

export type HudTitleText = string | RawMessage | (string | RawMessage)[]
export type HudTitlePolicy = 'priority' | 'actionbar'
export type TimerHudTransport = 'title' | 'actionbar'
export interface HudTitleOptions {
    fadeInDuration?: number
    stayDuration?: number
    fadeOutDuration?: number
    subtitle?: HudTitleText
    policy?: HudTitlePolicy
    /** 中央标题默认依次显示；replace 立即替换并取消尚未显示的标题。 */
    mode?: 'queue' | 'replace'
}
export interface TimerHudManifest {
    id: string
    namespace: string
    prefix: string
    receiver: string
    steps: number
    names: string[]
    titlePolicy: HudTitlePolicy
    transport?: TimerHudTransport
}
export interface TimerHudOptions {
    /** 项目内唯一的标识，仅使用字母、数字和下划线 */
    id: string
    /** 同屏 1～3 个计时器，值为默认 Timer；更新时用同名字段 */
    timers: Record<string, Timer>
    view(timers: Record<string, TimerHudRef>): Element
    /** 进度离散精度。actionbar 默认 800，title 默认 1000（三条时为 100）。 */
    steps?: number
    /** 计时 HUD 显示时的默认提示策略。actionbar 传输默认 priority，title 传输默认 actionbar。 */
    titlePolicy?: HudTitlePolicy
    /** 默认 title。选择 actionbar 可在原版中央标题和字幕显示时继续推进计时条。 */
    transport?: TimerHudTransport
}

/** @internal 协议字面量仅含受控 ASCII，直接放入 view binding 的源表达式。 */
export function compileTimerExpression(expr: Expr): string {
    const c = compileExpr(expr, 'timer_literal')
    return c.text.replace(/\$timer_literal\d+\b/g, (key) => `'${c.variables[key]}'`)
}

/** @internal Native factory input must be copied before it can be used in expressions. */
export const ACTIONBAR_INPUT = '$cui_actionbar_input'

/** @internal Keep all operations inline. A $variable containing a formula stores text. */
export function actionbarTimerExpressions(manifest: TimerHudManifest) {
    const codec = timerFrameCodec(manifest)
    const positionsEnd = manifest.prefix.length + codec.fieldLength * codec.names.length
    const fieldLength = ACTIONBAR_CLOCK_DIGITS + 1
    const head = (end: number): string => `('%.${end}s' * ${ACTIONBAR_INPUT})`
    const ticks = (slot: number): string => {
        const start = positionsEnd + slot * fieldLength
        return `(0 + ((${head(start + fieldLength)} - ${head(start)}) - '${ACTIONBAR_CLOCK_MARKERS[slot]}'))`
    }
    // These literals are part of the JSON UI expression that passed the client test.
    const seconds = (slot: number): string => `((0.0 + ${ticks(slot)}) / 20.0)`
    const noticeTicks = ticks(ACTIONBAR_CLOCK_MARKERS.length - 1)
    return { seconds, noticeTicks, noticeAlpha: `((0.0 + ${noticeTicks}) / ${ACTIONBAR_NOTICE_TICKS}.0)`,
        noticeText: `(${ACTIONBAR_INPUT} - ${head(positionsEnd + ACTIONBAR_CLOCK_MARKERS.length * fieldLength)})` }
}

export class TimerHudRef {
    constructor(readonly manifest: TimerHudManifest, readonly name: string, readonly slot: number) {}
    /** @internal 把格式化字符串先落为字段，再转换为独立的数值属性。 */
    _decoder() {
        const m = this.manifest, length = timerFrameCodec(m).fieldLength
        const body = ref('#cui_retained').minus(m.prefix)
        const head = (count: number) => lit(`%.${count}s`).times(body)
        // 每个前缀含唯一的槽标记，所以即使三份数字相同，减法也只移除前面的字段。
        const end = head((this.slot + 1) * length)
        const field = this.slot === 0 ? end : end.minus(head(this.slot * length))
        return {
            name: `${m.receiver}_${this.slot}`,
            initial: { '#cui_field': 'abc'[this.slot] + 'P' + '0'.repeat(length - 2), '#cui_digits': '0', '#cui_position': 0 },
            stages: [
                { source: m.receiver, target: '#cui_field', value: field },
                { source: undefined, target: '#cui_digits', value: ref('#cui_field').minus('abc'[this.slot]).minus('R').minus('P') },
                { source: undefined, target: '#cui_position', value: ref('#cui_digits').times(1) },
            ],
        }
    }
    private fields(source: Source) {
        const field = ref('#cui_field', source)
        return { field, position: ref('#cui_position', source), running: field.contains('R') }
    }
    /** 当前事件的整数百分比；动画期间保持该次快照的值 */
    get percent(): Expr { return this.fields({ kind: 'control', control: `${this.manifest.receiver}_${this.slot}` }).position.times(100).div(this.manifest.steps) }
    /** 当前事件是否正在运行 */
    get running(): Expr { return this.fields({ kind: 'control', control: `${this.manifest.receiver}_${this.slot}` }).running }
    /** @internal 原生动画时钟与直接控件绑定 */
    _bindings(width: number) {
        const { field, position, running } = this.fields({ kind: 'global' })
        const { steps, transport } = this.manifest
        const actionbar = transport === 'actionbar'
        const pixels = position.times(width)
        const literal = compileTimerExpression
        return { receiver: `${this.manifest.receiver}_${this.slot}`, field: literal(field),
            progress: literal((actionbar ? pixels.plus(Math.floor(steps / 2)) : pixels).div(steps)), running: literal(running),
            paused: literal(running.not()), clock: actionbar ? actionbarTimerExpressions(this.manifest).seconds(this.slot) : TIMER_CLOCKS[this.slot] }
    }
}

interface TimerHudRuntimeHook {
    open(hud: TimerHud, player: { readonly id: string }, timers?: Partial<Record<string, Timer>>): void
    update(hud: TimerHud, player: { readonly id: string }, timers: Partial<Record<string, Timer>>): void
    close(hud: TimerHud, player: { readonly id: string }): void
    isOpen(hud: TimerHud, player: { readonly id: string }): boolean
    title(player: { readonly id: string }, text: HudTitleText, options?: HudTitleOptions): void
    updateSubtitle(player: { readonly id: string }, text: HudTitleText): boolean
    clearTitle(player: { readonly id: string }): boolean
}
let runtime: TimerHudRuntimeHook | undefined
/** @internal 游戏运行时登记 */
export function _setTimerHudRuntime(value: TimerHudRuntimeHook): void { runtime = value }
const hook = (): TimerHudRuntimeHook => {
    if (!runtime) throw new Error('计时 HUD 只能在行为包脚本中打开：请先导入 ./cui.generated.js')
    return runtime
}

/** 独立的计时 HUD，与表单生命周期分开管理。 */
export class TimerHud {
    constructor(readonly options: TimerHudOptions) {
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(options.id) || typeof options.view !== 'function') throw new Error('计时 HUD 需要有效的 id 和 view()')
        if (options.titlePolicy && !['priority', 'actionbar'].includes(options.titlePolicy)) throw new Error('未知的标题策略')
        if (options.transport !== undefined && options.transport !== 'title' && options.transport !== 'actionbar') throw new Error('未知的计时传输通道')
        const names = Object.keys(options.timers ?? {})
        timerFrameCodec({ prefix: 'validate|', names, steps: this.steps(names.length) })
        for (const [name, timer] of Object.entries(options.timers)) if (!(timer instanceof Timer) || !Number.isFinite(timer.seconds)) throw new Error(`计时器 ${name} 需要有限时长的 Timer`)
    }
    get id(): string { return this.options.id }
    private steps(count: number): number { return this.options.steps ?? (this.options.transport === 'actionbar' ? 800 : count === 3 ? 100 : 1000) }
    open(player: { readonly id: string }, timers?: Partial<Record<string, Timer>>): void { hook().open(this, player, timers) }
    update(player: { readonly id: string }, timers: Partial<Record<string, Timer>>): void { hook().update(this, player, timers) }
    close(player: { readonly id: string }): void { hook().close(this, player) }
    isOpen(player: { readonly id: string }): boolean { return hook().isOpen(this, player) }
    /** 经统一管理器显示提示；可切换原版标题优先或 actionbar */
    showTitle(player: { readonly id: string }, text: HudTitleText, options?: HudTitleOptions): void { hook().title(player, text, options) }
    /** 更新当前中央标题的字幕，不重播淡入、不延长显示时间；没有受管理的标题时返回 false。 */
    updateSubtitle(player: { readonly id: string }, text: HudTitleText): boolean { return hook().updateSubtitle(player, text) }
    /** 取消当前受管理的中央标题及队列。标题通道上的计时 HUD 会恢复。 */
    clearTitle(player: { readonly id: string }): boolean { return hook().clearTitle(player) }

    /** @internal 构建资源包和运行清单 */
    build(namespace: string): { root: Element, manifest: TimerHudManifest } {
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(namespace)) throw new Error('计时 HUD 的命名空间只支持字母、数字和下划线')
        const names = Object.keys(this.options.timers)
        const actionbar = this.options.transport === 'actionbar'
        const manifest: TimerHudManifest = { id: this.id, namespace, names, steps: this.steps(names.length),
            prefix: `${actionbar ? ACTIONBAR_TIMER_PREFIX : 'cui.timers|v2|'}${namespace}|${this.id}|`,
            receiver: `cui_timers_${namespace}_${this.id}`, titlePolicy: this.options.titlePolicy ?? (actionbar ? 'priority' : 'actionbar'),
            ...(actionbar ? { transport: 'actionbar' } : {}) }
        timerFrameCodec(manifest)
        Object.freeze(manifest.names)
        Object.freeze(manifest)
        const refs = Object.fromEntries(names.map((name, slot) => [name, new TimerHudRef(manifest, name, slot)]))
        const root = this.options.view(refs)
        if (!(root instanceof Element)) throw new Error(`${this.id} 的 view() 必须返回 CUI 控件`)
        const check = (el: Element) => {
            if (el.props.timerHudOwner && el.props.timerHudOwner !== manifest.prefix) throw new Error('一个计时 HUD 不能引用其他 HUD 的计时器')
            el.children.forEach(check)
        }
        check(root)
        return { root, manifest }
    }
}

export const defineTimerHud = (options: TimerHudOptions): TimerHud => new TimerHud(options)
