/**
 * 准备浏览器预览用的像素字体（不随源码分发），放在 preview-src/public/font/：
 *   unifont.hex.gz  ← GNU Unifont 16.0.04（画汉字等非 ASCII 字符）。先从 unifoundry.com 下载 hex；连不上时从 GNU 镜像（中科大 / GNU 官方）
 *                     下载 BDF 格式，在本地转换成 hex
 *   ascii.png       ← Minecraft 默认字体（画纯英文），从 Java 版客户端 client.jar 里取出
 *
 * 用法（Windows / macOS / Linux 都只要 Node.js，不需要 unzip 等外部命令）：
 *   node scripts/fetch-fonts.mjs
 *   node scripts/fetch-fonts.mjs --java-jar "C:\path\to\client.jar"     指定 Java 版客户端
 *   node scripts/fetch-fonts.mjs --unifont "D:\下载\unifont-16.0.04.bdf.gz"   用手动下载的 Unifont（.hex / .hex.gz / .bdf / .bdf.gz）
 *   node scripts/fetch-fonts.mjs --force                                 已有的文件也重新准备
 *   node node_modules/bedrock-cui/scripts/fetch-fonts.mjs --out public/font   在自己的项目里用：字体放进项目的静态资源目录（缺省是本包的 preview-src/public/font）
 *
 * client.jar 的查找顺序：--java-jar → 环境变量 CUI_JAVA_CLIENT_JAR → sapdon 缓存 ~/.sapdon/java/<版本>/client.jar →
 *   官方启动器的版本目录（Windows %APPDATA%\.minecraft\versions、macOS ~/Library/Application Support/minecraft/versions、
 *   Linux ~/.minecraft/versions）→ 都没有就从 Mojang 官方服务器下载最新正式版（与启动器同一来源），缓存到 ~/.sapdon/java/<版本>/client.jar。
 *
 * 游戏与 Unifont 不同的字形（真机采样还原）在源码里（src/font/gameGlyphs.ts），不需要额外文件。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const force = args.includes('--force')
const outAt = args.indexOf('--out')
const dir = outAt >= 0 && args[outAt + 1] ? path.resolve(args[outAt + 1]) : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-src', 'public', 'font')
fs.mkdirSync(dir, { recursive: true })

async function download(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return Buffer.from(await res.arrayBuffer())
}
const gunzipMaybe = (buf) => (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf)

// ───────────── Unifont ─────────────

const UNIFONT = '16.0.04'
const UNIFONT_SOURCES = [
    { url: `https://unifoundry.com/pub/unifont/unifont-${UNIFONT}/font-builds/unifont-${UNIFONT}.hex.gz`, format: 'hex' },
    { url: `https://mirrors.ustc.edu.cn/gnu/unifont/unifont-${UNIFONT}/unifont-${UNIFONT}.bdf.gz`, format: 'bdf' },
    { url: `https://ftp.gnu.org/gnu/unifont/unifont-${UNIFONT}/unifont-${UNIFONT}.bdf.gz`, format: 'bdf' },
]

/** BDF → Unifont 的 hex 格式（每行「码位:每行点阵的十六进制」；格子 8 或 16 宽、16 高） */
function bdfToHex(text) {
    const ascent = Number(/^FONT_ASCENT (\d+)/m.exec(text)?.[1] ?? 14)
    const height = ascent + Number(/^FONT_DESCENT (\d+)/m.exec(text)?.[1] ?? 2)
    const out = []
    for (const block of text.split('STARTCHAR').slice(1)) {
        const enc = Number(/^ENCODING (-?\d+)/m.exec(block)?.[1] ?? -1)
        if (enc < 0 || enc > 0xffff) continue
        const [w, h, xo, yo] = (/^BBX (-?\d+) (-?\d+) (-?\d+) (-?\d+)/m.exec(block) ?? []).slice(1).map(Number)
        const cellW = Number(/^DWIDTH (\d+)/m.exec(block)?.[1] ?? w) > 8 ? 16 : 8
        const bitmap = block.split(/^BITMAP\s*$/m)[1]?.split(/^ENDCHAR/m)[0].trim().split(/\s+/).filter(Boolean) ?? []
        const rows = new Array(height).fill(0)
        const top = ascent - (yo + h)
        bitmap.forEach((hex, i) => {
            const bits = parseInt(hex, 16), n = hex.length * 4
            for (let x = 0; x < w; x++) if ((bits >> (n - 1 - x)) & 1) {
                const col = xo + x, row = top + i
                if (col >= 0 && col < cellW && row >= 0 && row < height) rows[row] |= 1 << (cellW - 1 - col)
            }
        })
        out.push(`${enc.toString(16).toUpperCase().padStart(4, '0')}:${rows.map((r) => r.toString(16).toUpperCase().padStart(cellW / 4, '0')).join('')}`)
    }
    return out.join('\n') + '\n'
}

async function prepareUnifont() {
    const file = path.join(dir, 'unifont.hex.gz')
    if (fs.existsSync(file) && !force) return console.log('✓ Unifont 已有：', file)
    const save = (hexText, from) => {
        const glyphs = hexText.split('\n').filter((l) => l.includes(':')).length
        if (glyphs < 50000) throw new Error(`Unifont 字形太少（${glyphs}），文件可能不完整：${from}`)
        fs.writeFileSync(file, zlib.gzipSync(hexText))
        console.log(`✓ Unifont：${glyphs} 个字形，来自 ${from}`)
    }
    const manual = arg('--unifont')
    if (manual) {
        const text = gunzipMaybe(fs.readFileSync(manual)).toString('utf8')
        return save(text.includes('STARTFONT') ? bdfToHex(text) : text, manual)
    }
    for (const src of UNIFONT_SOURCES) {
        try {
            const text = gunzipMaybe(await download(src.url)).toString('utf8')
            return save(src.format === 'bdf' ? bdfToHex(text) : text, src.url)
        } catch (e) { console.log(`  · ${src.url} 不可用（${e.message}），换下一个来源`) }
    }
    throw new Error(`Unifont 下载失败。可以手动下载 unifont-${UNIFONT}.hex.gz 或 .bdf.gz（GNU 镜像），再用 --unifont <文件> 指定`)
}

// ───────────── ascii.png（Java 版客户端） ─────────────

/** 从 zip（jar）里读出一个文件（只用 Node 自带的 zlib；不支持 ZIP64） */
function readZipEntry(buf, name) {
    let eocd = -1
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
    if (eocd < 0) throw new Error('不是 zip / jar 文件')
    const count = buf.readUInt16LE(eocd + 10)
    let p = buf.readUInt32LE(eocd + 16)
    for (let n = 0; n < count; n++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip 中央目录损坏')
        const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20)
        const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32)
        const local = buf.readUInt32LE(p + 42)
        if (buf.toString('utf8', p + 46, p + 46 + nlen) === name) {
            const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
            const data = buf.subarray(start, start + csize)
            return method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data)
        }
        p += 46 + nlen + elen + clen
    }
    return undefined
}

/** 官方启动器的版本目录里最新的 jar */
function launcherJars() {
    const roots = [
        process.env.APPDATA && path.join(process.env.APPDATA, '.minecraft', 'versions'),
        path.join(os.homedir(), 'Library', 'Application Support', 'minecraft', 'versions'),
        path.join(os.homedir(), '.minecraft', 'versions'),
    ].filter(Boolean)
    const jars = []
    for (const root of roots) {
        if (!fs.existsSync(root)) continue
        for (const v of fs.readdirSync(root)) {
            const jar = path.join(root, v, `${v}.jar`)
            if (fs.existsSync(jar)) jars.push({ jar, time: fs.statSync(jar).mtimeMs })
        }
    }
    return jars.sort((a, b) => b.time - a.time).map((j) => j.jar)
}

function sapdonJars() {
    const cache = path.join(os.homedir(), '.sapdon', 'java')
    if (!fs.existsSync(cache)) return []
    return fs.readdirSync(cache).sort().reverse().map((v) => path.join(cache, v, 'client.jar')).filter((p) => fs.existsSync(p))
}

/** 从 Mojang 官方服务器下载最新正式版的 client.jar（与启动器同一来源），缓存到 ~/.sapdon/java/<版本>/client.jar */
async function downloadClientJar() {
    const manifest = JSON.parse((await download('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).toString())
    const id = manifest.latest.release
    const meta = JSON.parse((await download(manifest.versions.find((v) => v.id === id).url)).toString())
    console.log(`  · 下载 Java 版 ${id} 客户端（约 ${Math.round(meta.downloads.client.size / 1e6)} MB，只取其中的 ascii.png）……`)
    const jar = await download(meta.downloads.client.url)
    const file = path.join(os.homedir(), '.sapdon', 'java', id, 'client.jar')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, jar)
    return file
}

async function prepareAscii() {
    const file = path.join(dir, 'ascii.png')
    if (fs.existsSync(file) && !force) return console.log('✓ ascii.png 已有：', file)
    const candidates = [arg('--java-jar'), process.env.CUI_JAVA_CLIENT_JAR, ...sapdonJars(), ...launcherJars()].filter((p) => p && fs.existsSync(p))
    if (!candidates.length) {
        try { candidates.push(await downloadClientJar()) } catch (e) { console.log(`  · 下载 Java 版客户端失败：${e.message}`) }
    }
    for (const jar of candidates) {
        try {
            const png = readZipEntry(fs.readFileSync(jar), 'assets/minecraft/textures/font/ascii.png')
            if (!png) { console.log(`  · ${jar} 里没有 ascii.png，换下一个`); continue }
            fs.writeFileSync(file, png)
            return console.log('✓ ascii.png：取自', jar)
        } catch (e) { console.log(`  · 读取 ${jar} 失败：${e.message}`) }
    }
    console.log('✗ 没能准备 ascii.png：预览里的纯英文会改用 Unifont 画（字形与游戏不同，字距仍按 Minecraft 字体）。可以用 --java-jar 指定 Java 版客户端')
}

await prepareUnifont()
await prepareAscii()
