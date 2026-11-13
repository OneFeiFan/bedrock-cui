/**
 * Node 端工具（不在浏览器预览里用）：从资源包目录读取贴图的真实信息，交给排版引擎、lint 与预览——
 * 像素尺寸读 PNG 文件头；九宫格与逻辑尺寸读同名 .json（nineslice_size、base_size）。
 * 原版贴图（如 textures/ui/cell_image：10×10 像素、base_size 5×5、nineslice 1）手抄容易漏，读文件才准。
 */
import fs from 'node:fs'
import path from 'node:path'
import type { TextureInfo } from '../layout/engine.js'

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
