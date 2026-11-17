/**
 * bedrock-cui dev：在浏览器中预览项目里的全部界面（读 cui.config.mjs）。
 * 贴图取自配置的 textures 目录；字体首次运行时下载到 ~/.cache/bedrock-cui/font（Unifont 与本机 Java 版客户端的 ascii.png，只在本机使用）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { ServerResponse } from 'node:http'
import { encodePng, textureInfoFrom } from '../node/tools.js'
import { SOLID_TEXTURE } from '../core/values.js'

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CONFIG_FILES = ['cui.config.mjs', 'cui.config.js']

/** 找配置文件 */
export function findConfig(root: string): string | undefined {
    return CONFIG_FILES.map((f) => path.join(root, f)).find((f) => fs.existsSync(f))
}

/** 预览字体的缓存目录；没有就下载 */
export function ensureFonts(): string {
    const dir = process.env.BEDROCK_CUI_FONT_DIR ?? path.join(os.homedir(), '.cache', 'bedrock-cui', 'font')
    if (!fs.existsSync(path.join(dir, 'unifont.hex.gz'))) {
        console.log(`首次运行：准备预览字体 → ${dir}`)
        spawnSync(process.execPath, [path.join(pkgRoot, 'scripts', 'fetch-fonts.mjs'), '--out', dir], { stdio: 'inherit' })
    }
    return dir
}

const send = (res: ServerResponse, file: string) => {
    res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
}

/** 贴图目录里的全部 PNG → 预览用的贴图表（地址、尺寸、九宫格） */
function textureMap(dirs: string[]): Record<string, unknown> {
    const info = textureInfoFrom(dirs)
    const map: Record<string, unknown> = {}
    for (const dir of dirs) {
        const walk = (d: string) => {
            if (!fs.existsSync(d)) return
            for (const f of fs.readdirSync(d)) {
                const p = path.join(d, f)
                if (fs.statSync(p).isDirectory()) walk(p)
                else if (f.endsWith('.png')) {
                    const key = path.relative(dir, p).replace(/\\/g, '/').replace(/\.png$/, '')
                    if (!map[key]) map[key] = { url: `/@cui/tex/${key}.png`, ...info(key) }
                }
            }
        }
        walk(dir)
    }
    // 内置纯白贴图（Texture.SOLID）：没有放在任何目录里，由开发服务器生成
    if (!map[SOLID_TEXTURE]) map[SOLID_TEXTURE] = { url: '/@cui/solid.png', size: [2, 2] }
    return map
}

export async function dev(options: { root?: string, port?: number, game?: number } = {}): Promise<void> {
    const root = path.resolve(options.root ?? '.')
    const configFile = findConfig(root)
    if (!configFile) throw new Error('当前目录没有 cui.config.mjs。用 bedrock-cui create <名字> 创建项目，或在项目根目录添加配置文件')
    const fontDir = ensureFonts()
    const { createServer } = await import('vite')
    let textureDirs: string[] = [path.join(root, 'res')]
    const client = fs.readFileSync(path.join(pkgRoot, 'templates', 'dev-client.js'), 'utf8')
    const page = fs.readFileSync(path.join(pkgRoot, 'templates', 'dev.html'), 'utf8')

    const server = await createServer({
        root, configFile: false, logLevel: 'info', clearScreen: false,
        server: { port: options.port ?? 5173 },
        plugins: [{
            name: 'bedrock-cui-dev',
            resolveId(id) {
                if (id === '/@cui/dev.js') return '\0cui-dev'
                if (id === 'virtual:cui-textures') return '\0cui-textures'
                if (id === 'virtual:cui-config') return configFile
                return undefined
            },
            load(id) {
                if (id === '\0cui-dev') return client
                if (id === '\0cui-textures') return `export default ${JSON.stringify(textureMap(textureDirs))}`
                return undefined
            },
            configureServer(srv) {
                srv.middlewares.use(async (req, res, next) => {
                    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
                    if (url === '/' || url === '/index.html') {
                        res.setHeader('Content-Type', 'text/html; charset=utf-8')
                        return res.end(await srv.transformIndexHtml('/', page))
                    }
                    if (url.startsWith('/@cui/font/')) {
                        const f = path.join(fontDir, path.basename(url))
                        if (fs.existsSync(f)) return send(res, f)
                        res.statusCode = 404; return res.end()
                    }
                    if (url === '/@cui/solid.png') {
                        res.setHeader('Content-Type', 'image/png')
                        return res.end(encodePng(2, 2, new Uint8Array(16).fill(255)))
                    }
                    if (url.startsWith('/@cui/tex/')) {
                        const rel = url.slice('/@cui/tex/'.length)
                        for (const d of textureDirs) { const f = path.join(d, rel); if (fs.existsSync(f)) return send(res, f) }
                        res.statusCode = 404; return res.end()
                    }
                    next()
                })
            },
        }],
    })
    // 贴图目录取自配置
    const config = (await server.ssrLoadModule(configFile)).default as { textures?: string[] }
    textureDirs = (config.textures ?? ['res']).map((d) => path.resolve(root, d))
    await server.listen()
    server.printUrls()
    if (options.game) await linkGame(root, options.game)
}

/**
 * 与游戏联动（bedrock-cui dev --game）：游戏中 /connect localhost:端口 连接；保存界面或资源后自动构建，
 * 构建完成后向游戏发送 reload all（sapdon 在 Windows 上把构建结果复制到游戏的开发包目录）。
 * 构建会写入 scripts/cui.generated.* 与 res/ 中生成的贴图：这些文件、以及构建期间的改动不触发下一次构建。
 */
async function linkGame(root: string, port: number): Promise<void> {
    const { GameLink } = await import('./game.js')
    const link = new GameLink(port)
    link.onStatus = (t) => console.log(`[bedrock-cui] ${t}`)
    link.onMessage = (m) => {
        const body = (m as { body?: { statusMessage?: string, statusCode?: number } }).body
        if (body?.statusMessage) console.log(`[bedrock-cui] 游戏：${body.statusMessage}`)
    }
    await link.start()
    console.log(`  与游戏联动：在游戏中输入 /connect localhost:${port}\n`)
    const watched = /^(ui|res|scripts)[\\/]|^cui\.config\./
    const generated = /cui\.generated\.|[\\/]font[\\/]glyph_|bedrock_cui[\\/]/
    let timer: ReturnType<typeof setTimeout> | undefined, building = false
    const build = () => {
        building = true
        console.log('[bedrock-cui] 文件已修改，开始构建……')
        const bin = path.join(pkgRoot, 'bin', 'bedrock-cui.mjs')
        const r = spawnSync(process.execPath, [bin, 'build'], { cwd: root, stdio: 'inherit' })
        setTimeout(() => { building = false }, 1000)          // 构建写出的文件引起的改动不再触发
        if (r.status !== 0) { console.log('[bedrock-cui] 构建失败，没有通知游戏'); return }
        const n = link.command('reload all')
        console.log(n ? '[bedrock-cui] 已构建，游戏正在重新加载（reload all）' : '[bedrock-cui] 已构建；游戏未连接，没有发送 reload all')
    }
    fs.watch(root, { recursive: true }, (_, file) => {
        if (!file || building || !watched.test(file) || generated.test(file)) return
        clearTimeout(timer)
        timer = setTimeout(build, 800)
    })
}
