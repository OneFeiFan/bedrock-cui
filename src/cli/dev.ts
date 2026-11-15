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
import { textureInfoFrom } from '../node/tools.js'

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
    return map
}

export async function dev(options: { root?: string, port?: number } = {}): Promise<void> {
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
}
