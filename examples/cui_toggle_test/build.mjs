/**
 * 构建真机测试包：npm run test-pack  →  examples/cui_toggle_test/dev/cui_toggle_test.mcaddon
 * 这是一个 sapdon 项目（UUID 在 mod.info，游戏里已装的测试包仍认作同一个包）。构建前：
 *   · 下载原版贴图到 vanilla/（预览与字形图用，不进资源包）；
 *   · 让 node_modules/bedrock-cui 指向本仓库（sapdon 的 rollup 打包脚本时要能找到 bedrock-cui/runtime）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.join(here, '..', '..')
await import('../../scripts/fetch-vanilla-textures.mjs')
const link = path.join(here, 'node_modules', 'bedrock-cui')
if (!fs.existsSync(link)) { fs.mkdirSync(path.dirname(link), { recursive: true }); fs.symlinkSync(repo, link, 'junction') }

const status = spawnSync(process.execPath, [path.join(repo, 'bin', 'bedrock-cui.mjs'), 'build', '--pack'], { cwd: here, stdio: 'inherit' }).status
if (status !== 0) process.exit(1)
