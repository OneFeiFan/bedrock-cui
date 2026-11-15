/**
 * 附加包：生成清单（manifest.json）、固定 UUID、写出资源包与行为包、打成 .mcaddon。
 *
 * 流程参考 sapdon（https://github.com/Meteage/sapdon，MIT License，Copyright (c) 2025 Meteage）的 build / pack：
 * 首次构建时生成 UUID 并存进项目里的文件，之后每次构建不变；资源包与行为包放进同一个 .mcaddon。
 * 这里按 CUI 的面向对象写法重写，压缩用 Node 自带的 zlib（不依赖第三方压缩库，Windows 上也能用）。
 *
 *   const addon = new Addon('my_book').setTitle('我的书').setVersion(1, 0, 0).useUuidFile('cui.uuid.json')
 *   addon.resources.addAll(serverForm({ ... }).files)                 // 界面 JSON 等
 *   addon.behavior.add('scripts/main.js', code)
 *   addon.setScript('scripts/main.js').addRuntime()                     // 脚本端运行时（softWrap、ServerPagesForm）
 *   addon.pack('dist')                                                  // → dist/my_book.mcaddon（以及 dist/my_book_RP、dist/my_book_BP）
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { randomUUID } from 'node:crypto'
import { runtimeFiles } from './index.js'

type Version = [number, number, number]

/** 一个包里的文件（相对包根目录的路径 → 内容；对象按 JSON 写出） */
export class PackFiles {
    readonly files = new Map<string, string | Uint8Array | object>()
    add(file: string, data: string | Uint8Array | object): this { this.files.set(file.replace(/\\/g, '/'), data); return this }
    addAll(files: Record<string, string | Uint8Array | object>): this { for (const [f, d] of Object.entries(files)) this.add(f, d); return this }
    /** 把本机的一个文件（或目录下的所有文件）加进包里 */
    addFrom(source: string, target: string): this {
        const st = fs.statSync(source)
        if (st.isDirectory()) for (const f of fs.readdirSync(source)) this.addFrom(path.join(source, f), `${target}/${f}`)
        else this.add(target, fs.readFileSync(source))
        return this
    }
    get size(): number { return this.files.size }
}

export class Addon {
    readonly resources = new PackFiles()
    readonly behavior = new PackFiles()
    private title: string
    private description = ''
    private version: Version = [1, 0, 0]
    private minEngine: Version = [1, 21, 0]
    private script?: { entry: string, dependencies: Record<string, string> }
    private uuidFile?: string
    private uuids?: Record<string, string>

    /** name = 文件夹与 .mcaddon 的名字（<name>_RP、<name>_BP、<name>.mcaddon） */
    constructor(readonly name: string) { this.title = name }

    /** 显示名（游戏里资源包 / 行为包列表上的名字，后面自动加 RP / BP） */
    setTitle(title: string): this { this.title = title; return this }
    setDescription(text: string): this { this.description = text; return this }
    setVersion(major: number, minor: number, patch: number): this { this.version = [major, minor, patch]; return this }
    setMinEngineVersion(major: number, minor: number, patch: number): this { this.minEngine = [major, minor, patch]; return this }
    /** 行为包的脚本入口与脚本模块依赖（缺省 @minecraft/server 2.0.0 与 @minecraft/server-ui 2.2.0） */
    setScript(entry = 'scripts/main.js', dependencies: Record<string, string> = { '@minecraft/server': '2.0.0', '@minecraft/server-ui': '2.2.0' }): this {
        this.script = { entry, dependencies }
        return this
    }
    /** UUID 存在哪个文件（JSON；不存在就生成）——同一个附加包每次构建 UUID 不变，游戏才认得是同一个包 */
    useUuidFile(file: string): this { this.uuidFile = file; return this }
    /** 把脚本端运行时（softWrap、ServerPagesForm）放进行为包的 dir 目录（缺省 scripts/cui；脚本里 import './cui/runtime/index.js'） */
    addRuntime(dir = 'scripts/cui'): this {
        for (const [rel, content] of runtimeFiles()) this.behavior.add(`${dir}/${rel}`, content)
        return this
    }

    private uuid(key: string): string {
        if (!this.uuids) {
            this.uuids = this.uuidFile && fs.existsSync(this.uuidFile) ? JSON.parse(fs.readFileSync(this.uuidFile, 'utf8')) : {}
        }
        if (!this.uuids![key]) {
            this.uuids![key] = randomUUID()
            if (this.uuidFile) { fs.mkdirSync(path.dirname(path.resolve(this.uuidFile)), { recursive: true }); fs.writeFileSync(this.uuidFile, JSON.stringify(this.uuids, null, 2) + '\n') }
        }
        return this.uuids![key]
    }

    /** 两个包的清单（资源包有文件才有 RP，行为包有文件或脚本才有 BP；BP 依赖 RP） */
    manifests(): { rp?: object, bp?: object } {
        const out: { rp?: object, bp?: object } = {}
        const hasRp = this.resources.size > 0, hasBp = this.behavior.size > 0 || !!this.script
        if (hasRp) out.rp = {
            format_version: 2,
            header: { name: `${this.title} RP`, description: this.description, uuid: this.uuid('rp'), version: this.version, min_engine_version: this.minEngine },
            modules: [{ type: 'resources', uuid: this.uuid('rp_module'), version: this.version }],
        }
        if (hasBp) out.bp = {
            format_version: 2,
            header: { name: `${this.title} BP`, description: this.description, uuid: this.uuid('bp'), version: this.version, min_engine_version: this.minEngine },
            modules: [this.script
                ? { type: 'script', language: 'javascript', uuid: this.uuid('bp_script'), version: this.version, entry: this.script.entry }
                : { type: 'data', uuid: this.uuid('bp_module'), version: this.version }],
            dependencies: [
                ...Object.entries(this.script?.dependencies ?? {}).map(([module_name, version]) => ({ module_name, version })),
                ...(hasRp ? [{ uuid: this.uuid('rp'), version: this.version }] : []),
            ],
        }
        return out
    }

    /** 资源包的 UUID（脚本里 DDUI 的图片等要用） */
    get resourcePackUuid(): string { return this.uuid('rp') }

    /** 写出 <outDir>/<name>_RP 与 <name>_BP（先清空旧的） */
    write(outDir: string): { rp?: string, bp?: string } {
        const m = this.manifests(), out: { rp?: string, bp?: string } = {}
        for (const [key, pack, manifest] of [['rp', this.resources, m.rp], ['bp', this.behavior, m.bp]] as const) {
            if (!manifest) continue
            const dir = path.join(outDir, `${this.name}_${key.toUpperCase()}`)
            fs.rmSync(dir, { recursive: true, force: true })
            for (const [file, data] of [['manifest.json', manifest] as const, ...pack.files]) {
                const to = path.join(dir, file)
                fs.mkdirSync(path.dirname(to), { recursive: true })
                fs.writeFileSync(to, typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data, null, 1))
            }
            out[key] = dir
        }
        return out
    }

    /** 写出两个包并打成 <outDir>/<name>.mcaddon，返回 .mcaddon 的路径 */
    pack(outDir: string): string {
        const dirs = this.write(outDir)
        const entries: [string, Uint8Array][] = []
        for (const dir of [dirs.bp, dirs.rp]) {
            if (!dir) continue
            const walk = (d: string) => {
                for (const f of fs.readdirSync(d).sort()) {
                    const p = path.join(d, f)
                    if (fs.statSync(p).isDirectory()) walk(p)
                    else entries.push([path.relative(outDir, p).replace(/\\/g, '/'), fs.readFileSync(p)])
                }
            }
            walk(dir)
        }
        const file = path.join(outDir, `${this.name}.mcaddon`)
        fs.writeFileSync(file, zip(entries))
        return file
    }
}

// ───────────── 最小的 zip 写入（deflate；文件名 UTF-8） ─────────────

const CRC_TABLE = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
    return t
})()
function crc32(buf: Uint8Array): number {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

/** 把若干文件打成 zip（.mcaddon 就是 zip） */
export function zip(entries: [string, Uint8Array][]): Buffer {
    const locals: Buffer[] = [], centrals: Buffer[] = []
    let offset = 0
    for (const [name, data] of entries) {
        const nameBuf = Buffer.from(name, 'utf8')
        const deflated = zlib.deflateRawSync(data, { level: 9 })
        const useDeflate = deflated.length < data.length
        const body = useDeflate ? deflated : Buffer.from(data)
        const crc = crc32(data)
        const head = Buffer.alloc(30)
        head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(useDeflate ? 8 : 0, 8)
        head.writeUInt32LE(0, 10); head.writeUInt32LE(crc, 14); head.writeUInt32LE(body.length, 18); head.writeUInt32LE(data.length, 22)
        head.writeUInt16LE(nameBuf.length, 26); head.writeUInt16LE(0, 28)
        locals.push(head, nameBuf, body)
        const cen = Buffer.alloc(46)
        cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(useDeflate ? 8 : 0, 10)
        cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24)
        cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42)
        centrals.push(cen, nameBuf)
        offset += 30 + nameBuf.length + body.length
    }
    const central = Buffer.concat(centrals)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16)
    return Buffer.concat([...locals, central, end])
}
