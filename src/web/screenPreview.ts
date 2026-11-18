/**
 * 在浏览器中运行界面文件的逻辑（bedrock-cui dev 与手册网站的预览共用）：点击 → 方法 → 状态 → 重新显示；
 * 翻页、定时器照常工作；发出的事件、聊天消息与游戏 API 的调用写进日志（浏览器中没有游戏）。
 */
import type { Signal } from '../core/reactivity.js'
import type { Screen, ScreenManifest } from '../core/screen.js'
import type { ServerPaging } from '../core/serverPagesShared.js'
import { ScreenRuntime } from '../runtime/screenRuntime.js'

/** 模拟的游戏对象：读取属性、调用函数、new 都返回新的模拟对象，调用写进日志 */
function mock(path: string, log: (msg: string) => void): any {
    const fmt = (args: unknown[]) => args.map((a) => (typeof a === 'string' ? JSON.stringify(a) : typeof a === 'function' ? '函数' : String(a))).join(', ')
    return new Proxy(function () { }, {
        get: (_, key) => (key === Symbol.toPrimitive || key === 'then' || typeof key === 'symbol' ? undefined : mock(`${path}.${String(key)}`, log)),
        apply: (_, __, args) => { log(`游戏 API：${path}(${fmt(args)})`); return mock(`${path}(…)`, log) },
        construct: (_, args) => { log(`游戏 API：new ${path}(${fmt(args)})`); return mock(`new ${path}`, log) },
    })
}

export interface ScreenPreviewOptions {
    manifest: ScreenManifest
    paging?: ServerPaging
    /** 预览的表单数据（显示时写入） */
    title: Signal<string>
    formButtons: Signal<string[]>
    formButtonIcons: Signal<string[]>
    log(msg: string): void
    /** 每次显示时调用（动画从头播放，与游戏一致） */
    onShow?(): void
}

/** 开始运行；返回 click(序号)：把预览中的点击交给运行时（被接收时返回 true），stop()：关闭界面、取消定时器 */
export function runScreenInBrowser(screen: Screen, o: ScreenPreviewOptions): { click(index: number): boolean, stop(): void } {
    let pending: ((r: { canceled: boolean, selection?: number, cancelationReason?: string }) => void) | undefined
    const real = { id: 'preview', name: '玩家', sendMessage: (m: unknown) => o.log(`聊天栏：${String(m)}`) } as Record<string, unknown>
    const fake = mock('player', o.log)
    const player = new Proxy(real, { get: (t, k) => (typeof k === 'string' && k in t ? t[k] : fake[k as string]) }) as { id: string }
    const rt: ScreenRuntime = new ScreenRuntime({
        show(_, spec) {
            o.title.value = spec.title
            o.formButtons.value = spec.buttons.map((b) => b.text)
            o.formButtonIcons.value = spec.buttons.map((b) => b.icon ?? '')
            o.onShow?.()
            return new Promise((resolve) => { pending = resolve })
        },
        // 关闭当前表单：刷新时也会调用（随即显示新表单），只有界面真正关闭时才写日志
        close() {
            const r = pending; pending = undefined
            r?.({ canceled: true, cancelationReason: 'UserClosed' })
            queueMicrotask(() => { if (!rt.isOpen(screen, player)) o.log('界面已关闭') })
        },
        schedule: (fn) => queueMicrotask(fn),
        interval: (fn, ticks) => { const h = setInterval(fn, ticks * 50); return () => clearInterval(h) },
        timeout: (fn, ticks) => { const h = setTimeout(fn, ticks * 50); return () => clearTimeout(h) },
        emitted: (_, event, args) => o.log(`发出事件「${event}」（${args.map(String).join('，')}）：游戏中交给脚本的 on('${event}') 处理`),
        mc: mock('mc', o.log),
    })
    rt.register({ [screen.id]: o.paging ? { ...o.manifest, paging: o.paging } : o.manifest })
    rt.open(screen, player)
    return {
        click(index) {
            if (!pending) return false
            const r = pending; pending = undefined
            const b = o.manifest.buttons.find((x) => x.index === index)
            const nav: Record<string, string> = { __close: '关闭界面', __back: '返回上一页', __next: '下一页', __prev: '上一页' }
            if (b) o.log(b.method === '__link' ? `点击了跳转：到「${String(b.args[0])}」` : nav[b.method] ? `点击了按钮：${nav[b.method]}` : `点击了按钮：调用 ${b.method}(${b.args.map((a) => JSON.stringify(a)).join(', ')})`)
            r({ canceled: false, selection: index })
            return true
        },
        stop() { if (rt.isOpen(screen, player)) rt.close(screen, player) },
    }
}
