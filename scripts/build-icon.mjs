/**
 * 生成 README 使用的项目图标 docs/icon.png（256 × 256：32 像素的图标放大 8 倍）。
 * 图标的像素画在 docs/site/icon/icon.mjs；网站使用的各尺寸在构建网站时生成。
 *
 *     node scripts/build-icon.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng } from 'bedrock-cui/node'
import { ICON_32, iconImage } from '../docs/site/icon/icon.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/** 图标网格 → PNG（按整数倍放大） */
export function iconPng(grid, scale, pad = 0, padColor = null) {
    const { width, height, pixel } = iconImage(grid, scale, pad, padColor)
    const data = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y) ?? [0, 0, 0, 0], (y * width + x) * 4)
    return encodePng(width, height, data)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const file = path.join(root, 'docs', 'icon.png')
    fs.writeFileSync(file, iconPng(ICON_32, 8))
    console.log(`图标：${path.relative(root, file)}（${fs.statSync(file).size} 字节）`)
}
