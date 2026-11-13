/**
 * 准备预览用的像素字体（不随源码分发）：
 *   preview-src/public/font/unifont.hex.gz  ← GNU Unifont（OFL）
 *   preview-src/public/font/ascii.png       ← Minecraft 默认字体，取自本机的 Java 版客户端
 *                                             （CUI_JAVA_CLIENT_JAR，或 sapdon 缓存 ~/.sapdon/java/<版本>/client.jar）
 *   node scripts/fetch-fonts.mjs
 * 没有 ascii.png 时，预览里的纯英文也用 Unifont 画（字形与游戏不同，字距仍按 Minecraft 字体）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-src', 'public', 'font')
fs.mkdirSync(dir, { recursive: true })

const uni = path.join(dir, 'unifont.hex.gz')
if (!fs.existsSync(uni)) {
    const url = 'https://unifoundry.com/pub/unifont/unifont-16.0.04/font-builds/unifont-16.0.04.hex.gz'
    const res = await fetch(url)
    if (!res.ok) throw new Error(`下载 Unifont 失败：${res.status} ${url}`)
    fs.writeFileSync(uni, Buffer.from(await res.arrayBuffer()))
}
console.log('Unifont：', uni, fs.statSync(uni).size, '字节')

const ascii = path.join(dir, 'ascii.png')
const candidates = [process.env.CUI_JAVA_CLIENT_JAR]
const cache = path.join(os.homedir(), '.sapdon', 'java')
if (fs.existsSync(cache)) for (const v of fs.readdirSync(cache).sort().reverse()) candidates.push(path.join(cache, v, 'client.jar'))
const jar = candidates.find((p) => p && fs.existsSync(p))
if (jar) {
    fs.writeFileSync(ascii, execFileSync('unzip', ['-p', jar, 'assets/minecraft/textures/font/ascii.png']))
    console.log('ascii.png：取自', jar)
} else {
    console.log('没有找到 Java 版客户端（设 CUI_JAVA_CLIENT_JAR 或先用 sapdon 构建一次）：纯英文也用 Unifont 画')
}
