import { LiveFrameCodec } from '../core/liveFrame.js'

/**
 * 实验性帧发送器：合并最新状态、整帧去重、限制发送频率，失败时保留重试状态。
 * 不创建定时器，不包含 Minecraft API，也不保证客户端确认收到；重建 UI 后用 requestSnapshot() 重发。
 */
export class LiveFrameSender {
    private current: Record<string, number>
    private lastSent?: number
    private lastAttemptTick = -Infinity
    private snapshot = true
    private stopped = false
    private calls = 0
    private readonly interval: number

    constructor(
        readonly codec: LiveFrameCodec,
        initial: Readonly<Record<string, number>>,
        private readonly send: (packed: number) => void,
        options: { minIntervalTicks?: number } = {},
    ) {
        this.interval = options.minIntervalTicks ?? 2
        if (!Number.isSafeInteger(this.interval) || this.interval < 1) throw new Error('minIntervalTicks must be a positive integer')
        this.current = codec.decode(codec.encode(initial))
    }

    get sentCount(): number { return this.calls }
    get state(): Readonly<Record<string, number>> { return { ...this.current } }

    update(patch: Readonly<Record<string, number>>): void {
        if (this.stopped) return
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Live patch must be an object')
        // 失败时不修改任何字段；成功后只保留投影到整数范围内的状态。
        const next = this.codec.decode(this.codec.encode({ ...this.current, ...patch }))
        this.current = next
    }

    requestSnapshot(): void { if (!this.stopped) this.snapshot = true }
    stop(): void { this.stopped = true; this.snapshot = false }

    /** tick 应使用 system.currentTick；同一 tick 最多尝试一次，重发快照也遵守频率限制。 */
    flush(tick: number): boolean {
        if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('tick must be a nonnegative integer')
        if (this.stopped || tick - this.lastAttemptTick < this.interval) return false
        const packed = this.codec.encode(this.current)
        if (!this.snapshot && packed === this.lastSent) return false
        this.lastAttemptTick = tick
        this.send(packed)
        this.lastSent = packed
        this.snapshot = false
        this.calls++
        return true
    }
}
