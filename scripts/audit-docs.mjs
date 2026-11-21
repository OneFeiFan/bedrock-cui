/**
 * 手册审计（npm run docs:audit）：找出「名词没有先介绍」一类的问题，供逐页检查时参考（不使构建失败）。
 *
 * 1. 公开接口的覆盖：各公开入口导出的名字，在指南中有没有「归属页」——标题中出现它的页面，或有它 API 表的组件页。
 *    没有归属页的接口，读者只能在 API 参考里找到它。
 * 2. 未介绍就提到：按侧栏的阅读顺序，读者读到归属页之前，某页的正文就提到了这个接口，而同一段中没有链接到归属页
 *    （「凭空出现」）。读到归属页之后再提到，不算。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const guide = path.join(root, 'docs', 'guide')

// 公开入口（与 package.json 的 exports 对应；bedrock-cui/internal 不算）
const entries = { 'bedrock-cui': 'dist/index.js', 'bedrock-cui/runtime': 'dist/runtime/index.js', 'bedrock-cui/node': 'dist/node/index.js', 'bedrock-cui/web': 'dist/web/index.js', 'bedrock-cui/dom': 'dist/dom/index.js' }
const exported = new Map()       // 名字 → 入口
for (const [entry, file] of Object.entries(entries)) {
    const mod = await import(path.join(root, file))
    for (const name of Object.keys(mod)) if (!name.startsWith('_') && !exported.has(name)) exported.set(name, entry)
}

const files = []
const walk = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); fs.statSync(p).isDirectory() ? walk(p) : f.endsWith('.md') && files.push(p) } }
walk(guide)
const pages = files.filter((f) => !/reference[/\\]api-/.test(f) && !f.endsWith('WRITING.md'))
const rel = (f) => path.relative(guide, f).replace(/\\/g, '/')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const homes = new Map()          // 名字 → 归属页
const mentions = []              // [页, 名字, 段落]
for (const f of pages) {
    const text = fs.readFileSync(f, 'utf8')
    const code = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n')
    const prose = text.replace(/```[\s\S]*?```/g, '')
    for (const name of exported.keys()) {
        const id = new RegExp(`(^|[^\\w.])${esc(name)}(?![\\w])`)
        const isHome = prose.split('\n').some((l) => /^#{1,3} /.test(l) && id.test(l)) || text.includes(`<!-- api: ${name} -->`)
        if (isHome) (homes.get(name) ?? homes.set(name, new Set()).get(name)).add(rel(f))
    }
    for (const para of prose.split(/\n\s*\n/)) {
        for (const m of para.matchAll(/`([^`\n]+)`/g)) {
            const ids = m[1].match(/[A-Za-z_$][\w$]*/g) ?? []
            for (const name of ids) if (exported.has(name) && name.length > 2) mentions.push([rel(f), name, para])
        }
    }
}

const noHome = [...exported.keys()].filter((n) => !homes.has(n)).sort()
console.log(`公开接口 ${exported.size} 个；在指南中有归属页的 ${homes.size} 个。`)
console.log(`\n一、没有归属页（只在 API 参考中，或完全没有）：${noHome.length} 个`)
const byEntry = {}
for (const n of noHome) (byEntry[exported.get(n)] ??= []).push(n)
for (const [e, ns] of Object.entries(byEntry)) console.log(`  ${e}：${ns.join('、')}`)

// 侧栏的阅读顺序（docs/guide/index.md 中链接的顺序）
const order = [...fs.readFileSync(path.join(guide, 'index.md'), 'utf8').matchAll(/\]\(([^)#]+\.md)/g)].map((m) => m[1])
const rank = (p) => { const i = order.indexOf(p); return i < 0 ? order.length : i }
const seen = new Set()
const unlinked = []
for (const [page, name, para] of mentions) {
    const hs = homes.get(name)
    if (hs && (hs.has(page) || Math.min(...[...hs].map(rank)) < rank(page))) continue      // 本页即归属页，或读者已读过归属页
    const dir = path.posix.dirname(page)
    const linked = hs && [...hs].some((h) => para.includes(`](${path.posix.relative(dir, h)}`))
    const key = `${page} ${name}`
    if (!linked && !seen.has(key)) { seen.add(key); unlinked.push([page, name, hs ? [...hs].join('、') : '（没有）']) }
}
console.log(`\n二、读到归属页之前就提到、同一段中也没有链接：${unlinked.length} 处`)
for (const [page, name, hs] of unlinked.sort()) console.log(`  ${page}：${name}（归属页：${hs}）`)
