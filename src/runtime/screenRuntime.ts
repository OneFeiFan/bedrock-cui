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

/** 要显示的表单 */
export interface FormSpec { title: string, body: string, buttons: { text: string, icon?: string }[] }

/** 表单的结果 */
export interface FormResult { canceled: boolean, selection?: number, cancelationReason?: string }

/** 平台：显示与关闭表单、锁视角 */
export interface FormPlatform<P extends ScreenPlayer = ScreenPlayer> {
    show(player: P, form: FormSpec): Promise<FormResult>
    close?(player: P): void
    lockCamera?(player: P, on: boolean): void
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
                if (key in inst.state) return inst.state[key]
                if (key in computed) return computed[key].call(inst.ctx)
                if (key in methods) return methods[key].bind(inst.ctx)
                return undefined
            },
            set(_, key, value) {
                if (typeof key === 'symbol') return false
                inst.state[key] = value
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
            screen.options.onOpen?.call(inst.ctx)
            this.platform.lockCamera?.(player, true)
        } else {
            inst.openProps = { ...inst.openProps, ...props }
        }
        void this.show(inst)
    }

    /** 关闭界面（onClose 之后实例销毁） */
    close(screen: Screen, player: ScreenPlayer): void {
        const k = this.key(screen, player)
        const inst = this.instances.get(k)
        if (!inst || inst.closed) return
        inst.closed = true
        this.instances.delete(k)
        this.platform.close?.(player as P)
        this.platform.lockCamera?.(player as P, false)
        screen.options.onClose?.call(inst.ctx)
    }

    private async show(inst: Instance): Promise<void> {
        const r = await this.platform.show(inst.player as P, inst.form())
        if (inst.closed) return
        if (r.canceled || r.selection === undefined) { this.close(inst.screen, inst.player); return }
        const m = inst.manifest
        let index = r.selection
        if (m.paging) {
            const next = pagingResponse(m.paging, r.selection, inst.page ?? m.paging.start, inst.dir)
            if (next.kind !== 'own') { inst.page = next.page; inst.dir = next.dir; inst.focus = undefined; return this.show(inst) }
            index = next.index
        }
        const b = m.buttons.find((x) => x.index === index)
        if (b) {
            inst.focus = b.name
            await inst.screen.options.methods?.[b.name]?.call(inst.ctx)
        }
        if (inst.closed) return
        inst.screen.options.onUpdate?.call(inst.ctx)
        return this.show(inst)
    }
}
