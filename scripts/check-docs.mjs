/**
 * 检查手册（docs/guide）：相对链接都指向存在的文件；能独立运行的代码块逐个实际运行。
 *   node scripts/check-docs.mjs
 * 跳过的代码块：游戏脚本（@minecraft、cui.generated）、浏览器代码（document、bedrock-cui/web）、sapdon、承接上文的片段（含 …… 或以 // 接上例 开头）、打包与写文件的示例。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const guide = path.join(root, 'docs', 'guide')
const files = []
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : f.endsWith('.md') && files.push(p) } }
walk(guide)

let bad = 0, ran = 0
const typed = []       // [临时文件, 页面, 第几个代码块]：运行之后统一做类型检查
for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    for (const m of text.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
        if (/^https?:/.test(m[1])) continue
        if (!fs.existsSync(path.resolve(path.dirname(file), m[1]))) { console.error(`✗ ${path.relative(guide, file)}：链接 ${m[1]} 指向的文件不存在`); bad++ }
    }
    const blocks = [...text.matchAll(/```js[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1])
    blocks.forEach((code, k) => {
        if (!code.includes("from 'bedrock-cui") || code.startsWith('// 接上例') || /……|@minecraft|cui\.generated|\.\/cui\/|@sapdon|document\.|bedrock-cui\/web|\.\/ui\/|\.build\(|.pack\(|copyRuntime\(|checkScripts\(|actionForm/.test(code)) return
        const tmp = path.join(root, 'examples', `_docs_check_${process.pid}_${typed.length}.mjs`)
        fs.writeFileSync(tmp, code)
        const r = spawnSync(process.execPath, [tmp], { encoding: 'utf8' })
        typed.push([tmp, path.relative(guide, file), k + 1])
        ran++
        if (r.status !== 0) { console.error(`✗ ${path.relative(guide, file)} 的第 ${k + 1} 个代码块：\n${(r.stderr.match(/^\w*Error.*$/m) ?? [r.stderr])[0]}`); bad++ }
    })
}
// 类型检查：参数类型不对（例如把布尔值传给需要序号的方法）运行时不会报错，要靠这一步
try {
    const ts = createRequire(import.meta.url)('typescript')
    const program = ts.createProgram(typed.map(([f]) => f), {
        allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true,
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    })
    for (const d of ts.getPreEmitDiagnostics(program)) {
        const hit = typed.find(([f]) => d.file && path.resolve(d.file.fileName) === path.resolve(f))
        if (!hit) continue
        const { line } = d.file.getLineAndCharacterOfPosition(d.start)
        console.error(`✗ ${hit[1]} 的第 ${hit[2]} 个代码块，第 ${line + 1} 行：${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)
        bad++
    }
} finally {
    for (const [f] of typed) fs.rmSync(f, { force: true })
}
console.log(`手册：${files.length} 页，运行了 ${ran} 个代码块并做了类型检查，${bad ? `${bad} 个问题` : '没有问题'}`)
process.exit(bad ? 1 : 0)
