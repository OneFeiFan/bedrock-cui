/**
 * 计时器：只记开始的时刻与总时长，用于倒计时、冷却、加工进度这类随时间匀速推进的显示。
 *
 *   props: { cooldown: Timer.idle(10) },                    // 10 秒、尚未开始（默认值：组件据此得知总时长）
 *   state() { return { cooldown: Timer.idle(10) } },
 *   computed: { cooldown() { return this.cooldown } },     // 逻辑中的计时器 → 界面的 prop
 *   methods: { start() { this.cooldown = this.cooldown.start() } },
 *
 * 界面中的 ProgressBar 按「数值定起点、动画匀速走」显示：脚本只在打开或重新打开时传入当前进度，
 * 之后由客户端的动画推进，计时期间不刷新（真机已验证，见 docs/design/screen-api.md 第 17–18 节）。
 * 传给界面的编码：未开始 I0、进行中 R<千分比>、暂停 P<千分比>、完成 D1000（状态用前缀表示：显示条件用「包含」，不用比较）。
 * 计时器不可变：start() 等返回新的计时器，赋值给状态即触发更新。
 */
export class Timer {
    private constructor(
        /** 总时长（秒） */
        readonly seconds: number,
        /** 开始的时刻（毫秒；进行中时有值） */
        readonly startedAt?: number,
        /** 暂停时已经过去的毫秒数（暂停时有值） */
        readonly pausedElapsed?: number,
    ) {
        if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(seconds * 1000)) {
            throw new Error(`计时器的总时长必须大于 0 且能换算为有限的毫秒数（收到 ${seconds}）`)
        }
        if (startedAt !== undefined && !Number.isFinite(startedAt)) throw new Error(`计时器的开始时刻必须是有限的数字（收到 ${startedAt}）`)
    }

    /** 一个尚未开始的计时器 */
    static idle(seconds: number): Timer { return new Timer(seconds) }

    /**
     * 由已有的数据构造：总时长、已经过去的秒数、是否正在进行。用于把界面绑定到游戏中的对象，
     * 例如实体用动态属性记下的开始时刻：Timer.of({ seconds: 30, elapsed: (Date.now() - start) / 1000, running: true })。
     * running 为 false 时：elapsed 为 0 是未开始，大于 0 是暂停；elapsed 达到总时长即完成
     */
    static of(o: { seconds: number, elapsed: number, running: boolean, now?: number }): Timer {
        if (!Number.isFinite(o.elapsed)) throw new Error(`计时器已过去的秒数必须是有限的数字（收到 ${o.elapsed}）`)
        if (o.now !== undefined && !Number.isFinite(o.now)) throw new Error(`计时器的当前时刻必须是有限的数字（收到 ${o.now}）`)
        const elapsedMs = Math.max(0, Math.min(o.seconds, o.elapsed)) * 1000
        if (o.running) return new Timer(o.seconds, (o.now ?? Date.now()) - elapsedMs)
        return elapsedMs > 0 ? new Timer(o.seconds, undefined, elapsedMs) : new Timer(o.seconds)
    }

    /** 从头开始（返回新的计时器） */
    start(now = Date.now()): Timer { return new Timer(this.seconds, now) }
    /** 暂停（进行中时；返回新的计时器） */
    pause(now = Date.now()): Timer { return this.startedAt === undefined ? this : new Timer(this.seconds, undefined, this.elapsed(now)) }
    /** 从暂停处继续（返回新的计时器） */
    resume(now = Date.now()): Timer { return this.pausedElapsed === undefined ? this : new Timer(this.seconds, now - this.pausedElapsed) }
    /** 回到未开始 */
    reset(): Timer { return new Timer(this.seconds) }

    /** 已经过去的毫秒数（不超过总时长） */
    elapsed(now = Date.now()): number {
        if (!Number.isFinite(now)) throw new Error(`计时器的当前时刻必须是有限的数字（收到 ${now}）`)
        const ms = this.startedAt !== undefined ? now - this.startedAt : this.pausedElapsed ?? 0
        return Math.max(0, Math.min(this.seconds * 1000, ms))
    }
    /** 剩余的秒数 */
    remaining(now = Date.now()): number { return this.seconds - this.elapsed(now) / 1000 }
    /** 进度（0 到 1） */
    progress(now = Date.now()): number { return this.elapsed(now) / (this.seconds * 1000) }
    /** 是否已经开始、尚未完成、没有暂停 */
    isRunning(now = Date.now()): boolean { return this.startedAt !== undefined && this.elapsed(now) < this.seconds * 1000 }
    /** 是否已经完成 */
    isDone(now = Date.now()): boolean { return this.elapsed(now) >= this.seconds * 1000 }

    /** 传给界面的文字：I0 / R<千分比> / P<千分比> / D1000 */
    encode(now = Date.now()): string {
        const permille = Math.round(this.progress(now) * 1000)
        if (this.isDone(now)) return 'D1000'
        if (this.startedAt !== undefined) return `R${permille}`
        if (this.pausedElapsed !== undefined) return `P${permille}`
        return 'I0'
    }
    /** 写进清单（JSON）时：未开始的编码 */
    toJSON(): string { return 'I0' }
}
