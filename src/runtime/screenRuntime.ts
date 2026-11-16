/**
 * 界面（defineScreen）的脚本端运行时：与平台无关的部分。显示表单的操作由 FormPlatform 注入——
 * 行为包中用游戏的 ActionFormData（runtime/screens.ts），测试中用模拟的平台。
 *
 * 流程：open(玩家, props) → 每个玩家一个实例（state() 初始化，onOpen）→ 按清单把 props 的值填进按钮、显示表单 →
 * 玩家点击 button(名字) → 调用 methods 中的同名方法 → 以新的 props 重新打开，刚才点击的按钮获得默认焦点（真机 1.36.0）；
 * 翻页按钮按路由表翻页；玩家关闭表单 → onClose，实例销毁。设计见 docs/design/screen-api.md。
 */
import type { PropItem, Screen, ScreenManifest } from '../core/screen.js'
import { buttonIconOf, pageTitle, pagingButtons, pagingResponse, type FormButtonSpec, type ServerPaging } from '../core/serverPagesShared.js'

/** 玩家（只用到 id；行为包中是游戏的 Player） */
export interface ScreenPlayer { readonly id: string }

/** 要显示的表单；replace：这是刷新时替换旧表单的新表单（遇到「玩家正忙」时平台可以再关一次旧表单） */
export interface FormSpec { title: string, body: string, buttons: { text: string, icon?: string }[], replace?: boolean }

/** 表单的结果 */
export interface FormResult { canceled: boolean, selection?: number, cancelationReason?: string }

/** 平台：显示与关闭表单、锁视角、定时器 */
export interface FormPlatform<P extends ScreenPlayer = ScreenPlayer> {
    /** 显示表单；onBusy：遇到「玩家正忙」、稍后重试之前调用（诊断记录用） */
    show(player: P, form: FormSpec, onBusy?: () => void): Promise<FormResult>
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
    dir: 'prev' | 'next' = 'next'
    focus?: string
    closed = false
    /** 正在执行方法或生命周期（期间的状态变化随之后的重新打开一起生效） */
    busy = false
    /** 表单正在显示，等待玩家操作 */
    displayed = false
    /** 已在合并队列中 */
    queued = false
    /** 刷新已推迟到安静下来 */
    deferred = false
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
        const { state, computed = {}, methods = {} } = screen.options
        this.state = { ...(state ? state() : {}) }
        this.page = manifest.paging?.start
        const inst = this
        // this：读写状态、读 computed、调用方法；this.player、this.close()
        this.ctx = new Proxy({}, {
            get(_, key) {
                if (typeof key === 'symbol') return undefined
                if (key === 'player') return inst.player
                if (key === 'close') return () => runtime.close(inst.screen, inst.player)
                if (key === 'refresh') return () => { inst.dirty = true; runtime.enqueue(inst) }
                // 事件总线：交给脚本中 screen.on(事件名, 处理函数) 登记的处理函数（合并队列中处理）
                if (key === 'emit') return (event: string, ...args: unknown[]) => { inst.emits.push([event, args]); runtime.enqueue(inst) }
                // 与界面生命周期绑定的定时器：界面关闭时自动取消；返回取消函数
                if (key === 'setInterval' || key === 'setTimeout') return (fn: () => void, ticks: number) => {
                    const make = key === 'setInterval' ? runtime.platform.interval : runtime.platform.timeout
                    if (!make) throw new Error(`当前环境不支持 this.${key}()`)
                    let cancel = () => { }
                    const wrapped = () => { if (inst.closed) return; if (key === 'setTimeout') inst.timers.delete(stop); fn.call(inst.ctx) }
                    cancel = make(wrapped, ticks)
                    const stop = () => { cancel(); inst.timers.delete(stop) }
                    inst.timers.add(stop)
                    return stop
                }
                if (key in inst.state) return inst.state[key]
                if (key in computed) return computed[key].call(inst.ctx)
                if (key in methods) return methods[key].bind(inst.ctx)
                return undefined
            },
            set(_, key, value) {
                if (typeof key === 'symbol') return false
                inst.state[key] = value
                inst.dirty = true
                // 状态变化：进入合并队列（浅层：重新赋值才触发）；处理点击期间的变化随之后的重新打开生效
                runtime.enqueue(inst)
                return true
            },
            has(_, key) { return typeof key === 'string' && (key in inst.state || key in computed || key in methods) },
        })
    }

    /** 一个 prop 的值：computed 中的同名项 → open() 传入的值 → 默认值 */
    propValue(name: string, fallback: unknown): unknown {
        const computed = this.screen.options.computed ?? {}
        if (name in computed) return computed[name].call(this.ctx)
        if (name in this.openProps) return this.openProps[name]
        return fallback
    }

    /** 按清单生成表单 */
    form(): FormSpec {
        const m = this.manifest
        const own: Record<number, FormButtonSpec> = {}
        for (const p of m.props) {
            const v = this.propValue(p.name, p.default)
            const values = p.kind === 'list' ? (Array.isArray(v) ? v : []) : [v]
            p.slots.forEach((s, i) => {
                const x = values[i] as PropItem | boolean | undefined | null
                if (x === undefined || x === null || x === false) return
                if (x === true) { own[s.index] = s.tag; return }
                if (typeof x === 'string' || typeof x === 'number') { own[s.index] = s.tag + String(x); return }
                own[s.index] = x.icon ? { text: s.tag + x.text, icon: x.icon } : s.tag + x.text
            })
        }
        for (const b of m.buttons) own[b.index] = b.name === this.focus ? b.focusTag : b.tag
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
            try { screen.options.onOpen?.call(inst.ctx) } finally { inst.busy = false }
            this.platform.lockCamera?.(player, true)
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
        this.log(inst, '关闭界面')
        this.instances.delete(k)
        for (const stop of [...inst.timers]) stop()
        this.platform.close?.(player as P)
        this.platform.lockCamera?.(player as P, false)
        screen.options.onClose?.call(inst.ctx)
    }

    /**
     * 合并队列：状态修改、this.refresh()、this.emit()、对已打开界面的 open() 都只是标记并入队；
     * 当前代码执行完后（微任务）一次处理：先把事件交给脚本，再在有变化时刷新一次。处理点击期间不入队（点击处理完本来就会重新打开）。
     * @internal
     */
    enqueue(inst: Instance): void {
        if (inst.closed || inst.busy || inst.queued) return
        inst.queued = true
        const run = () => { inst.queued = false; void this.flush(inst) }
        if (this.platform.schedule) this.platform.schedule(run); else Promise.resolve().then(run)
    }

    /** 把 this.emit() 发出的事件交给脚本登记的处理函数（依次执行，可为异步；出错不影响界面） */
    private async deliver(inst: Instance): Promise<void> {
        while (inst.emits.length) {
            const [event, args] = inst.emits.shift()!
            this.platform.emitted?.(inst.player as P, event, args)
            for (const handler of inst.screen._listeners(event)) {
                try { await handler(inst.player, ...args) } catch (e) { console.warn(`[bedrock-cui] ${inst.screen.id} 的事件 ${event} 处理出错：${e}`) }
            }
        }
    }

    private async flush(inst: Instance): Promise<void> {
        if (inst.closed) return
        if (inst.emits.length) {
            inst.busy = true
            try { await this.deliver(inst) } finally { inst.busy = false }
        }
        if (inst.closed || !inst.displayed || !inst.dirty || inst.deferred) return
        // 表单刚显示不久：推迟到安静下来（期间若玩家点击，重新打开时就带上了最新的状态，到时 dirty 为 false 就跳过）
        const wait = this.quietMs - (this.now() - inst.shownAt)
        if (wait > 0 && this.platform.timeout) {
            inst.deferred = true
            this.log(inst, `推迟刷新 ${Math.round(wait)} 毫秒`)
            this.platform.timeout(() => { inst.deferred = false; this.enqueue(inst) }, Math.max(1, Math.ceil(wait / 50)))
            return
        }
        // 刷新：关闭当前表单，同一刻立即显示新表单（旧表单迟到的取消忽略、迟到的点击照常处理）
        this.replaceNow(inst)
    }

    private async show(inst: Instance): Promise<void> {
        const gen = ++inst.gen
        inst.displayed = true
        inst.shownAt = this.now()
        inst.dirty = false
        const replace = inst.replacing
        inst.replacing = false
        this.log(inst, `显示 #${gen}${replace ? '（替换）' : ''}`)
        const r = await this.platform.show(inst.player as P, { ...inst.form(), replace }, () => this.log(inst, `#${gen} 玩家正忙，重试`))
        const stale = gen !== inst.gen                        // 已被「替换」：这是旧表单迟到的结果
        this.log(inst, `结果 #${gen}${stale ? '（旧）' : ''}：${r.canceled ? `取消 ${r.cancelationReason ?? ''}` : `点击 ${r.selection}`}`)
        if (!stale) inst.displayed = false
        if (inst.closed) return
        const clicked = !r.canceled && r.selection !== undefined
        if (stale) {
            // 旧表单的取消是刷新自己关的，忽略；旧表单上的点击照常处理，再刷新正在显示的表单（真机 1.39.0：忽略点击会丢掉约一半）
            if (!clicked) return
            const after = await this.handle(inst, r.selection!)
            if (after && !inst.closed) this.replaceNow(inst)
            return
        }
        if (!clicked) { this.close(inst.screen, inst.player); return }
        if (await this.handle(inst, r.selection!)) return this.show(inst)
    }

    /** 处理一次点击：翻页按钮翻页；button(名字) 调用同名方法、获得焦点、onUpdate。返回是否需要重新打开 */
    private async handle(inst: Instance, selection: number): Promise<boolean> {
        const m = inst.manifest
        let index = selection
        if (m.paging) {
            const next = pagingResponse(m.paging, selection, inst.page ?? m.paging.start, inst.dir)
            if (next.kind !== 'own') { inst.page = next.page; inst.dir = next.dir; inst.focus = undefined; return true }
            index = next.index
        }
        const b = m.buttons.find((x) => x.index === index)
        inst.busy = true
        try {
            if (b) {
                inst.focus = b.name
                await inst.screen.options.methods?.[b.name]?.call(inst.ctx)
            }
            if (inst.closed) return false
            await this.deliver(inst)                          // 方法中发出的事件：交给脚本处理完再重新打开（期间的更新合并为一次）
            if (inst.closed) return false
            inst.screen.options.onUpdate?.call(inst.ctx)
        } finally { inst.busy = false }
        return true
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
