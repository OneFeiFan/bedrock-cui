/**
 * bedrock-cui create <名字>：创建一个基于 sapdon 的项目——sapdon 的项目模板（与所用 sapdon 版本一致）＋ bedrock-cui 的配置、示例界面、入口文件与脚本。
 * sapdon 自己的 create 是交互式的；这里按它的做法复制模板、写 mod.info（含 BP / RP 的 UUID），再加上 bedrock-cui 的文件。
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { encodePng } from '../node/tools.js'

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 找 sapdon：先在当前目录的项目里，再在 bedrock-cui 自己的依赖里 */
export function resolveSapdon(from = process.cwd()): string {
    for (const base of [path.join(from, 'package.json'), path.join(pkgRoot, 'package.json')]) {
        try { return path.dirname(createRequire(base).resolve('sapdon/package.json')) } catch { /* 下一个 */ }
    }
    throw new Error('找不到 sapdon：npm install sapdon')
}

export function create(name: string, options: { description?: string, author?: string } = {}): string {
    const dir = path.resolve(name)
    if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${dir} 已存在且不是空目录`)
    const sapdon = resolveSapdon()
    const template = path.join(sapdon, 'prod', 'templates', 'js_sapdon')
    if (!fs.existsSync(template)) throw new Error(`sapdon 的项目模板不存在：${template}`)
    fs.cpSync(template, dir, { recursive: true })

    const project = path.basename(dir)
    // 与 sapdon create 相同的 mod.info
    fs.writeFileSync(path.join(dir, 'mod.info'), JSON.stringify({
        name: project, description: options.description ?? 'A bedrock-cui project', author: options.author ?? 'bedrock-cui',
        version: '1.0.0', min_engine_version: '1.21.0', language: 'js', bp: randomUUID(), rp: randomUUID(),
    }, null, 2))

    // package.json：项目名、依赖、脚本
    const pkgFile = path.join(dir, 'package.json')
    const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : {}
    const self = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'))
    const sapdonVersion = JSON.parse(fs.readFileSync(path.join(sapdon, 'package.json'), 'utf8')).version
    pkg.name = project
    pkg.type = 'module'
    pkg.scripts = { ...pkg.scripts, dev: 'bedrock-cui dev', build: 'bedrock-cui build', pack: 'bedrock-cui build --pack' }
    pkg.dependencies = { ...pkg.dependencies, 'bedrock-cui': `^${self.version}`, sapdon: `^${sapdonVersion}` }
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n')

    // bedrock-cui 的文件（覆盖模板里的入口与脚本）
    const files = path.join(pkgRoot, 'templates', 'project')
    fs.cpSync(files, dir, { recursive: true })
    // 示例贴图：九宫格面板（自绘）
    const px = new Uint8Array(16 * 16 * 4)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const e = Math.min(x, y, 15 - x, 15 - y)
        const c = e === 0 ? ((x === 0 || x === 15) && (y === 0 || y === 15) ? [0, 0, 0, 0] : [40, 30, 20, 255]) : e === 1 ? [232, 214, 178, 255] : [214, 194, 156, 255]
        px.set(c, (y * 16 + x) * 4)
    }
    const tex = path.join(dir, 'res', 'textures', 'cui_example')
    fs.mkdirSync(tex, { recursive: true })
    fs.writeFileSync(path.join(tex, 'panel.png'), encodePng(16, 16, px))
    fs.writeFileSync(path.join(tex, 'panel.json'), JSON.stringify({ nineslice_size: 4, base_size: [16, 16] }, null, 2))
    return dir
}
