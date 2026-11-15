/**
 * 端到端测试：bedrock-cui create 新建项目 → 链接依赖（代替 npm install：本仓库与它的 sapdon）→ bedrock-cui build --pack → 检查 .mcaddon。
 *   node scripts/e2e-create.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const cli = path.join(repo, 'bin', 'bedrock-cui.mjs')
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-e2e-'))
const run = (args, cwd) => {
    const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' })
    if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`bedrock-cui ${args.join(' ')} 失败`) }
    return r.stdout
}

run(['create', 'e2e_ui'], work)
const project = path.join(work, 'e2e_ui')
const modules = path.join(project, 'node_modules')
fs.mkdirSync(path.join(modules, '@sapdon'), { recursive: true })
const link = (target, at) => fs.symlinkSync(target, at, 'junction')
link(repo, path.join(modules, 'bedrock-cui'))
link(path.join(repo, 'node_modules', 'sapdon'), path.join(modules, 'sapdon'))
for (const p of fs.readdirSync(path.join(repo, 'node_modules', '@sapdon'))) link(path.join(repo, 'node_modules', '@sapdon', p), path.join(modules, '@sapdon', p))

run(['build', '--pack'], project)
const mcaddon = path.join(project, 'dev', 'e2e_ui.mcaddon')
if (!fs.existsSync(mcaddon)) throw new Error('没有生成 .mcaddon')
for (const f of ['dev/e2e_ui_RP/ui/book.json', 'dev/e2e_ui_RP/ui/server_form.json', 'dev/e2e_ui_BP/scripts/index.js', 'scripts/cui.generated.js'])
    if (!fs.existsSync(path.join(project, f))) throw new Error(`缺少 ${f}`)
const defs = JSON.parse(fs.readFileSync(path.join(project, 'dev/e2e_ui_RP/ui/_ui_defs.json'), 'utf8')).ui_defs
if (!defs.includes('ui/book.json')) throw new Error(`_ui_defs 里没有 ui/book.json：${defs}`)
console.log(`端到端：create → build --pack 通过（${fs.statSync(mcaddon).size} 字节）`)
fs.rmSync(work, { recursive: true, force: true })
