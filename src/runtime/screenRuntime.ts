/**
 * 界面（defineScreen）的脚本端运行时：与平台无关的部分。显示表单的操作由 FormPlatform 注入——
 * 行为包中用游戏的 ActionFormData（runtime/screens.ts），测试中用模拟的平台。
 *
 * 流程：open(玩家, props) → 每个玩家一个实例（state() 初始化，onOpen）→ 按清单把 props 的值填进按钮、显示表单 →
 * 玩家点击 button(名字) → 调用 methods 中的同名方法 → 以新的 props 重新打开，刚才点击的按钮获得默认焦点（真机 1.36.0）；
 * 翻页按钮按路由表翻页；玩家关闭表单 → onClose，实例销毁。设计见 docs/design/screen-api.md。
 */
import { _propDefault, type PropItem, type Screen, type ScreenManifest } from '../core/screen.js'
import { buttonIconOf, pageTitle, pagingButtons, pagingResponse, type FormButtonSpec, type ServerPaging } from '../core/serverPagesShared.js'

/** 玩家（只用到 id；行为包中是游戏的 Player） */
export interface ScreenPlayer { readonly id: string }

/** 要显示的表单；replace：这是刷新时替换旧表单的新表单（遇到「玩家正忙」时平台可以再关一次旧表单） */
export interface FormSpec { title: string, body: string, buttons: { text: string, icon?: string }[], replace?: boolean }

/** 表单的结果 */
export interface FormResult { canceled: boolean, selection?: number, cancelationReason?: string }

/** 平台：显示与关闭表单、锁视角、定时器 */
export interface FormPlatform<P extends ScreenPlayer = ScreenPlayer> {
    /** 显示表单；onBusy 记录重试；isActive 为假时平台停止重试已关闭或已被替换的请求 */
    show(player: P, form: FormSpec, onBusy?: () => void, isActive?: () => boolean): Promise<FormResult>
    close?(player: P): void
    lockCamera?(player: P, on: boolean): void
    /** 安排在当前代码执行完后运行（合并队列的刷新；缺省微任务） */
    schedule?(fn: () => void): void
    /** 每隔 ticks 刻执行一次；返回取消函数 */
    interval?(fn: () => void, ticks: number): () => void
    /** ticks 刻后执行一次；返回取消函数 */
    timeout?(fn: () => void, ticks: number): () => void
    /** 当前时间（毫秒；缺省 Date.now()） */
    now?(): number
    /** 逻辑中的 this.mc：游戏中为 @minecraft/server，浏览器预览中为模拟对象 */
    mc?: unknown
    /** 逻辑发出了事件（在交给脚本的处理函数之前调用；浏览器预览用来写日志） */
    emitted?(player: P, event: string, args: unknown[]): void
}

type Manifest = ScreenManifest & { paging?: ServerPaging }

/** 一个玩家打开的一个界面 */
class Instance {
    state: Record<string, unknown>
    ctx: Record<string, any>
    openProps: Record<string, unknown> = {}
    page?: string
    dir: 'prev' | 'next' | 'back' = 'next'
    /** 多页时的历史（back() 返回用） */
    history: string[] = []
    /** 已经提示过总时长不一致的数据 */
    warnedTimer?: Set<string>
    /** 显示中的计时器最早在多少毫秒后结束（form() 中记下）；到时刷新一次 */
    timerEnd?: number
    /** 取消「计时结束时刷新」 */
    stopTimerEnd?: () => void
    /** 刚才点击的按钮的序号（重新打开时它获得默认焦点） */
    focus?: number
    closed = false
    /** 正在执行方法或生命周期（期间的状态变化随之后的重新打开一起生效） */
    busy = false
    /** 表单正在显示，等待玩家操作 */
    displayed = false
    /** 已在合并队列中 */
    queued = false
    /** 刷新已推迟到安静下来 */
    deferred = false
    stopDeferred?: () => void
    /** 点击与事件处理串行执行；等待表单结果不占用队列 */
    actions: (() => void | Promise<void>)[] = []
    processing = false
    /** 一批点击处理完后，只以最终状态重新显示一次 */
    needsShow = false
    /** this.emit() 发出、尚未交给脚本处理的事件 */
    emits: [string, unknown[]][] = []
    /** this.setInterval / setTimeout 创建的定时器（关闭时全部取消） */
    timers = new Set<() => void>()
    /** 第几次显示：刷新以「替换」方式发出新表单时，旧表单迟到的结果按编号忽略 */
    gen = 0
    /** 下一次显示是替换旧表单的刷新 */
    replacing = false
    /** 最近一次显示表单的时间（毫秒） */
    shownAt = 0
    /** 最近一次显示之后状态有变化（没有变化的刷新可以跳过） */
    dirty = false

    constructor(readonly screen: Screen, readonly manifest: Manifest, readonly player: ScreenPlayer, readonly runtime: ScreenRuntime) {
        const { state, computed = {}, methods = {}, props = {} } = screen.options
        // 深层响应式：普通对象与数组的任何修改（含 push）都触发更新；类的实例（游戏对象、Timer）不跟踪
        const proxies = new WeakMap<object, object>()
        const originals = new WeakMap<object, object>()
        const changed = () => { this.dirty = true; runtime.enqueue(this) }
        const reactive = <T>(v: T): T => {
            if (!v || typeof v !== 'object') return v
            if (originals.has(v as object)) return v
            const proto = Object.getPrototypeOf(v)
            if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return v
            const hit = proxies.get(v as object)
            if (hit) return hit as T
            const p = new Proxy(v as object, {
                get: (t, k, r) => reactive(Reflect.get(t, k, r)),
                set: (t, k, val, r) => {
                    const value = val && typeof val === 'object' ? originals.get(val) ?? val : val
                    const had = Object.prototype.hasOwnProperty.call(t, k), before = Reflect.get(t, k, r)
                    const ok = Reflect.set(t, k, value, r)
                    if (ok && (!had || !Object.is(before, value))) changed()
                    return ok
                },
                deleteProperty: (t, k) => { const had = Object.prototype.hasOwnProperty.call(t, k), ok = Reflect.deleteProperty(t, k); if (ok && had) changed(); return ok },
            })
            proxies.set(v as object, p)
            originals.set(p, v as object)
            return p as T
        }
        this.state = reactive({ ...(state ? state.call({}) : {}) })
        this.page = manifest.paging?.start
        const inst = this
        // this：读写状态、读 computed、调用方法；this.player、this.close()
        this.ctx = new Proxy({}, {
            get(_, key) {
                if (typeof key === 'symbol') return undefined
                if (key === 'player') return inst.player
                if (key === 'close') return () => { if (!inst.closed) runtime.close(inst.screen, inst.player) }
                if (key === 'refresh') return () => { inst.dirty = true; runtime.enqueue(inst) }
                // 事件总线：交给脚本中 screen.on(事件名, 处理函数) 登记的处理函数（合并队列中处理）
                if (key === 'emit') return (event: string, ...args: unknown[]) => { inst.emits.push([event, args]); runtime.enqueue(inst) }
                // 与界面生命周期绑定的定时器：界面关闭时自动取消；返回取消函数
                if (key === 'setInterval' || key === 'setTimeout') return (fn: () => void, ticks: number) => {
                    if (inst.closed) return () => { }
                    const make = key === 'setInterval' ? runtime.platform.interval : runtime.platform.timeout
                    if (!make) throw new Error(`当前环境不支持 this.${key}()`)
                    let cancel = () => { }
                    const wrapped = () => {
                        if (inst.closed) return
                        if (key === 'setTimeout') inst.timers.delete(stop)
                        try { fn.call(inst.ctx) } catch (e) { runtime.fail(inst, e) }
                    }
                    cancel = make(wrapped, ticks)
                    const stop = () => { cancel(); inst.timers.delete(stop) }
                    inst.timers.add(stop)
                    return stop
                }
                if (key === 'mc') return runtime.platform.mc
                if (key in props) return inst.propValue(key)
                if (key in inst.state) return inst.state[key]
                if (key in computed) return computed[key].call(inst.ctx)
                if (key in methods) return methods[key].bind(inst.ctx)
                return undefined
            },
            set(_, key, value) {
                if (typeof key === 'symbol') return false
                // 写入状态（深层响应式的 Proxy 负责触发更新）；处理点击期间的变化随之后的重新打开生效
                inst.state[key] = value
                return true
            },
            has(_, key) { return typeof key === 'string' && (key in props || key in inst.state || key in computed || key in methods) },
        })
    }

    /** 一个 prop 的值：open() 传入的值，没有时取默认值 */
    propValue(name: string): unknown {
        if (name in this.openProps) return this.openProps[name]
        return _propDefault(this.screen.id, name, this.screen.options.props?.[name])
    }

    /** 视图读取的一项数据的当前值（按来源） */
    dataValue(d: ScreenManifest['data'][number]): unknown {
        if (d.source === 'prop') return this.propValue(d.name)
        if (d.source === 'state') return this.state[d.name]
        return this.screen.options.computed?.[d.name]?.call(this.ctx)
    }

    /** 按清单生成表单 */
    form(): FormSpec {
        this.timerEnd = undefined
        const m = this.manifest
        const own: Record<number, FormButtonSpec> = {}
        for (const p of m.data) {
            const v = this.dataValue(p)
            const values = p.kind === 'list' ? (Array.isArray(v) ? v : []) : [v]
            p.slots.forEach((s, i) => {
                const x = values[i] as PropItem | boolean | undefined | null
                // 没有值：false、null、undefined、空字符串（按钮文字留空，「有值」的判断为假）
                if (x === undefined || x === null || x === false || x === '') return
                if (x === true) { own[s.index] = s.tag; return }
                // 计时器（Timer）：按当前时刻编码（I0 / R<千分比> / P<千分比> / D1000）
                if (typeof (x as { encode?: unknown }).encode === 'function') {
                    const t = x as unknown as { seconds: number, encode(now: number): string, isRunning(now: number): boolean, remaining(now: number): number }
                    const now = this.runtime.currentTime()
                    // 组件的速度按构建时的总时长决定：总时长不同时，进度条与倒计时会走得太快或太慢
                    if (p.timerSeconds !== undefined && t.seconds !== p.timerSeconds && !this.warnedTimer?.has(p.name)) {
                        (this.warnedTimer ??= new Set()).add(p.name)
                        console.warn(`[bedrock-cui] ${this.screen.id}：${p.name} 的总时长是 ${t.seconds} 秒，而界面中的组件按 ${p.timerSeconds} 秒构建（取自初始值），显示的速度会不对。总时长不同的对象，请用不同的界面或组件`)
                    }
                    own[s.index] = s.tag + t.encode(now)
                    // 进行中的计时器：记下最早结束的时刻，到时刷新一次（显示「完成」）
                    if (p.refreshAtEnd && t.isRunning(now)) this.timerEnd = Math.min(this.timerEnd ?? Infinity, t.remaining(now) * 1000)
                    return
                }
                if (typeof x === 'string' || typeof x === 'number') { own[s.index] = s.tag + String(x); return }
                own[s.index] = x.icon ? { text: s.tag + x.text, icon: x.icon } : s.tag + x.text
            })
        }
        for (const b of m.buttons) own[b.index] = b.index === this.focus ? b.focusTag : b.tag
        // 「返回」：有历史时才显示；刚才点击了它时发送聚焦版
        if (m.back && this.history.length) own[m.back.index] = m.back.index === this.focus ? m.back.focusTag : m.back.tag
        const texts = m.paging
            ? pagingButtons(m.paging, this.page ?? m.paging.start, this.dir, own)
            : Array.from({ length: Math.max(-1, ...Object.keys(own).map(Number)) + 1 }, (_, i) => (typeof own[i] === 'object' ? (own[i] as { text: string }).text : (own[i] as string | undefined) ?? ''))
        return {
            title: m.paging ? pageTitle(m.paging, this.page ?? m.paging.start) : m.id,
            body: '',
            buttons: texts.map((text, i) => { const icon = buttonIconOf(own[i]); return icon ? { text, icon } : { text } }),
        }
    }
}

/** 运行时：登记清单，打开、关闭界面 */
export class ScreenRuntime<P extends ScreenPlayer = ScreenPlayer> {
    private manifests = new Map<string, Manifest>()
    private instances = new Map<string, Instance>()
    /**
     * 表单显示后的这段时间内（毫秒）推迟刷新。刷新是「关闭再打开」，两者之间若恰好发生点击，点击会丢失（客户端没有可点的表单）；
     * 玩家连续点击时，每次点击本来就会以最新的状态重新打开，不需要再刷新——推迟到安静下来，碰撞的机会就小得多（真机 1.40.0：仍偶尔丢点击）
     */
    quietMs = 400
    private now(): number { return this.platform.now ? this.platform.now() : Date.now() }
    /** @internal 当前时刻（毫秒；计时器编码用） */
    currentTime(): number { return this.now() }

    /** 诊断记录：最近 60 条关键步骤（显示、结果、合并、推迟、替换、重试、关闭），出现异常后用 trace() 取出 */
    private traceLog: string[] = []
    private log(inst: Instance, msg: string): void {
        this.traceLog.push(`${String(this.now() % 100000).padStart(5, '0')} ${inst.screen.id.replace('cui_ui:', '')} ${msg}`)
        if (this.traceLog.length > 60) this.traceLog.shift()
    }
    /** 取出诊断记录（最近的在后） */
    trace(): string[] { return [...this.traceLog] }

    constructor(readonly platform: FormPlatform<P>) { }

    /** 登记构建生成的清单（cui.generated.js 中的 screens） */
    register(manifests: Record<string, Manifest>): void {
        for (const [id, m] of Object.entries(manifests)) this.manifests.set(id, m)
    }

    private key(screen: Screen, player: ScreenPlayer) { return `${screen.id}\u0000${player.id}` }

    /** 某个玩家是否打开着这个界面 */
    isOpen(screen: Screen, player: P): boolean { return this.instances.has(this.key(screen, player)) }

    /** 为玩家打开界面；props 为传给界面的数据（未传的取 computed 或默认值）。已打开时更新 props 并重新显示 */
    open(screen: Screen, player: P, props: Record<string, unknown> = {}): void {
        const manifest = this.manifests.get(screen.id)
        if (!manifest) throw new Error(`界面 ${screen.id} 没有登记清单：在行为包脚本的入口导入构建生成的 ./cui.generated.js`)
        const k = this.key(screen, player)
        let inst = this.instances.get(k)
        if (!inst) {
            inst = new Instance(screen, manifest, player, this as unknown as ScreenRuntime)
            this.instances.set(k, inst)
            inst.openProps = props
            inst.busy = true
            try { screen.options.onOpen?.call(inst.ctx) } catch (e) { this.fail(inst, e); return } finally { inst.busy = false }
            if (inst.closed) return
            try { this.platform.lockCamera?.(player, true) } catch (e) { this.fail(inst, e); return }
            void this.show(inst)
            this.enqueue(inst)                                // onOpen 中发出的事件
        } else {
            // 已打开：合并新的 props，进入合并队列（与同一时刻的其他变化一起，只重新打开一次）
            inst.openProps = { ...inst.openProps, ...props }
            inst.dirty = true
            this.enqueue(inst)
        }
    }

    /** 关闭界面（onClose 之后实例销毁） */
    close(screen: Screen, player: ScreenPlayer): void {
        const k = this.key(screen, player)
        const inst = this.instances.get(k)
        if (!inst || inst.closed) return
        inst.closed = true
        inst.displayed = false
        inst.gen++
        inst.actions.length = 0
        inst.emits.length = 0
        this.log(inst, '关闭界面')
        this.instances.delete(k)
        // 清理中的某一步出错，仍继续取消定时器、解除视角锁定与执行 onClose。
        const cleanup = [...inst.timers, inst.stopTimerEnd, inst.stopDeferred,
            () => this.platform.close?.(player as P), () => this.platform.lockCamera?.(player as P, false),
            () => screen.options.onClose?.call(inst.ctx)]
        for (const fn of cleanup) {
            try { fn?.() } catch (e) { this.warn(inst, e) }
        }
    }

    /**
     * 合并队列：状态修改、this.refresh()、this.emit()、对已打开界面的 open() 都只是标记并入队；
     * 当前代码执行完后（微任务）一次处理：先把事件交给脚本，再在有变化时刷新一次。处理点击期间不入队（点击处理完本来就会重新打开）。
     * @internal
     */
    enqueue(inst: Instance): void {
        if (inst.closed || inst.busy || inst.queued) return
        inst.queued = true
        const run = () => { inst.queued = false; this.run(inst, () => this.flush(inst)) }
        if (this.platform.schedule) this.platform.schedule(run); else Promise.resolve().then(run)
    }

    private warn(inst: Instance, error: unknown): void {
        this.log(inst, `运行出错：${error}`)
        console.warn(`[bedrock-cui] ${inst.screen.id} 运行出错：${error}`)
    }

    /** @internal 运行出错后销毁实例，避免残留定时器与视角锁定 */
    fail(inst: Instance, error: unknown): void {
        this.warn(inst, error)
        if (!inst.closed) this.close(inst.screen, inst.player)
    }

    /** 每个实例只执行一个异步处理，旧表单迟到的点击也进入同一队列。 */
    private run(inst: Instance, action: () => void | Promise<void>): void {
        if (inst.closed) return
        inst.actions.push(action)
        if (inst.processing) return
        inst.processing = true
        void (async () => {
            inst.busy = true
            try {
                while (!inst.closed && inst.actions.length) {
                    const pending = inst.actions.shift()!()
                    if (pending) await pending
                }
                if (inst.closed) return
                if (inst.needsShow) {
                    inst.needsShow = false
                    if (inst.displayed) this.replaceNow(inst)
                    else void this.show(inst)
                }
            } catch (e) { this.fail(inst, e) } finally {
                inst.busy = false
                inst.processing = false
                if (!inst.closed && (inst.emits.length || (inst.dirty && inst.displayed && !inst.deferred))) this.enqueue(inst)
            }
        })()
    }

    /** 把 this.emit() 发出的事件交给脚本登记的处理函数（依次执行，可为异步；出错不影响界面） */
    private async deliver(inst: Instance): Promise<void> {
        while (!inst.closed && inst.emits.length) {
            const [event, args] = inst.emits.shift()!
            this.platform.emitted?.(inst.player as P, event, args)
            for (const handler of inst.screen._listeners(event)) {
                if (inst.closed) return
                try { await handler(inst.player, ...args) } catch (e) { console.warn(`[bedrock-cui] ${inst.screen.id} 的事件 ${event} 处理出错：${e}`) }
            }
        }
    }

    private flush(inst: Instance): void | Promise<void> {
        if (inst.closed) return
        if (inst.emits.length) return this.deliver(inst).then(() => this.refresh(inst))
        this.refresh(inst)
    }

    private refresh(inst: Instance): void {
        if (inst.closed || inst.needsShow || !inst.displayed || !inst.dirty || inst.deferred) return
        // 表单刚显示不久：推迟到安静下来（期间若玩家点击，重新打开时就带上了最新的状态，到时 dirty 为 false 就跳过）
        const wait = this.quietMs - (this.now() - inst.shownAt)
        if (wait > 0 && this.platform.timeout) {
            inst.deferred = true
            this.log(inst, `推迟刷新 ${Math.round(wait)} 毫秒`)
            inst.stopDeferred = this.platform.timeout(() => { inst.stopDeferred = undefined; inst.deferred = false; this.enqueue(inst) }, Math.max(1, Math.ceil(wait / 50)))
            return
        }
        // 刷新：关闭当前表单，同一刻立即显示新表单（旧表单迟到的取消忽略、迟到的点击照常处理）
        this.replaceNow(inst)
    }

    private async show(inst: Instance): Promise<void> {
        if (inst.closed) return
        const gen = ++inst.gen
        try {
            inst.displayed = true
            inst.shownAt = this.now()
            inst.dirty = false
            const replace = inst.replacing
            inst.replacing = false
            this.log(inst, `显示 #${gen}${replace ? '（替换）' : ''}`)
            const spec = inst.form()
            // 计时结束时刷新一次：动画的时长在构建时已定（总时长），计时结束后它不会自己停在「完成」
            inst.stopTimerEnd?.()
            inst.stopTimerEnd = undefined
            if (inst.timerEnd !== undefined && this.platform.timeout) {
                inst.stopTimerEnd = this.platform.timeout(() => { if (!inst.closed) { this.log(inst, '计时结束，刷新'); inst.dirty = true; this.enqueue(inst) } }, Math.ceil(inst.timerEnd / 50) + 1)
            }
            const r = await this.platform.show(inst.player as P, { ...spec, replace },
                () => this.log(inst, `#${gen} 玩家正忙，重试`), () => !inst.closed && gen === inst.gen)
            const stale = gen !== inst.gen                        // 已被「替换」：这是旧表单迟到的结果
            this.log(inst, `结果 #${gen}${stale ? '（旧）' : ''}：${r.canceled ? `取消 ${r.cancelationReason ?? ''}` : `点击 ${r.selection}`}`)
            if (!stale) inst.displayed = false
            if (inst.closed) return
            const clicked = !r.canceled && r.selection !== undefined
            if (stale) {
                // 旧表单的取消是刷新自己关的，忽略；旧表单上的点击照常处理，再刷新正在显示的表单（真机 1.39.0：忽略点击会丢掉约一半）
                if (!clicked) return
            }
            if (!clicked) { this.close(inst.screen, inst.player); return }
            this.run(inst, async () => {
                if (await this.handle(inst, r.selection!)) inst.needsShow = true
            })
        } catch (e) {
            // 已被替换或关闭的表单失败，不应关闭之后打开的界面。
            if (!inst.closed && gen === inst.gen) this.fail(inst, e)
            else this.warn(inst, e)
        }
    }

    /** 处理一次点击：翻页按钮翻页；button(名字) 调用同名方法、获得焦点、onUpdate。返回是否需要重新打开 */
    private async handle(inst: Instance, selection: number): Promise<boolean> {
        if (inst.closed) return false
        const m = inst.manifest
        let index = selection
        if (m.paging) {
            const next = pagingResponse(m.paging, selection, inst.page ?? m.paging.start, inst.dir)
            if (next.kind === 'turn') inst.history.push(inst.page ?? m.paging.start)      // 跳到别的页：记下来处
            if (next.kind !== 'own') { inst.page = next.page; inst.dir = next.dir; inst.focus = undefined; return true }
            index = next.index
            // 返回：回到上一次所在的页；方向记为 back（没有箭头获得聚焦版），焦点给「返回」按钮
            if (m.back && index === m.back.index) {
                const prev = inst.history.pop()
                if (prev !== undefined) { inst.page = prev; inst.dir = 'back' }
                inst.focus = m.back.index
                return true
            }
        }
        const b = m.buttons.find((x) => x.index === index)
        if (b) {
            inst.focus = b.index
            if (b.method === '__close') { this.close(inst.screen, inst.player); return false }
            await inst.screen.options.methods?.[b.method]?.call(inst.ctx, ...b.args)
        }
        if (inst.closed) return false
        await this.deliver(inst)                          // 方法中发出的事件：交给脚本处理完再重新打开（期间的更新合并为一次）
        if (inst.closed) return false
        inst.screen.options.onUpdate?.call(inst.ctx)
        return !inst.closed
    }

    /** 立即替换正在显示的表单（处理完旧表单上的点击后用） */
    private replaceNow(inst: Instance): void {
        if (inst.closed) return
        inst.gen++
        inst.replacing = true
        this.log(inst, '替换：关闭旧表单')
        this.platform.close?.(inst.player as P)
        void this.show(inst)
    }
}
