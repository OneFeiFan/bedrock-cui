import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { checkTimerHudBaseline } from './check-baseline.mjs'

checkTimerHudBaseline()
const here = import.meta.dirname, repo = path.resolve(here, '../..')
const link = path.join(here, 'node_modules/bedrock-cui')
if (!fs.existsSync(link)) {
    fs.mkdirSync(path.dirname(link), { recursive: true })
    fs.symlinkSync(repo, link, 'junction')
}
if (!fs.existsSync(path.join(here, 'pack_icon.png'))) fs.copyFileSync(path.join(repo, 'examples/cui_toggle_test/pack_icon.png'), path.join(here, 'pack_icon.png'))
// sapdon 会保留已有 manifest；升版时同步这两份清单，保留模块 UUID 和其他元数据。
const info = JSON.parse(fs.readFileSync(path.join(here, 'mod.info'), 'utf8'))
const version = info.version.split('.').map(Number)
for (const kind of ['RP', 'BP']) {
    const file = path.join(here, 'dev', `timer-hud_${kind}`, 'manifest.json')
    if (!fs.existsSync(file)) continue
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (manifest.header.uuid !== info[kind.toLowerCase()]) throw new Error(`已有 ${kind} 的 UUID 与 mod.info 不一致`)
    manifest.header.version = version
    manifest.header.description = info.description
    for (const module of manifest.modules) module.version = version
    for (const dependency of manifest.dependencies ?? []) if ([info.rp, info.bp].includes(dependency.uuid)) dependency.version = version
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
}
const result = spawnSync(process.execPath, [path.join(repo, 'bin/bedrock-cui.mjs'), 'build', '--pack'], { cwd: here, stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)
