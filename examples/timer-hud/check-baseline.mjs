import fs from 'node:fs'
import assert from 'node:assert/strict'
import { CuiApp } from '../../dist/node/index.js'
import config from './cui.config.mjs'

/** 来自用户真机确认过的 V15 安装包；不以模拟器的新输出自动更新基准。 */
export function checkTimerHudBaseline() {
    const expected = JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/timer-hud-v15.json', import.meta.url), 'utf8'))
    const compiled = CuiApp.fromConfig(config, import.meta.dirname).compile()
    for (const [file, ui] of Object.entries(expected)) {
        assert.deepEqual(compiled.files[file], ui, `${file} 偏离 V15 已验证显示基准；新通道与布局请放入独立实验示例`)
    }
}
