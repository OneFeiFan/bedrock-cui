/**
 * 构建真机测试包：node examples/cui_toggle_test/build.mjs  →  examples/cui_toggle_test/dev/cui_toggle_test.mcaddon
 * 这是一个 sapdon 项目（UUID 在 mod.info，游戏里已装的测试包仍认作同一个包）。构建前：
 *   · 把测试书的贴图从 preview-src/public/textures 复制到 res/textures/cui_test/（预览与测试包共用一份），字形图标要的原版物品贴图复制到 glyph-src/textures/items/（不打进资源包）；
 *   · 让 node_modules/bedrock-cui 指向本仓库（sapdon 的 rollup 打包脚本时要能找到 bedrock-cui/runtime）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.join(here, '..', '..')
const src = path.join(repo, 'preview-src', 'public', 'textures')

await import('../../scripts/fetch-vanilla-textures.mjs')
const OWN = ['book', 'line', 'row_hover', 'arrow_left', 'arrow_left_hover', 'arrow_right', 'arrow_right_hover', 'tab', 'tab_hover', 'ruler', 'teal_bg']
const ITEMS = ['diamond', 'diamond_sword']     // 字形图标（emoji 页 E2）的来源：构建时画进字形图
for (const [names, to] of [[OWN, 'res/textures/cui_test'], [ITEMS, 'glyph-src/textures/items']]) {
    fs.mkdirSync(path.join(here, to), { recursive: true })
    for (const n of names) fs.copyFileSync(path.join(src, `${n}.png`), path.join(here, to, `${n}.png`))
}
const link = path.join(here, 'node_modules', 'bedrock-cui')
if (!fs.existsSync(link)) { fs.mkdirSync(path.dirname(link), { recursive: true }); fs.symlinkSync(repo, link, 'junction') }

const run = (args) => spawnSync(process.execPath, [path.join(repo, 'bin', 'bedrock-cui.mjs'), ...args], { cwd: here, stdio: 'inherit' }).status
if (run(['build', '--pack']) !== 0) process.exit(1)
