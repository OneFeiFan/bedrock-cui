/**
 * 与游戏联动：一个 WebSocket 服务器。游戏中输入 /connect localhost:端口 连接后，bedrock-cui 可以向游戏发送命令，
 * 例如构建完成后发送 reload all，让游戏重新加载资源包（含界面文件）。
 *
 * 不依赖第三方库：只实现本用途需要的部分——握手、文本帧（收发）、ping / close。
 * 游戏的命令请求格式：{ header: { version: 1, requestId, messagePurpose: 'commandRequest', messageType: 'commandRequest' },
 *                     body: { version: 1, commandLine, origin: { type: 'player' } } }
 */
import http from 'node:http'
import crypto from 'node:crypto'
import type { Duplex } from 'node:stream'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

/** 文本帧（服务器发往客户端：不加掩码） */
function textFrame(text: string): Buffer {
    const payload = Buffer.from(text, 'utf8')
    const n = payload.length
    const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 0xff]) : (() => {
        const h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h
    })()
    return Buffer.concat([head, payload])
}

/** 从缓冲区中解析完整的帧（客户端发来的帧带掩码）；返回解析出的帧与剩余的字节 */
function parseFrames(buf: Buffer): { frames: { opcode: number, payload: Buffer }[], rest: Buffer } {
    const frames: { opcode: number, payload: Buffer }[] = []
    let off = 0
    while (buf.length - off >= 2) {
        const opcode = buf[off] & 0x0f
        const masked = (buf[off + 1] & 0x80) !== 0
        let len = buf[off + 1] & 0x7f, p = off + 2
        if (len === 126) { if (buf.length < p + 2) break; len = buf.readUInt16BE(p); p += 2 }
        else if (len === 127) { if (buf.length < p + 8) break; len = Number(buf.readBigUInt64BE(p)); p += 8 }
        const maskLen = masked ? 4 : 0
        if (buf.length < p + maskLen + len) break
        const payload = Buffer.from(buf.subarray(p + maskLen, p + maskLen + len))
        if (masked) for (let i = 0; i < len; i++) payload[i] ^= buf[p + (i % 4)]
        frames.push({ opcode, payload })
        off = p + maskLen + len
    }
    return { frames, rest: buf.subarray(off) }
}

/** 与游戏的连接 */
export class GameLink {
    private server?: http.Server
    private sockets = new Set<Duplex>()
    /** 收到游戏的消息时（例如命令的执行结果） */
    onMessage?: (message: unknown) => void
    /** 连接与断开时 */
    onStatus?: (text: string) => void

    constructor(readonly port = 19135) { }

    /** 是否有游戏连着 */
    get connected(): boolean { return this.sockets.size > 0 }

    /** 开始监听 */
    start(): Promise<void> {
        this.server = http.createServer((_, res) => { res.writeHead(426); res.end('请在游戏中输入 /connect 连接') })
        this.server.on('upgrade', (req, socket) => {
            const key = req.headers['sec-websocket-key']
            if (typeof key !== 'string') { socket.destroy(); return }
            const accept = crypto.createHash('sha1').update(key + GUID).digest('base64')
            socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
            this.sockets.add(socket)
            this.onStatus?.('游戏已连接')
            let pending = Buffer.alloc(0)
            socket.on('data', (chunk: Buffer) => {
                const { frames, rest } = parseFrames(Buffer.concat([pending, chunk]))
                pending = Buffer.from(rest)
                for (const f of frames) {
                    if (f.opcode === 0x8) { socket.end(Buffer.from([0x88, 0])); return }           // 关闭
                    if (f.opcode === 0x9) socket.write(Buffer.concat([Buffer.from([0x8a, f.payload.length]), f.payload]))   // ping → pong
                    if (f.opcode === 0x1) { try { this.onMessage?.(JSON.parse(f.payload.toString('utf8'))) } catch { /* 不是 JSON 的消息忽略 */ } }
                }
            })
            const drop = () => { if (this.sockets.delete(socket)) this.onStatus?.('游戏已断开') }
            socket.on('close', drop)
            socket.on('error', drop)
        })
        return new Promise((resolve, reject) => {
            this.server!.once('error', reject)
            this.server!.listen(this.port, () => resolve())
        })
    }

    /** 向所有连着的游戏发送一条命令（不带斜杠），返回发送到的连接数 */
    command(commandLine: string): number {
        const msg = JSON.stringify({
            header: { version: 1, requestId: crypto.randomUUID(), messagePurpose: 'commandRequest', messageType: 'commandRequest' },
            body: { version: 1, commandLine, origin: { type: 'player' } },
        })
        for (const s of this.sockets) s.write(textFrame(msg))
        return this.sockets.size
    }

    /** 停止 */
    close(): Promise<void> {
        for (const s of this.sockets) s.destroy()
        this.sockets.clear()
        return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()))
    }
}
