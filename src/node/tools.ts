/**
 * Node 端工具（不在浏览器预览里用）：从资源包目录读取贴图的真实信息，交给排版引擎、lint 与预览——
 * 像素尺寸读 PNG 文件头；九宫格与逻辑尺寸读同名 .json（nineslice_size、base_size）。
 * 原版贴图（如 textures/ui/cell_image：10×10 像素、base_size 5×5、nineslice 1）手抄容易漏，读文件才准。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import type { TextureInfo } from '../layout/engine.js'
import type { GlyphSheet } from '../core/glyphs.js'

/** 读 PNG 的宽高（IHDR） */
export function pngSize(file: string): [number, number] | undefined {
    try {
        const fd = fs.openSync(file, 'r')
        const buf = Buffer.alloc(24)
        fs.readSync(fd, buf, 0, 24, 0)
        fs.closeSync(fd)
        if (buf.toString('ascii', 12, 16) !== 'IHDR') return undefined
        return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
    } catch { return undefined }
}

/** 去掉 JSON 里的 // 与 /* *\/ 注释（原版 .json 常带注释） */
const stripComments = (s: string) => s.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? '')

/**
 * 贴图信息查询：按顺序在若干资源包根目录里找 `<贴图路径>.png` 与 `<贴图路径>.json`（找到即缓存）。
 *   const textures = textureInfoFrom(['RP', '.cache/vanilla/resource_pack'])
 *   compileNamespace(ns, roots, { textures })
 */
export function textureInfoFrom(roots: string[]): (texture: string) => TextureInfo | undefined {
    const cache = new Map<string, TextureInfo | undefined>()
    return (texture) => {
        if (cache.has(texture)) return cache.get(texture)
        let info: TextureInfo | undefined
        for (const root of roots) {
            const base = path.join(root, texture)
            const size = pngSize(`${base}.png`)
            if (!size) continue
            info = { size }
            try {
                const meta = JSON.parse(stripComments(fs.readFileSync(`${base}.json`, 'utf8')))
                if (meta.nineslice_size !== undefined) info.nineslice = meta.nineslice_size
                if (meta.base_size !== undefined) info.baseSize = meta.base_size
            } catch { /* 没有 .json */ }
            break
        }
        cache.set(texture, info)
        return info
    }
}

// ───────────────────────────── PNG 编码（零依赖，生成贴图用） ─────────────────────────────

const CRC = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
    return t
})()
const crc32 = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
}

/** RGBA（每像素 4 字节，行优先）→ PNG */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
    const raw = Buffer.alloc((width * 4 + 1) * height)
    for (let y = 0; y < height; y++) {
        raw[y * (width * 4 + 1)] = 0
        Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1)
    }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// ───────────── PNG 解码（字形图要读物品贴图：原版贴图有调色板 / 透明表 / RGBA） ─────────────

/** 解码 PNG → RGBA（支持灰度、RGB、调色板 1/2/4/8 位 + tRNS、灰度+透明、RGBA；8 位；不支持隔行） */
export function decodePng(buf: Buffer): { width: number, height: number, data: Uint8Array } {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG')
    let pos = 8, width = 0, height = 0, depth = 0, ctype = 0, interlace = 0
    let palette: Buffer | undefined, trns: Buffer | undefined
    const idat: Buffer[] = []
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len)
        if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12] }
        else if (type === 'PLTE') palette = data
        else if (type === 'tRNS') trns = data
        else if (type === 'IDAT') idat.push(data)
        else if (type === 'IEND') break
        pos += 12 + len
    }
    if (interlace) throw new Error('不支持隔行 PNG')
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype as 0 | 2 | 3 | 4 | 6]
    if (!channels) throw new Error(`不支持的 PNG 颜色类型 ${ctype}`)
    if (ctype !== 3 && depth !== 8) throw new Error(`只支持 8 位（调色板除外）：位深 ${depth}`)
    const raw = zlib.inflateSync(Buffer.concat(idat))
    const bpp = Math.max(1, (channels * depth) / 8), stride = Math.ceil((width * channels * depth) / 8)
    const rows = new Uint8Array(height * stride)
    let prev = new Uint8Array(stride)
    for (let y = 0; y < height; y++) {
        const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = new Uint8Array(stride)
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0
            const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
            const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c
            cur[i] = (line[i] + pred) & 255
        }
        rows.set(cur, y * stride); prev = cur
    }
    const out = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4, row = rows.subarray(y * stride, (y + 1) * stride)
        if (ctype === 3) {
            const per = 8 / depth, byte = row[Math.floor(x / per)], idx = (byte >> (8 - depth * (1 + (x % per)))) & ((1 << depth) - 1)
            out[o] = palette![idx * 3]; out[o + 1] = palette![idx * 3 + 1]; out[o + 2] = palette![idx * 3 + 2]
            out[o + 3] = trns && idx < trns.length ? trns[idx] : 255
        } else if (ctype === 6) out.set(row.subarray(x * 4, x * 4 + 4), o)
        else if (ctype === 2) { out.set(row.subarray(x * 3, x * 3 + 3), o); out[o + 3] = 255 }
        else if (ctype === 4) { out[o] = out[o + 1] = out[o + 2] = row[x * 2]; out[o + 3] = row[x * 2 + 1] }
        else { out[o] = out[o + 1] = out[o + 2] = row[x]; out[o + 3] = 255 }
    }
    return { width, height, data: out }
}

/** 一张图的墨迹：[左边第一列, 宽度]（不透明列的范围；全透明 → [0, 0]） */
export function inkOf(img: { width: number, height: number, data: Uint8Array }): [number, number] {
    let left = -1, right = -1
    for (let x = 0; x < img.width; x++) {
        let any = false
        for (let y = 0; y < img.height && !any; y++) any = img.data[(y * img.width + x) * 4 + 3] > 0
        if (any) { if (left < 0) left = x; right = x }
    }
    return left < 0 ? [0, 0] : [left, right - left + 1]
}

/** 16×16 → 8×8：每 2×2 块里至少 2 个不透明像素才算不透明，颜色取不透明像素的平均（保住轮廓） */
export function downscaleIcon(cell16: Uint8Array): Uint8Array {
    const out = new Uint8Array(8 * 8 * 4)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        let n = 0, r = 0, g = 0, b = 0
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const o = ((y * 2 + dy) * 16 + x * 2 + dx) * 4
            if (cell16[o + 3] > 0) { n++; r += cell16[o]; g += cell16[o + 1]; b += cell16[o + 2] }
        }
        if (n >= 2) out.set([Math.round(r / n), Math.round(g / n), Math.round(b / n), 255], (y * 8 + x) * 4)
    }
    return out
}

/**
 * 生成字形图（256×256、16×16 格）：每个图标原样放进它的格子（emoji 页 1:1 画 16 高；文字页按一半画 8 高——都用 16×16 的图）。
 * 按贴图算墨迹，与 GlyphSheet.icon() 写的不符时改正字距并报出（把正确值写回代码，预览才一致）。
 * resolve：贴图路径（不带扩展名）→ PNG 文件路径。
 */
export function renderGlyphSheet(sheet: GlyphSheet, resolve: (texturePath: string) => string): { file: string, png: Buffer, issues: string[] } {
    const W = 256, px = new Uint8Array(W * W * 4), issues: string[] = []
    for (const g of [...sheet.glyphs]) {
        const img = decodePng(fs.readFileSync(resolve(g.texture.path)))
        const cx = (g.cell % 16) * 16, cy = Math.floor(g.cell / 16) * 16
        // 取成 16×16（更大的贴图按最近邻缩）
        const cell16 = new Uint8Array(16 * 16 * 4)
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const sx = Math.floor((x * img.width) / 16), sy = Math.floor((y * img.height) / 16), so = (sy * img.width + sx) * 4
            cell16.set(img.data.subarray(so, so + 4), (y * 16 + x) * 4)
            px.set(img.data.subarray(so, so + 4), ((cy + y) * W + cx + x) * 4)
        }
        const ink = inkOf({ width: 16, height: 16, data: cell16 })
        if (ink[0] !== g.ink[0] || ink[1] !== g.ink[1]) {
            issues.push(`字形图标 ${g.name} 的墨迹实际是 [${ink[0]}, ${ink[1]}]（代码里写的是 [${g.ink[0]}, ${g.ink[1]}]）：写成 icon('${g.name}', …, { ink: [${ink[0]}, ${ink[1]}] })，预览的字距才一致`)
            sheet._setInk(g, ink)
        }
    }
    return { file: sheet.fileName, png: encodePng(W, W, px), issues }
}

// ───────────── 脚本端运行时：复制进行为包 ─────────────

/** 运行时用到的文件（相对 dist；保持目录结构，相对 import 才找得到）。runtime/serverPages 依赖 @minecraft/server、server-ui（行为包里有） */
const RUNTIME_FILES = ['runtime/index', 'runtime/serverPages', 'core/serverPagesShared', 'font/rich', 'font/metrics', 'font/gameGlyphs', 'font/unifontWidths', 'core/timer']

/** 运行时的文件：[相对路径, 内容]（copyRuntime 与 checkScripts 用） */
export function runtimeFiles(): [string, Buffer][] {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    return RUNTIME_FILES.map((f) => [`${f}.js`, fs.readFileSync(path.join(dist, f + '.js'))])
}

/**
 * 把脚本端运行时（cui/runtime：preWrap 等）复制进行为包的脚本目录，例如 `copyRuntime(path.join(bp, 'scripts', 'cui'))`，
 * 脚本里 `import { preWrap } from './cui/runtime/index.js'`。types = 同时复制 .d.ts（给脚本做类型检查用；行为包里不需要）。
 */
export function copyRuntime(dest: string, options: { types?: boolean } = {}): string[] {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const out: string[] = []
    for (const f of RUNTIME_FILES) {
        for (const ext of options.types ? ['.js', '.d.ts'] : ['.js']) {
            const src = path.join(dist, f + ext), to = path.join(dest, f + ext)
            fs.mkdirSync(path.dirname(to), { recursive: true })
            fs.copyFileSync(src, to)
            out.push(to)
        }
    }
    return out
}
