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
import { encodePng } from 'bedrock-cui/node'
import { build as viteBuild } from 'vite'

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

/**
 * 在线示例：```js preview=变量名 宽x高 —— 显示代码，并在下方用像素预览显示该变量（模拟屏幕 宽×高）。
 * 代码只能从 'bedrock-cui' 导入（改写成从 window.CUI 取用）。
 */
function previewScript(code, id, name, w, h, base) {
    const body = code.replace(/^import\s*\{([^}]*)\}\s*from\s*'bedrock-cui'\s*;?\s*$/gm, (_, names) => `const {${names}} = CUI`)
    if (/^\s*import\s/m.test(body)) throw new Error(`在线示例只能从 'bedrock-cui' 导入：${id}`)
    return `<div class="cui-preview" id="${id}"></div>\n<p class="cui-preview-note">预览：按游戏的排版规则绘制。英文字母的字形与游戏不同，原版贴图以替代图显示。</p>\n` +
        `<script>(() => {\n${body.replace(/<\/script/g, '<\\/script')}\nCUI_PREVIEW('${id}', ${name}, { w: ${w}, h: ${h}, base: '${base}' })\n})()</script>\n`
}

function renderMarkdown(src, file) {
    const toc = []
    const base = '../'.repeat(file.split('/').length - 1)
    let previews = 0
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
                const note = marks.size ? '<p class="code-note">绿色背景的行是相对上一段代码新增或修改的部分。</p>\n' : ''
                const pre = `<pre class="code" data-lang="${language}"><code>${lines.join('')}</code></pre>\n${note}`
                const pv = lang.match(/preview=(\w+)(?:\s+(\d+)x(\d+))?/)
                if (!pv) return pre
                return pre + previewScript(text, `pv-${++previews}`, pv[1], Number(pv[2] ?? 240), Number(pv[3] ?? 140), base)
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
    return { html, toc, previews, title: (src.match(/^# (.+)$/m) ?? [, file])[1].replace(/`/g, '') }
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
<link rel="stylesheet" href="${prefix}site.css">${page.previews ? `\n<script src="${prefix}assets/cui-preview.js"></script>` : ''}
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

// 在线示例：浏览器脚本（bedrock-cui + 预览）、替代贴图、Unifont
await viteBuild({
    configFile: false, logLevel: 'warn',
    resolve: { alias: [{ find: /^bedrock-cui\/web$/, replacement: path.join(root, 'dist', 'web', 'index.js') }, { find: /^bedrock-cui$/, replacement: path.join(root, 'dist', 'index.js') }] },
    build: { outDir: path.join(out, 'assets'), emptyOutDir: false, lib: { entry: path.join(root, 'scripts', 'site-preview-entry.js'), formats: ['iife'], name: 'CUIPreviewBundle', fileName: () => 'cui-preview.js' } },
})
const png = (w, h, px) => { const d = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(px(x, y) ?? [0, 0, 0, 0], (y * w + x) * 4); return encodePng(w, h, d) }
const edge = (x, y, n = 16) => Math.min(x, y, n - 1 - x, n - 1 - y)
const tex = path.join(out, 'assets', 'textures')
fs.mkdirSync(tex, { recursive: true })
fs.writeFileSync(path.join(tex, 'dialog.png'), png(16, 16, (x, y) => {
    const e = edge(x, y)
    if (e === 0) return (x === 0 || x === 15) && (y === 0 || y === 15) ? null : [0, 0, 0, 255]
    if (e === 1) return x === 1 || y === 1 ? [255, 255, 255, 255] : [85, 85, 85, 255]
    return [198, 198, 198, 255]
}))
fs.writeFileSync(path.join(tex, 'purple.png'), png(16, 16, (x, y) => (edge(x, y) === 1 ? [80, 10, 170, 255] : [16, 0, 16, 255])))
fs.writeFileSync(path.join(tex, 'white.png'), png(2, 2, () => [255, 255, 255, 255]))
fs.writeFileSync(path.join(tex, 'diamond.png'), png(16, 16, (x, y) => {
    const d = Math.abs(x - 7.5) + Math.abs(y - 7.5)
    return d < 5.5 ? (x + y < 14 ? [160, 250, 245, 255] : [40, 200, 200, 255]) : d < 6.6 ? [20, 90, 100, 255] : null
}))
fs.writeFileSync(path.join(tex, 'stick.png'), png(16, 16, (x, y) => (Math.abs(x + y - 15) <= 1 && x > 2 && x < 13 ? [120, 80, 40, 255] : null)))
fs.writeFileSync(path.join(tex, 'sword.png'), png(16, 16, (x, y) => {
    if (Math.abs(x + y - 15) <= 1 && x >= 5 && x <= 14) return [120, 230, 230, 255]
    if (Math.abs(x - y) <= 1 && x >= 2 && x <= 6 && y >= 8) return [40, 40, 40, 255]
    if (Math.abs(x + y - 15) <= 0 && x >= 1 && x <= 4) return [110, 75, 40, 255]
    return null
}))
const unifont = path.join(root, 'preview-src', 'public', 'font', 'unifont.hex.gz')
if (fs.existsSync(unifont)) {
    fs.mkdirSync(path.join(out, 'font'), { recursive: true })
    fs.copyFileSync(unifont, path.join(out, 'font', 'unifont.hex.gz'))
    fs.writeFileSync(path.join(out, 'font', 'LICENSE.txt'), `unifont.hex.gz — GNU Unifont 16.0.04
Copyright (C) 1998-2024 Roman Czyborra, Paul Hardy, Qianqian Fang, Andrew Miller, Johnnie Weaver, David Corbett, Nils Moskopp, Rebecca Bettencourt, et al.
GNU Unifont 采用 GNU GPLv2+（含字体嵌入例外）与 SIL Open Font License 1.1 双许可；此处按 SIL OFL 1.1 再发布，未作修改。
项目：https://unifoundry.com/unifont/
许可全文：https://openfontlicense.org/open-font-license-official-text/
`)
}
else console.warn('没有 Unifont（node scripts/fetch-fonts.mjs --no-ascii）：在线示例的文字会改用系统字体')
fs.writeFileSync(path.join(out, '.nojekyll'), '')
console.log(`网站：${files.length} 页 → ${out}`)
