import { Timer } from '../core/timer.js'
import { ACTIONBAR_NOTICE_TICKS, ACTIONBAR_TIMER_PREFIX, actionbarTimerHeader, encodeTimerFrame, timerFrameCodec } from '../core/timerFrame.js'
import type { HudTitleOptions, HudTitleText, TimerHud, TimerHudManifest } from '../core/timerHud.js'
import type { RawMessage } from '@minecraft/server'

export interface TimerHudPlayer { readonly id: string }
export interface TimerHudPlatform<P extends TimerHudPlayer = TimerHudPlayer> {
    title(player: P, text: HudTitleText, options?: { fadeInDuration: number, stayDuration: number, fadeOutDuration: number, subtitle?: HudTitleText }): void
    actionbar(player: P, text: HudTitleText): void
    subtitle?(player: P, text: HudTitleText): void
    now?(): number
    /** 游戏 tick 调度，返回取消函数；省略时由测试或宿主主动调用 tick() */
    schedule?(fn: () => void, ticks: number): () => void
    error?(message: string, error: unknown): void
}
interface Session<P> {
    hud: TimerHud
    manifest: TimerHudManifest
    player: P
    timers: Record<string, Timer>
    signature?: string
    snapshot: boolean
    failures: number
    notice?: { text: HudTitleText, until: number }
    actionbarSent?: boolean
}
type TitleOptions = { fadeInDuration: number, stayDuration: number, fadeOutDuration: number, subtitle: HudTitleText }
interface PendingTitle { text: HudTitleText, options: TitleOptions }
interface TitleSession<P> { player: P, until: number, pending: PendingTitle[], failures: number }
const MAX_PENDING_TITLES = 8
const rawParts = (value: HudTitleText): RawMessage[] => (Array.isArray(value) ? value : [value])
    .map((part) => typeof part === 'string' ? { text: part } : part)

/** 同一玩家的一份计时快照和标题租约；只有状态变化、计时结束或标题到期才唤醒。 */
export class TimerHudRuntime<P extends TimerHudPlayer = TimerHudPlayer> {
    private manifests = new Map<string, TimerHudManifest>()
    private sessions = new Map<string, Session<P>>()
    private titles = new Map<string, TitleSession<P>>()
    private owners = new Map<string, 'timers' | 'title'>()
    private cancelWake?: () => void
    private wakeAt = Infinity

    constructor(private readonly platform: TimerHudPlatform<P>) {}
    private now(): number { return this.platform.now?.() ?? Date.now() }
    register(manifests: Record<string, TimerHudManifest>): void {
        const staged = new Map<string, TimerHudManifest>()
        for (const source of Object.values(manifests)) {
            const transport = source.transport ?? 'title'
            if (transport !== 'title' && transport !== 'actionbar') throw new Error('未知的计时传输通道')
            const manifest: TimerHudManifest = { id: source.id, namespace: source.namespace, prefix: source.prefix,
                receiver: source.receiver, steps: source.steps, names: [...source.names], titlePolicy: source.titlePolicy,
                ...(transport === 'actionbar' ? { transport } : {}) }
            if (!manifest.id || !manifest.namespace || !manifest.receiver || !['priority', 'actionbar'].includes(manifest.titlePolicy)) throw new Error('计时 HUD 清单不完整')
            if (manifest.prefix.startsWith('cui.timers|v3|')) throw new Error('V17 计时清单已撤回，请重新构建资源包与行为包')
            const isActionbarPacket = manifest.prefix.startsWith(ACTIONBAR_TIMER_PREFIX)
            if (isActionbarPacket !== (transport === 'actionbar') ||
                (isActionbarPacket && manifest.prefix !== `${ACTIONBAR_TIMER_PREFIX}${manifest.namespace}|${manifest.id}|`)) {
                throw new Error('计时 HUD 通道与协议不匹配，请重新构建资源包与行为包')
            }
            timerFrameCodec(manifest)
            const existing = staged.get(manifest.id) ?? this.manifests.get(manifest.id)
            if (existing && JSON.stringify(existing) !== JSON.stringify(manifest)) throw new Error(`计时 HUD id 冲突：${manifest.id}`)
            Object.freeze(manifest.names)
            staged.set(manifest.id, Object.freeze(manifest))
        }
        for (const manifest of staged.values()) this.manifests.set(manifest.id, manifest)
    }
    private wake(delay = 1): void {
        if (!this.platform.schedule) return
        const ticks = Math.min(0x7fffffff, Math.max(1, delay))
        const due = this.now() + ticks * 50
        if (this.wakeAt <= due) return
        this.cancelWake?.()
        this.wakeAt = due
        this.cancelWake = this.platform.schedule(() => {
            this.cancelWake = undefined
            this.wakeAt = Infinity
            this.tick()
        }, ticks)
    }
    private idle(): void {
        if (this.sessions.size || this.titles.size) return
        this.cancelWake?.()
        this.cancelWake = undefined
        this.wakeAt = Infinity
    }

    open(hud: TimerHud, player: TimerHudPlayer, values: Partial<Record<string, Timer>> = {}): void {
        const manifest = this.manifests.get(hud.id)
        if (!manifest) throw new Error(`计时 HUD ${hud.id} 未登记，请检查 cui.config 和 cui.generated.js`)
        const timers = { ...hud.options.timers, ...values } as Record<string, Timer>
        encodeTimerFrame(manifest, timers, this.now())
        const previous = this.sessions.get(player.id)
        if (previous && previous.manifest.transport !== manifest.transport) this.close(previous.hud, player)
        this.sessions.set(player.id, { hud, manifest, player: player as P, timers, snapshot: true, failures: 0,
            actionbarSent: manifest.transport === 'actionbar' && previous?.actionbarSent })
        this.wake()
    }
    update(hud: TimerHud, player: TimerHudPlayer, patch: Partial<Record<string, Timer>>): void {
        const session = this.sessions.get(player.id)
        if (!session || session.hud.id !== hud.id) throw new Error(`玩家没有打开计时 HUD ${hud.id}`)
        const timers = { ...session.timers, ...patch } as Record<string, Timer>
        encodeTimerFrame(session.manifest, timers, this.now())
        session.timers = timers
        this.wake()
    }
    close(hud: TimerHud, player: TimerHudPlayer): void {
        const session = this.sessions.get(player.id)
        if (!session || session.hud.id !== hud.id) return
        this.sessions.delete(player.id)
        if (session.manifest.transport === 'actionbar') {
            if (session.actionbarSent) {
                try {
                    const notice = session.notice
                    this.platform.actionbar(session.player, notice && notice.until > this.now() ? notice.text : '')
                } catch (error) { this.platform.error?.('清理计时 HUD 失败', error) }
            }
        } else if (this.owners.get(player.id) === 'timers') {
            this.owners.delete(player.id)
            try { this.platform.title(session.player, '') } catch (error) { this.platform.error?.('清理计时 HUD 失败', error) }
        }
        this.idle()
    }
    isOpen(hud: TimerHud, player: TimerHudPlayer): boolean { return this.sessions.get(player.id)?.hud.id === hud.id }
    /** 玩家离开时只清理服务端状态，不对失效 Player 调用 API。 */
    remove(playerId: string): void {
        this.sessions.delete(playerId)
        this.titles.delete(playerId)
        this.owners.delete(playerId)
        this.idle()
    }
    /** 重生或 HUD 重建后发送完整当前快照 */
    requestSnapshot(player: P): void {
        const title = this.titles.get(player.id)
        if (title) title.player = player
        const session = this.sessions.get(player.id)
        if (!session) return
        session.player = player
        session.snapshot = true
        this.wake()
    }

    title(player: TimerHudPlayer, text: HudTitleText, options: HudTitleOptions = {}): void {
        const session = this.sessions.get(player.id)
        const policy = options.policy ?? session?.manifest.titlePolicy ?? 'priority'
        if (policy !== 'priority' && policy !== 'actionbar') throw new Error('未知的标题策略')
        if (policy === 'actionbar') {
            const message: HudTitleText = options.subtitle === undefined ? text
                : { rawtext: [...rawParts(text), { text: ' — ' }, ...rawParts(options.subtitle)] }
            if (session?.manifest.transport === 'actionbar') {
                if (message === '' && !session.notice) return
                session.notice = message === '' ? undefined : {
                    text: JSON.parse(JSON.stringify(message)), until: this.now() + ACTIONBAR_NOTICE_TICKS * 50,
                }
                session.snapshot = true
                this.wake()
                return
            }
            this.platform.actionbar(player as P, message)
            return
        }
        const fadeInDuration = options.fadeInDuration ?? 10, stayDuration = options.stayDuration ?? 70, fadeOutDuration = options.fadeOutDuration ?? 20
        if (![fadeInDuration, stayDuration, fadeOutDuration].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 0x7fffffff)) throw new Error('标题时长须是非负整数 tick')
        const mode = options.mode ?? 'queue'
        if (mode !== 'queue' && mode !== 'replace') throw new Error('未知的标题排队方式')
        if (text === '') {
            this.clearTitle(player)
            return
        }
        const current = this.titles.get(player.id)
        if (current && mode === 'queue' && current.pending.length >= MAX_PENDING_TITLES) throw new Error('每名玩家最多等待 8 条中央标题')
        // 延迟发送时保留调用当时的 RawMessage，避免调用方后来修改它；缺省字幕必须清空。
        const item: PendingTitle = JSON.parse(JSON.stringify({ text,
            options: { fadeInDuration, stayDuration, fadeOutDuration, subtitle: options.subtitle ?? '' } }))
        if (current && mode === 'queue') {
            current.player = player as P
            current.pending.push(item)
            this.wake(Math.ceil((current.until - this.now()) / 50))
            return
        }
        const title: TitleSession<P> = { player: player as P, until: 0, pending: [], failures: 0 }
        this.sendTitle(title, item)
        this.titles.set(player.id, title)
    }

    private sendTitle(title: TitleSession<P>, item: PendingTitle): void {
        this.platform.title(title.player, item.text, item.options)
        const { fadeInDuration, stayDuration, fadeOutDuration } = item.options
        title.until = this.now() + (fadeInDuration + stayDuration + fadeOutDuration + 1) * 50
        title.failures = 0
        const player = title.player, session = this.sessions.get(player.id)
        this.owners.set(player.id, 'title')
        if (session && session.manifest.transport !== 'actionbar') session.snapshot = true
        this.wake(Math.ceil((title.until - this.now()) / 50))
    }

    updateSubtitle(player: TimerHudPlayer, text: HudTitleText): boolean {
        const title = this.titles.get(player.id)
        if (!title || title.until <= this.now()) return false
        if (!this.platform.subtitle) throw new Error('当前宿主未提供字幕更新接口')
        this.platform.subtitle(player as P, text)
        title.player = player as P
        return true
    }

    clearTitle(player: TimerHudPlayer): boolean {
        if (!this.titles.has(player.id)) return false
        const session = this.sessions.get(player.id)
        // 有 HUD 时让下一 tick 的完整快照直接接替，不先发空标题再重建一次。
        if (!session || session.manifest.transport === 'actionbar') this.platform.title(player as P, '', { fadeInDuration: 0, stayDuration: 0, fadeOutDuration: 0, subtitle: '' })
        this.titles.delete(player.id)
        this.owners.delete(player.id)
        if (session && session.manifest.transport !== 'actionbar') { session.player = player as P; session.snapshot = true; this.wake() }
        this.idle()
        return true
    }

    /** 宿主可主动调用；不会发送没有变化的进度，所有计时器共享同一采样时刻。 */
    tick(): void {
        this.cancelWake?.()
        this.cancelWake = undefined
        this.wakeAt = Infinity
        const now = this.now()
        for (const [id, title] of this.titles) if (title.until <= now) {
            if (title.pending.length) {
                try {
                    this.sendTitle(title, title.pending[0])
                    title.pending.shift()
                    continue
                } catch (error) {
                    this.platform.error?.('显示排队标题失败', error)
                    // 临时失败最多重试三次；失效队列不能一直阻塞计时器。
                    if (++title.failures < 3) { title.until = now + 50; continue }
                }
            }
            this.titles.delete(id)
            if (this.owners.get(id) === 'title') this.owners.delete(id)
            const session = this.sessions.get(id)
            if (session && session.manifest.transport !== 'actionbar') session.snapshot = true
        }
        let next = Infinity
        for (const title of this.titles.values()) next = Math.min(next, title.until)
        for (const [id, session] of this.sessions) {
            const byActionbar = session.manifest.transport === 'actionbar'
            if (!byActionbar && this.titles.has(id)) continue
            if (session.notice && session.notice.until <= now) {
                session.notice = undefined
                session.snapshot = true
            }
            const notice = session.notice
            if (notice) next = Math.min(next, notice.until)
            try {
                const frame = encodeTimerFrame(session.manifest, session.timers, now)
                if (session.snapshot || frame.signature !== session.signature) {
                    if (byActionbar) {
                        const noticeTicks = notice ? Math.min(ACTIONBAR_NOTICE_TICKS, Math.ceil((notice.until - now) / 50)) : 0
                        const header = actionbarTimerHeader(frame, noticeTicks)
                        this.platform.actionbar(session.player, notice ? { rawtext: [{ text: header }, ...rawParts(notice.text)] } : header)
                        session.actionbarSent = true
                    } else {
                        this.platform.title(session.player, frame.payload, { ...frame.options, subtitle: '' })
                        this.owners.set(id, 'timers')
                    }
                    session.signature = frame.signature
                    session.snapshot = false
                    session.failures = 0
                }
                for (const timer of Object.values(session.timers)) if (timer.isRunning(now)) next = Math.min(next, now + timer.remaining(now) * 1000)
            } catch (error) {
                this.platform.error?.(`计时 HUD ${session.manifest.id} 更新失败`, error)
                if (++session.failures >= 3) this.remove(id)
                else next = Math.min(next, now + 50)
            }
        }
        if (Number.isFinite(next)) this.wake(Math.max(1, Math.ceil((next - now) / 50)))
        this.idle()
    }
}
