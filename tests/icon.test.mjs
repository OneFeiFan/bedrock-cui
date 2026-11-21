import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ICON_16, ICON_32, PALETTE } from '../docs/site/icon/icon.mjs'
import { iconPng } from '../scripts/build-icon.mjs'

test('项目图标：网格的尺寸与颜色；README 使用的 docs/icon.png 与网格一致（改了网格后运行 node scripts/build-icon.mjs）', () => {
    for (const [grid, n] of [[ICON_32, 32], [ICON_16, 16]]) {
        assert.equal(grid.length, n)
        for (const row of grid) {
            assert.equal(row.length, n)
            for (const ch of row) assert.ok(ch === '.' || ch in PALETTE, `未定义颜色的字符：${ch}`)
        }
    }
    assert.ok(Buffer.from(iconPng(ICON_32, 8)).equals(fs.readFileSync(new URL('../docs/icon.png', import.meta.url))), 'docs/icon.png 与网格不一致')
})
