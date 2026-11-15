/**
 * 生成手册网站：docs/guide/*.md → site-dist/*.html（GitHub Pages 用）。
 *   npm run build && node scripts/build-site.mjs [输出目录]
 * 正文用 Markdown；页面外框（顶栏、侧边栏、本页目录、上一页 / 下一页）用 bedrock-cui 的组件搭，由 bedrock-cui/dom 渲染成 HTML。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Marked } from 'marked'
import { Column, Label, Panel, Row } from 'bedrock-cui'
import { Html, Link, renderHtml } from 'bedrock-cui/dom'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const guide = path.join(root, 'docs', 'guide')
const out = path.resolve(process.argv[2] ?? path.join(root, 'site-dist'))
const REPO = 'https://github.com/OneFeiFan/bedrock-cui'
const SITE_TITLE = 'bedrock-cui'

// ───────── 目录：从 index.md 读出分组与页面顺序 ─────────

const sections = []          // [{ title, pages: [{ file, title }] }]
for (const line of fs.readFileSync(path.join(guide, 'index.md'), 'utf8').split('\n')) {
    const h = line.match(/^#{2,3} (.+)/)
    if (h && h[1] !== '学习') { sections.push({ title: h[1], pages: [] }); continue }
    const l = line.match(/^- \[(.+?)\]\((.+?\.md)\)/)
    if (l && sections.length) sections.at(-1).pages.push({ file: l[2], title: l[1].replace(/`/g, '') })
}
const order = sections.flatMap((s) => s.pages)
const htmlName = (file) => file.replace(/\.md$/, '.html')

// ───────── Markdown ─────────

const slug = (text) => text.replace(/<[^>]+>/g, '').replace(/`/g, '').trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}\-_]/gu, '').toLowerCase()

/** 很小的代码高亮：注释、字符串、关键字、数字（js / bash） */
function highlight(code, lang) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    if (!/^(js|ts|javascript|bash|sh)$/.test(lang)) return esc(code)
    const re = lang === 'bash' || lang === 'sh'
        ? /(#.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\b(?:npm|npx|node|git|mkdir|cd)\b)/gm
        : /(\/\/.*$|\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b(?:import|from|export|const|let|var|new|await|async|return|class|extends|if|else|for|of|in|function|this|super|true|false|null|undefined|static|get|set)\b)|(\b\d+(?:\.\d+)?\b)/gm
    let html = '', last = 0
    for (const m of code.matchAll(re)) {
        html += esc(code.slice(last, m.index))
        const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n'
        html += `<span class="tok-${cls}">${esc(m[0])}</span>`
        last = m.index + m[0].length
    }
    return html + esc(code.slice(last))
}

/** 「{1,4-9}」→ 行号集合 */
function lineSet(spec) {
    const set = new Set()
    for (const part of (spec ?? '').split(',').filter(Boolean)) {
        const [a, b] = part.split('-').map(Number)
        for (let i = a; i <= (b || a); i++) set.add(i)
    }
    return set
}

function renderMarkdown(src, file) {
    const toc = []
    const marked = new Marked({
        renderer: {
            heading({ tokens, depth }) {
                const text = this.parser.parseInline(tokens)
                const id = slug(text)
                if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, '') })
                return `<h${depth} id="${id}">${text}${depth > 1 ? ` <a class="anchor" href="#${id}">#</a>` : ''}</h${depth}>\n`
            },
            code({ text, lang = '' }) {
                const [language, spec] = [lang.split(/\s+/)[0], (lang.match(/\{([^}]*)\}/) ?? [])[1]]
                const marks = lineSet(spec)
                const lines = highlight(text, language).split('\n').map((l, i) => `<span class="line${marks.has(i + 1) ? ' hl' : ''}">${l || ' '}</span>`)
                return `<pre class="code" data-lang="${language}"><code>${lines.join('\n')}</code></pre>\n`
            },
            link({ href, title, tokens }) {
                const text = this.parser.parseInline(tokens)
                let url = href
                if (!/^(https?:|#|mailto:)/.test(href)) {
                    const [p, hash] = href.split('#')
                    const abs = path.resolve(path.dirname(path.join(guide, file)), p)
                    if (abs.startsWith(guide) && p.endsWith('.md')) url = htmlName(p) + (hash ? `#${slug(decodeURIComponent(hash))}` : '')
                    else url = `${REPO}/tree/master/${path.relative(root, abs).replace(/\\/g, '/')}`
                }
                return `<a href="${url}"${title ? ` title="${title}"` : ''}>${text}</a>`
            },
        },
    })
    // 提示框：::: tip / warning / details 标题 … :::
    const names = { tip: '提示', warning: '注意', learn: '本节内容' }
    const body = src.replace(/^::: (tip|warning|details|learn)(?: (.*))?\n([\s\S]*?)^:::\s*$/gm, (_, kind, title, inner) => {
        const content = marked.parse(inner)
        if (kind === 'details') return `<details class="callout details"><summary>${title ?? '详细说明'}</summary>\n${content}</details>\n`
        return `<div class="callout ${kind}"><p class="callout-title">${title ?? names[kind]}</p>\n${content}</div>\n`
    })
    const html = marked.parse(body)
    return { html, toc, title: (src.match(/^# (.+)$/m) ?? [, file])[1].replace(/`/g, '') }
}

// ───────── 页面外框：用 bedrock-cui 的组件搭 ─────────

function frame(page, current, prefix) {
    const link = (href, text, className) => new Link(prefix + href, text).setClassName(className)

    const top = new Row().setClassName('topbar').add(
        link('index.html', SITE_TITLE, 'brand'),
        new Panel().setGrow(),
        link('introduction.html', '指南', 'nav'),
        link('reference/api-core.html', '参考', 'nav'),
        new Link(REPO, 'GitHub').setClassName('nav'),
    )

    const side = new Column().setClassName('sidebar')
    for (const s of sections) {
        side.add(new Label(s.title).setClassName('side-title'))
        for (const p of s.pages) side.add(link(htmlName(p.file), p.title, p.file === current ? 'side-link active' : 'side-link'))
    }

    const i = order.findIndex((p) => p.file === current)
    const pager = new Row().setClassName('pager')
    if (i > 0) pager.add(link(htmlName(order[i - 1].file), `‹ ${order[i - 1].title}`, 'prev'))
    pager.add(new Panel().setGrow())
    if (i >= 0 && i < order.length - 1) pager.add(link(htmlName(order[i + 1].file), `${order[i + 1].title} ›`, 'next'))

    const toc = new Column().setClassName('toc')
    if (page.toc.length) {
        toc.add(new Label('本页目录').setClassName('toc-title'))
        for (const t of page.toc) toc.add(new Link(`#${t.id}`, t.text).setClassName('toc-link'))
    }

    const main = new Column().setClassName('main').add(
        new Html(page.html, 'article').setClassName('content'),
        pager,
        new Link(`${REPO}/edit/master/docs/guide/${current}`, '在 GitHub 上编辑此页').setClassName('edit'),
    )

    return new Column().setClassName('page').add(top, new Row().setClassName('layout').add(side, main, toc))
}

// ───────── 输出 ─────────

fs.rmSync(out, { recursive: true, force: true })
const files = []
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : f.endsWith('.md') && f !== 'WRITING.md' && files.push(path.relative(guide, p).replace(/\\/g, '/')) } }
walk(guide)

for (const file of files) {
    const page = renderMarkdown(fs.readFileSync(path.join(guide, file), 'utf8'), file)
    const prefix = '../'.repeat(file.split('/').length - 1)
    const body = renderHtml(frame(page, file, prefix))
    const doc = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title} | ${SITE_TITLE}</title>
<link rel="stylesheet" href="${prefix}site.css">
</head>
<body>
${body}
</body>
</html>
`
    const to = path.join(out, htmlName(file))
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.writeFileSync(to, doc)
}
fs.copyFileSync(path.join(root, 'docs', 'site', 'site.css'), path.join(out, 'site.css'))
fs.writeFileSync(path.join(out, '.nojekyll'), '')
console.log(`网站：${files.length} 页 → ${out}`)
