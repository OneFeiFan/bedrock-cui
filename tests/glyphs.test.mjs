import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { GlyphSheet, Label, Panel, Paragraph, Texture, compileNamespace, textWidth } from '../dist/index.js'
import { decodePng, inkOf, renderGlyphSheet } from '../dist/node/index.js'

const TEX = (n) => `preview-src/public/textures/${n}.png`

test('emoji 页（E2–F8，真机 1.17.0）：1:1、16 高，字距 = 墨迹宽 + 1；粗体 + 0.5', () => {
    const sheet = new GlyphSheet('E3')
    const S = sheet.icon('sword', Texture.of('textures/items/diamond_sword'), { ink: [0, 16] })
    const D = sheet.icon('diamond', 'textures/items/diamond', { ink: [2, 12] })
    const K = sheet.icon('stick', 'textures/items/stick', { ink: [2, 13] })
    assert.deepEqual([S, D, K].map((g) => g.char.codePointAt(0).toString(16)), ['e300', 'e301', 'e302'])
    assert.deepEqual([S.advance, D.advance, K.advance], [17, 13, 14], '真机：钻石剑 17、钻石 13、木棍 14')
    assert.deepEqual([S.kind, S.pixels, `${S}`], ['emoji', 16, S.char], 'emoji 页写进文字就是字符本身（不染色）')
    assert.equal(textWidth(`${D}${D}${D}${D}`), 52)
    assert.equal(textWidth(`§l${S}${D}`), 17 + 13 + 0.5 * 2)
    assert.throws(() => new GlyphSheet('E1'), /E2–F8/)
    assert.throws(() => sheet.icon('sword', 'x'), /重名/)
})

test('文字页（借用彝文 A0–A4）：按一半画、8 高、与汉字同高；字距 = 墨迹宽 / 2 + 1；写进文字包成 §f…§r（白色 = 原色），不占宽度', () => {
    const sheet = new GlyphSheet('A1', { kind: 'text' })
    const S = sheet.icon('sword', 'textures/items/diamond_sword', { ink: [0, 16] })
    const D = sheet.icon('diamond', 'textures/items/diamond', { ink: [2, 12] })
    assert.equal(S.char.codePointAt(0).toString(16), 'a100')
    assert.deepEqual([S.kind, S.pixels, S.advance, D.advance], ['text', 8, 9, 7])
    assert.equal(`${D}`, `§f${D.char}§r`)
    assert.equal(textWidth(`钻石${D}×2`), textWidth('钻石') + 7 + textWidth('×2', 1, false, true), '§f / §r 不占宽度；×2 按 Unifont 量（整行非 ASCII）')
    assert.throws(() => new GlyphSheet('4E', { kind: 'text' }), /A0–A4/, '不许顶替常用字的页')
    const p = new Paragraph(`合成需要 ${D}${D} 和 ${S}，`.repeat(4), 60)
    for (const line of p.lines) assert.ok(textWidth(line) <= 60, textWidth(line))
})

test('静态检查 glyph-line-overlap：emoji 页图标（16 高）在多行文字里；文字页图标不会', () => {
    const big = new GlyphSheet('E4').icon('sword', 'textures/items/diamond_sword')
    const small = new GlyphSheet('A2', { kind: 'text' }).icon('sword', 'textures/items/diamond_sword')
    const root = new Panel().add(new Label(`标题 ${big}`).setName('ok'), new Label(`第一行 ${big}\n第二行`).setName('bad'), new Label(`第一行 ${small}\n第二行`).setName('fine'))
    assert.deepEqual(compileNamespace('t', { root }).issues.filter((i) => i.rule !== 'text-overlap').map((i) => `${i.rule}@${i.path.split('/').pop()}`), ['glyph-line-overlap@bad'])
})

test('生成字形图：两种页都原样放 16×16；墨迹与代码不符时报出正确值并改正字距；PNG 解码支持调色板', () => {
    const sword = decodePng(fs.readFileSync(TEX('diamond_sword')))
    assert.deepEqual([sword.width, sword.height, inkOf(sword)], [16, 16, [0, 16]])
    const sheet = new GlyphSheet('A3', { kind: 'text' })
    sheet.icon('sword', 'textures/items/diamond_sword', { ink: [0, 16] })
    const d = sheet.icon('diamond', 'textures/items/diamond')             // 缺省 [0, 16]，实际 [2, 12]
    assert.equal(textWidth(d.char), 9)
    const files = { 'textures/items/diamond_sword': TEX('diamond_sword'), 'textures/items/diamond': TEX('diamond') }
    const { file, png, issues } = renderGlyphSheet(sheet, (p) => files[p])
    assert.equal(file, 'font/glyph_A3.png')
    assert.equal(issues.length, 1)
    assert.match(issues[0], /diamond.*\[2, 12\]/)
    assert.equal(textWidth(d.char), 7, '改正后：12 / 2 + 1')
    const out = decodePng(png)
    const cell1 = { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) cell1.data.set(out.data.subarray((y * 256 + 16 + x) * 4, (y * 256 + 16 + x) * 4 + 4), (y * 16 + x) * 4)
    assert.deepEqual(inkOf(cell1), [2, 12], '第 1 格是原样的钻石（16×16）')
})
