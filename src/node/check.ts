/**
 * 对行为包中的脚本做类型检查（开发工具）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeFiles } from './tools.js'


/**
 * 对行为包里的脚本做类型检查（进游戏之前挡住拼错的 API、参数类型不对等）：用 TypeScript 的编译器接口，不经过命令行，Windows 上也能用。
 * 需要项目里装了 typescript 与 @minecraft/server、@minecraft/server-ui（类型来自它们）。返回错误信息（空数组 = 通过）。
 *
 *   const dirs = addon.write('out')
 *   const errors = await checkScripts(dirs.bp!)            // 缺省检查 scripts/main.js，运行时在 scripts/cui
 */
export async function checkScripts(bpDir: string, options: { entry?: string, runtimeDir?: string, nodeModules?: string } = {}): Promise<string[]> {
    let ts: typeof import('typescript')
    try { ts = (await import('typescript')).default } catch { throw new Error('checkScripts 需要 typescript：npm i -D typescript') }
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
        const program = ts.createProgram([path.join(tmp, options.entry ?? 'scripts/main.js')], {
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
