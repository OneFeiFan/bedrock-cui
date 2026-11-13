/**
 * 细粒度响应式（预览运行时用；沿用原型的 Signal / Effect，补 computed 与 batch）。
 * 游戏里的界面没有 JS：动态行为由 expr.ts 编译成绑定表达式；这里的信号只用来在浏览器里模拟服务端数据与交互状态。
 */
export let activeEffect: Effect | null = null
let batchDepth = 0
const pending = new Set<Effect>()

export class Effect {
    deps: Set<Effect>[] = []
    private stopped = false
    constructor(public fn: () => void) { this.run() }
    run() {
        if (this.stopped) return
        for (const set of this.deps) set.delete(this)
        this.deps = []
        const prev = activeEffect
        activeEffect = this
        try { this.fn() } finally { activeEffect = prev }
    }
    stop() { this.stopped = true; for (const set of this.deps) set.delete(this); this.deps = [] }
}
export const effect = (fn: () => void) => new Effect(fn)

export class Signal<T> {
    private _value: T
    private readonly subs = new Set<Effect>()
    constructor(value: T) { this._value = value }
    get value(): T {
        if (activeEffect && !this.subs.has(activeEffect)) { this.subs.add(activeEffect); activeEffect.deps.push(this.subs) }
        return this._value
    }
    set value(v: T) {
        if (Object.is(v, this._value)) return
        this._value = v
        for (const e of [...this.subs]) batchDepth ? pending.add(e) : e.run()
    }
    peek(): T { return this._value }
    update(fn: (v: T) => T) { this.value = fn(this._value) }
}
export const signal = <T>(v: T) => new Signal(v)

/** 派生值：依赖变化时重新计算 */
export function computed<T>(fn: () => T): { readonly value: T } {
    const s = new Signal<T>(undefined as T)
    effect(() => { s.value = fn() })
    return { get value() { return s.value } }
}

/** 批量更新：期间的多次赋值只触发一次 */
export function batch(fn: () => void) {
    batchDepth++
    try { fn() } finally {
        batchDepth--
        if (!batchDepth) { const list = [...pending]; pending.clear(); for (const e of list) e.run() }
    }
}
