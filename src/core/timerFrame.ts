import { Timer } from './timer.js'
import { livePixels } from './liveFrame.js'

export const TIMER_CLOCKS = ['$title_fade_in_time', '$title_stay_time', '$title_fade_out_time'] as const
export const ACTIONBAR_TIMER_PREFIX = 'cui.timers|v4|'
export const ACTIONBAR_CLOCK_MARKERS = 'xyzn'
export const ACTIONBAR_CLOCK_DIGITS = 10
export const ACTIONBAR_NOTICE_TICKS = 60
export interface TimerFrameConfig { prefix: string, names: readonly string[], steps: number }
export interface TimerFrame {
    payload: string
    data: string
    signature: string
    options: { fadeInDuration: number, stayDuration: number, fadeOutDuration: number }
}

/** ASCII 定长字段：aR025bP016cR012。槽标记防止字符串减法误删重复的数字片段。
 * V12 的大整数除法拆包未通过真机；这里仅在脚本中拆分运行位，不让 UI 做取余。
 */
export class TimerFrameCodec {
    readonly digits: number
    readonly fieldLength: number
    readonly names: readonly string[]
    readonly steps: number
    constructor(config: TimerFrameConfig) {
        if (!config.prefix || !Number.isSafeInteger(config.steps) || config.steps < 1 || config.steps > 10000
            || config.names.length < 1 || config.names.length > 3 || new Set(config.names).size !== config.names.length
            || config.names.some((name) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) {
            throw new Error('计时 HUD 需要 1～3 个不同名字的计时器和 1～10000 的整数精度')
        }
        this.names = [...config.names]
        this.steps = config.steps
        this.digits = String(config.steps).length
        this.fieldLength = this.digits + 2
    }
    encode(values: Readonly<Record<string, number>>): string {
        if (Object.keys(values).some((name) => !this.names.includes(name))) throw new Error('未知的计时字段')
        return this.names.map((name, i) => {
            const digit = values[name]
            if (!Object.hasOwn(values, name) || !Number.isSafeInteger(digit) || digit < 0 || digit > this.steps * 2 + 1) throw new Error(`无效的计时字段：${name}`)
            const running = digit > this.steps, position = digit - (running ? this.steps + 1 : 0)
            return 'abc'[i] + (running ? 'R' : 'P') + String(position).padStart(this.digits, '0')
        }).join('')
    }
    decode(data: string): Record<string, number> {
        if (typeof data !== 'string' || data.length !== this.fieldLength * this.names.length) throw new Error('无效的计时快照')
        return Object.fromEntries(this.names.map((name, i) => {
            const field = data.slice(i * this.fieldLength, (i + 1) * this.fieldLength)
            if (!new RegExp(`^${'abc'[i]}[RP][0-9]{${this.digits}}$`).test(field)) throw new Error('无效的计时快照')
            const position = Number(field.slice(2))
            if (position > this.steps) throw new Error('计时进度越界')
            return [name, position + (field[1] === 'R' ? this.steps + 1 : 0)]
        }))
    }
}
export const timerFrameCodec = (config: TimerFrameConfig): TimerFrameCodec => new TimerFrameCodec(config)

/** Keep timer animation clocks on exact multiples of 20 for the client's division. */
export function actionbarTimerHeader(frame: TimerFrame, noticeTicks = 0): string {
    const maxSeconds = Math.floor(0x7fffffff / 20)
    const { fadeInDuration, stayDuration, fadeOutDuration } = frame.options
    const timerTicks = [fadeInDuration, stayDuration, fadeOutDuration].map((ticks) =>
        Math.min(maxSeconds, Math.max(1, Math.round(ticks / 20))) * 20)
    return frame.payload + [...timerTicks, noticeTicks].map((ticks, slot) =>
        ACTIONBAR_CLOCK_MARKERS[slot] + String(ticks).padStart(ACTIONBAR_CLOCK_DIGITS, '0')).join('')
}

export function encodeTimerFrame(config: TimerFrameConfig, timers: Readonly<Record<string, Timer>>, now: number): TimerFrame {
    const codec = timerFrameCodec(config)
    if (!Number.isFinite(now)) throw new Error('计时 HUD 的时刻必须是有限数字')
    if (Object.keys(timers).some((name) => !config.names.includes(name))) throw new Error('计时 HUD 收到了未声明的计时器')
    const digits: Record<string, number> = {}, times = [1, 1, 1], signatures: unknown[] = []
    config.names.forEach((name, i) => {
        const timer = timers[name]
        if (!(timer instanceof Timer) || !Number.isFinite(timer.seconds)
            || (timer.startedAt !== undefined && !Number.isFinite(timer.startedAt))
            || (timer.pausedElapsed !== undefined && !Number.isFinite(timer.pausedElapsed))) throw new Error(`计时器 ${name} 必须是有限时长的 Timer`)
        const position = livePixels(timer.progress(now), 1, config.steps)
        const running = timer.isRunning(now)
        digits[name] = position + (running ? config.steps + 1 : 0)
        if (running) {
            times[i] = Math.max(1, Math.ceil(timer.remaining(now) * 20))
            if (!Number.isSafeInteger(times[i]) || times[i] > 0x7fffffff) throw new Error(`计时器 ${name} 的剩余时长过大`)
        }
        signatures.push(running ? ['R', Math.round(timer.seconds * 1000), Math.round(timer.startedAt!)]
            : [timer.isDone(now) ? 'D' : 'P', position])
    })
    const data = codec.encode(digits)
    return { data, payload: config.prefix + data, signature: JSON.stringify(signatures),
        options: { fadeInDuration: times[0], stayDuration: times[1], fadeOutDuration: times[2] } }
}
