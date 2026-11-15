/**
 * 下载浏览器预览与真机测试包用到的原版贴图（Mojang 的资源，不随源码分发）：
 * 从 Mojang 官方发布的 bedrock-samples 仓库获取，放进 preview-src/public/textures/（已加入 .gitignore），只在本机使用。
 *   node scripts/fetch-vanilla-textures.mjs [--force]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/'
export const VANILLA = [
    'items/book_normal', 'items/book_writable', 'items/diamond', 'items/diamond_sword', 'items/emerald', 'items/map_empty',
    'items/name_tag', 'items/paper', 'items/stick', 'ui/cell_image', 'ui/highlight_slot', 'ui/purpleBorder',
]
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-src', 'public', 'textures')
const force = process.argv.includes('--force')

fs.mkdirSync(dir, { recursive: true })
let got = 0
for (const p of VANILLA) {
    const file = path.join(dir, `${path.basename(p)}.png`)
    if (fs.existsSync(file) && !force) continue
    const res = await fetch(`${BASE}${p}.png`)
    if (!res.ok) { console.error(`✗ ${p}：HTTP ${res.status}`); process.exitCode = 1; continue }
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    got++
}
console.log(`原版贴图：下载了 ${got} 张，共 ${VANILLA.length} 张 → ${dir}`)
