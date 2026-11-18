// 验证实际打包后的脚本，模拟 Script API；此检查不替代游戏内 JSON UI 动画测试。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import { timerFrameCodec } from '../../dist/core/timerFrame.js'
import { CuiApp } from '../../dist/node/index.js'
import config from './cui.config.mjs'

const here = import.meta.dirname
const result = CuiApp.fromConfig(config, here).compile(), manifest = result.timerHuds.cooldowns
assert.deepEqual(result.issues.filter((i) => i.level === 'error'), [])
const rp = path.join(here, 'dev/timer-hud_RP'), bp = path.join(here, 'dev/timer-hud_BP')
const ui = JSON.parse(fs.readFileSync(path.join(rp, 'ui/cui_timer_demo_timers.json'), 'utf8'))
for (const [slot, clock] of ['$title_fade_in_time', '$title_stay_time', '$title_fade_out_time'].entries()) {
    assert.equal(ui[`cui_cooldowns_${slot}_grow`].duration, clock)
}
assert.ok(!JSON.stringify(ui).includes('hud_title_text_complete'))
assert.ok(!JSON.stringify(ui).includes('"destroy_at_end":"hud_title_text"'))
const patch = JSON.parse(fs.readFileSync(path.join(rp, 'ui/hud_screen.json'), 'utf8'))
const defs = JSON.parse(fs.readFileSync(path.join(rp, 'ui/_ui_defs.json'), 'utf8')).ui_defs
assert.equal(new Set(defs).size, defs.length, 'HUD 文件只登记一次')
assert.ok(patch['hud_title_text/title_frame'], '保留 sapdon 自动登记的 HUD 修改')
assert.equal(patch['root_panel/hud_actionbar_text_area'].ignored, true)
for (const kind of ['RP', 'BP']) {
    const m = JSON.parse(fs.readFileSync(path.join(here, `dev/timer-hud_${kind}/manifest.json`), 'utf8'))
    assert.deepEqual(m.header.version, [1, 0, 17])
    assert.equal(m.header.uuid, kind === 'RP' ? 'b879df0c-18b2-4eaa-981c-11fd601ad56a' : '794a17e2-f9c5-4811-863e-1749700de66e')
}

let tick = 0, serial = 0
const jobs = new Map(), subscriptions = {}, titles = [], subtitles = [], notices = [], forms = [], warnings = []
const now = () => 100000 + tick * 50
const schedule = (fn, delay = 1) => { const id = ++serial; jobs.set(id, { fn, at: tick + delay }); return id }
const event = (name) => ({ subscribe(fn) { (subscriptions[name] ??= []).push(fn) } })
const player = { id: 'player1', inputPermissions: { isPermissionCategoryEnabled() { return true }, setPermissionCategory() {} },
    onScreenDisplay: {
        setTitle(text, options) { titles.push({ tick, text, options }) },
        setActionBar(text) { notices.push({ tick, text }) },
        updateSubtitle(text) { subtitles.push({ tick, text }) },
    } }
const system = { get currentTick() { return tick }, run: (fn) => schedule(fn), runTimeout: schedule,
    clearRun: (id) => jobs.delete(id), afterEvents: { scriptEventReceive: event('script') } }
const world = { getAllPlayers: () => [player], afterEvents: { playerLeave: event('leave'), playerSpawn: event('spawn') } }
class ActionFormData {
    title(value) { this.titleText = value; return this }
    body(value) { this.bodyText = value; return this }
    button() { return this }
    show() { forms.push({ tick, title: this.titleText }); return new Promise(() => {}) }
}
class Clock extends Date { static now() { return now() } }
const context = vm.createContext({ Date: Clock, console: { warn: (...args) => warnings.push(args.join(' ')), log() {} } })
const server = { system, world, InputPermissionCategory: { Camera: 0 } }
const serverUi = { ActionFormData, uiManager: { closeAllForms() {} } }
const modules = new Map()
for (const [id, exports] of [['@minecraft/server', server], ['@minecraft/server-ui', serverUi]]) {
    modules.set(id, new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value) }, { context }))
}
const script = new vm.SourceTextModule(fs.readFileSync(path.join(bp, 'scripts/index.js'), 'utf8'), { context })
await script.link((id) => {
    const module = modules.get(id)
    assert.ok(module, `行为包含有无法在游戏中加载的外部模块：${id}`)
    return module
})
await script.evaluate()
for (const fn of subscriptions.script) fn({ id: 'cui_probe:overlay', sourceEntity: player })
for (tick = 1; tick <= 640; tick++) {
    for (const [id, job] of [...jobs]) if (job.at <= tick && jobs.has(id)) {
        jobs.delete(id); job.fn()
        for (let i = 0; i < 8; i++) await Promise.resolve()
    }
    for (let i = 0; i < 8; i++) await Promise.resolve()
}
const packets = titles.filter((x) => typeof x.text === 'string' && x.text.startsWith(manifest.prefix))
assert.equal(forms.length, 1, '数据事件不重开表单')
assert.equal(packets.length, 8, 'V15 示例只按计时事件发送')
const pause = packets.find((x) => x.tick >= 80 && x.tick < 100)
const decode = (x) => timerFrameCodec(manifest).decode(x.text.slice(manifest.prefix.length))
assert.ok(pause)
assert.equal(Math.trunc(decode(pause).b / (manifest.steps + 1)), 0)
assert.equal(Math.trunc(decode(pause).a / (manifest.steps + 1)), 1)
assert.equal(Math.trunc(decode(pause).c / (manifest.steps + 1)), 1)
assert.equal(pause.options.stayDuration, 1)
assert.ok(pause.options.fadeInDuration > 1 && pause.options.fadeOutDuration > 1)
assert.equal(notices.length, 1, '普通提示经独立 actionbar 发送')
const title = titles.find((x) => x.text === '任务完成 / TITLE')
assert.ok(title)
assert.equal(subtitles.length, 0)
assert.equal(packets.filter((x) => x.tick > title.tick && x.tick < title.tick + 61).length, 0, '原版标题期间不抢占')
assert.ok(packets.some((x) => x.tick >= title.tick + 61), '标题结束后自动恢复计时器')
const allPaused = packets.find((x) => x.tick >= 320 && x.tick <= 325)
assert.ok(allPaused)
assert.deepEqual([allPaused.options.fadeInDuration, allPaused.options.stayDuration, allPaused.options.fadeOutDuration], [1, 1, 1])
assert.equal(packets.filter((x) => x.tick > 325 && x.tick < 380).length, 0, '全部暂停时也不发心跳')
assert.ok(!warnings.some((s) => /失败|未登记|只能在/.test(s)), warnings.join('\n'))
assert.equal(jobs.size, 0, '计时完成后没有轮询定时器')
console.log(JSON.stringify({ formShows: forms.length, timerChannel: 'title', timerFrames: packets.length, ordinaryTitles: 1, scheduledJobsAfterCompletion: jobs.size }))
