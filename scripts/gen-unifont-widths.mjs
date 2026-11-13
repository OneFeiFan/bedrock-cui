/**
 * 从 GNU Unifont 生成字距表 → src/font/unifontWidths.ts
 *   node scripts/gen-unifont-widths.mjs path/to/unifont.hex
 *
 * 真机（2026-11，字宽标尺）：基岩版的非 ASCII 字形就是 Unifont 点阵（16 像素，按半像素画），
 * 字距 = 点阵墨迹宽 / 2 + 1（与 Java 版 unicode 字体同一规则）。「中」6.5、「钻」8.5、「，」2、「。」3 均与实测一致。
 * Unifont：GNU GPLv2+（字体嵌入例外）/ SIL OFL 1.1 双许可；这里只取各字形的宽度。
 */
import fs from 'node:fs'
const file = process.argv[2] ?? '/tmp/unifont.hex'
const half = new Uint8Array(0x10000) // 字距（半像素），0 = 未收录
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes(':')) continue
    const [cpHex, bits] = line.trim().split(':')
    const cp = parseInt(cpHex, 16)
    if (cp > 0xffff) continue
    const w = bits.length === 64 ? 16 : 8
    const rows = []
    for (let i = 0; i < bits.length; i += w / 4) rows.push(parseInt(bits.slice(i, i + w / 4), 16))
    let lo = -1, hi = -1
    for (let x = 0; x < w; x++) if (rows.some((r) => (r >> (w - 1 - x)) & 1)) { if (lo < 0) lo = x; hi = x }
    // 空白字形（空格类）：字距 = 点阵宽度 / 2（半像素 = w）——真机：汉字文本里的空格 4
    half[cp] = lo < 0 ? w : (hi - lo + 1) + 2
}
// 稠密编码：0x20–0xFFFF 每个码点一个 36 进制字符（半像素字距，0 = 未收录），查询 O(1)。
// ASCII 也收录：含非 ASCII 字符的文字整段用 Unifont 画（真机：「Esc 关闭」里 E s c 的字距是 4，不是 6）
let enc = ''
for (let cp = 0x20; cp < 0x10000; cp++) enc += half[cp].toString(36)
const out = `/**
 * 自动生成（scripts/gen-unifont-widths.mjs），请勿手改。
 * 非 ASCII 字符的字距（半像素）：基岩版用 GNU Unifont 点阵（真机校准），字距 = 墨迹宽 / 2 + 1。
 * 编码：从 U+0020 起每个码点一个 36 进制字符（0 = 未收录）。Unifont：GPLv2+ 字体例外 / SIL OFL 1.1。
 */
export const UNIFONT_HALF = '${enc}'
`
fs.writeFileSync(new URL('../src/font/unifontWidths.ts', import.meta.url), out)
console.log('文件', out.length, '字节；示例 中', half[0x4e2d] / 2, '钻', half[0x94bb] / 2, '，', half[0xff0c] / 2, '。', half[0x3002] / 2)
