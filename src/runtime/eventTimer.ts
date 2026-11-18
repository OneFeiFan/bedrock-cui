import { Timer } from '../core/timer.js'
import { livePixels } from '../core/liveFrame.js'

export interface TimerTitleEvent {
    payload: string
    pixels: number
    state: 'R' | 'P' | 'D'
    options: { fadeInDuration: number, stayDuration: number, fadeOutDuration: number }
}

/**
 * 实验性计时事件编码。借用原生标题工厂的 fadeInDuration 传入剩余时长，
 * 自定义 JSON UI 将该时长用于剩余宽度内的动画；V11 用户真机反馈与预期一致。
 * 本次确认范围为单个计时器、HUD 叠加与一次暂停/继续；未验证多计时器或延迟/重连恢复。
 */
export function timerTitleEvent(timer: Timer, width: number, now = Date.now()): TimerTitleEvent {
    if (!(timer instanceof Timer) || !Number.isFinite(timer.seconds) || !Number.isFinite(now)
        || (timer.startedAt !== undefined && !Number.isFinite(timer.startedAt))
        || (timer.pausedElapsed !== undefined && !Number.isFinite(timer.pausedElapsed))) {
        throw new Error('Timer title event requires a finite Timer and timestamp')
    }
    const pixels = livePixels(timer.progress(now), 1, width)
    const state = timer.isDone(now) ? 'D' : timer.isRunning(now) ? 'R' : 'P'
    const ticks = state === 'R' ? Math.max(1, Math.ceil(timer.remaining(now) * 20)) : 1
    if (!Number.isSafeInteger(ticks)) throw new Error('Timer title duration is too large')
    return {
        payload: `cui.live|${state}${pixels}`, pixels, state,
        options: { fadeInDuration: ticks, stayDuration: 1200, fadeOutDuration: 0 },
    }
}

/** 只在计时锚点、暂停位置、完成状态改变或显式要求快照时发送，不逐帧同步进度。 */
export class EventTimerSender {
    private previous?: string
    private snapshot = true
    private stopped = false
    private calls = 0

    constructor(private readonly send: (event: TimerTitleEvent) => void, readonly width = 160) {
        livePixels(0, 1, width)
    }

    get sentCount(): number { return this.calls }
    requestSnapshot(): void { if (!this.stopped) this.snapshot = true }
    stop(): void { this.stopped = true; this.snapshot = false }

    publish(timer: Timer, now = Date.now()): boolean {
        if (this.stopped) return false
        const event = timerTitleEvent(timer, this.width, now)
        // Timer.of 的秒/毫秒转换可能留下浮点尾差；按毫秒比较语义相同的计时锚点。
        const signature = JSON.stringify(event.state === 'R' ? ['R', Math.round(timer.seconds * 1000), Math.round(timer.startedAt!)]
            : event.state === 'P' ? ['P', event.pixels] : ['D'])
        if (!this.snapshot && signature === this.previous) return false
        this.send(event)
        this.previous = signature
        this.snapshot = false
        this.calls++
        return true
    }
}
