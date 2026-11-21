/**
 * 手册审计（npm run docs:audit）：按主题归属表（scripts/doc-topics.mjs）找出页与页之间的问题，供逐页检查时参考。
 *
 * 1. 读到之前就提到：按侧栏的阅读顺序，某页在归属页之前，正文提到了这个主题，整页也没有链接到归属页。
 * 2. 可能在多处讲：归属页与组件页以外的页面，有标题含这个主题。
 * 3. 归属表本身：归属页或其中的一节不存在。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOPICS } from './doc-topics.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const guide = path.join(root, 'docs', 'guide')
const read = (p) => fs.readFileSync(path.join(guide, p), 'utf8')
const slug = (text) => text.replace(/<[^>]+>/g, '').replace(/`/g, '').trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}\-_]/gu, '').toLowerCase()
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const order = [...read('index.md').matchAll(/\]\(([^)#]+\.md)/g)].map((m) => m[1])
const rank = (p) => { const i = order.indexOf(p); return i < 0 ? order.length : i }
const pages = order.filter((p) => fs.existsSync(path.join(guide, p)) && !p.startsWith('reference/api-'))

// 有理由在别处另起一节的主题（「页:主题」）：性能一章专讲 softWrap 的开销，不是重复介绍用法
const ALLOW_DUPLICATE = new Set(['performance.md:softWrap'])
const problems = { early: [], duplicate: [], table: [] }
for (const [name, home] of Object.entries(TOPICS)) {
    const [homePage, anchor] = home.split('#')
    if (!fs.existsSync(path.join(guide, homePage))) { problems.table.push(`${name}：归属页 ${homePage} 不存在`); continue }
    if (anchor && !read(homePage).split('\n').some((l) => /^#{2,3} /.test(l) && slug(l.replace(/^#+ /, '')) === anchor)) problems.table.push(`${name}：${homePage} 中没有「#${anchor}」一节`)
    const mention = new RegExp('`[^`\\n]*\\b' + esc(name) + '\\b[^`\\n]*`')
    for (const page of pages) {
        if (page === homePage) continue
        const text = read(page)
        const prose = text.replace(/```[\s\S]*?```/g, '')
        const rel = path.posix.relative(path.posix.dirname(page), homePage)
        if (rank(page) < rank(homePage) && mention.test(prose) && !text.includes(`](${rel}`)) problems.early.push(`${page}：${name}（归属：${home}）`)
        if (!page.startsWith('components/') && !ALLOW_DUPLICATE.has(`${page}:${name}`) && prose.split('\n').some((l) => /^#{2,3} /.test(l) && new RegExp(`\\b${esc(name)}\\b`).test(l))) problems.duplicate.push(`${page}：标题含 ${name}（归属：${home}）`)
    }
}
console.log(`主题 ${Object.keys(TOPICS).length} 个，页面 ${pages.length} 页。`)
console.log(`\n一、读到归属页之前就提到、整页没有链接：${problems.early.length} 处`); problems.early.forEach((x) => console.log('  ' + x))
console.log(`\n二、归属页以外的标题含这个主题（可能在多处讲）：${problems.duplicate.length} 处`); problems.duplicate.forEach((x) => console.log('  ' + x))
console.log(`\n三、归属表的问题：${problems.table.length} 处`); problems.table.forEach((x) => console.log('  ' + x))
