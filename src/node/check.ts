/**
 * 对行为包中的脚本做类型检查（开发工具）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeFiles } from './tools.js'


/**
 * 对脚本做类型检查（进游戏之前挡住拼错的 API、参数类型不对等）：用 TypeScript 的编译器接口，不经过命令行，Windows 上也能用。
 * 需要项目里装了 typescript 与 @minecraft/server、@minecraft/server-ui（类型来自它们）。返回错误信息（空数组 = 通过）。
 *
 *   await checkScripts('.')                 // 项目目录（含 cui.config.mjs）：原地检查 scripts/ 下的脚本，连同它们导入的界面文件
 *   await checkScripts('my_pack_BP')        // 行为包目录（不打包、用 copyRuntime 的流程）：检查 scripts/ 下的 .js
 */
export async function checkScripts(dir: string, options: { entry?: string, runtimeDir?: string, nodeModules?: string } = {}): Promise<string[]> {
    let ts: typeof import('typescript')
    try { ts = (await import('typescript')).default } catch { throw new Error('checkScripts 需要 typescript：npm i -D typescript') }
    if (fs.existsSync(path.join(dir, 'cui.config.mjs'))) return checkProject(ts, path.resolve(dir), options.entry)
    const bpDir = dir
    const nodeModules = path.resolve(options.nodeModules ?? 'node_modules')
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-check-'))
    try {
        fs.cpSync(path.join(bpDir, 'scripts'), path.join(tmp, 'scripts'), { recursive: true })
        // 运行时的 .d.ts 放到 .js 旁边：检查脚本对运行时的调用，而不检查运行时自己的 JS
        const runtimeDir = path.join(tmp, options.runtimeDir ?? 'scripts/cui')
        const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
        if (fs.existsSync(runtimeDir)) for (const [rel] of runtimeFiles()) {
            const dts = path.join(dist, rel.replace(/\.js$/, '.d.ts'))
            if (fs.existsSync(dts)) fs.copyFileSync(dts, path.join(runtimeDir, rel.replace(/\.js$/, '.d.ts')))
        }
        // 入口：指定的文件，或 scripts/ 下的全部 .js（sapdon 打包后是 scripts/index.js；运行时目录本身不检查）
        const files: string[] = []
        const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (p !== runtimeDir) walk(p) } else if (f.endsWith('.js')) files.push(p) } }
        if (options.entry) files.push(path.join(tmp, options.entry)); else walk(path.join(tmp, 'scripts'))
        const program = ts.createProgram(files, {
            allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true,
            target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
            baseUrl: tmp, paths: { '@minecraft/*': [path.join(nodeModules, '@minecraft', '*')] },
        })
        return ts.getPreEmitDiagnostics(program).map((d) => {
            const text = ts.flattenDiagnosticMessageText(d.messageText, '\n')
            if (!d.file || d.start === undefined) return text
            const { line, character } = d.file.getLineAndCharacterOfPosition(d.start)
            return `${path.relative(tmp, d.file.fileName).replace(/\\/g, '/')}:${line + 1}:${character + 1} ${text}`
        })
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true })
    }
}

/** 项目模式：原地检查 scripts/ 下的脚本（sapdon 打包之前的源码），模块从项目的 node_modules 解析 */
function checkProject(ts: typeof import('typescript'), root: string, entry?: string): string[] {
    const files: string[] = []
    const walk = (d: string) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.m?js$/.test(f)) files.push(p) } }
    if (entry) files.push(path.join(root, entry)); else walk(path.join(root, 'scripts'))
    const program = ts.createProgram(files, {
        allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true,
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: root,
    })
    return ts.getPreEmitDiagnostics(program).map((d) => {
        const text = ts.flattenDiagnosticMessageText(d.messageText, '\n')
        if (!d.file || d.start === undefined) return text
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start)
        return `${path.relative(root, d.file.fileName).replace(/\\/g, '/')}:${line + 1}:${character + 1} ${text}`
    })
}
