import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { GlyphSheet, Paragraph, Texture, textWidth } from '../dist/index.js'
import { decodePng, inkOf, renderGlyphSheet } from '../dist/node/index.js'

const TEX = (n) => `preview-src/public/textures/${n}.png`

test('字形图标：字符从 U+E200 起；字距 = 墨迹宽 / 2 + 1；模板字符串里直接用；只许 E2–F8', () => {
    const sheet = new GlyphSheet('E3')
    const S = sheet.icon('sword', Texture.of('textures/items/diamond_sword'), [0, 16])
    const D = sheet.icon('diamond', 'textures/items/diamond', [2, 12])
    const K = sheet.icon('stick', 'textures/items/stick', [2, 13])
    assert.deepEqual([S.char, D.char, K.char].map((c) => c.codePointAt(0).toString(16)), ['e300', 'e301', 'e302'])
    assert.deepEqual([S.advance, D.advance, K.advance], [9, 7, 7.5])
    assert.equal(`${D}×2`, D.char + '×2')
    assert.equal(sheet.fileName, 'font/glyph_E3.png')
    // 一行里有图标：整行按 Unifont 的规则（非 ASCII），图标按登记的字距
    assert.equal(textWidth(`${S}${D}${K}`), 9 + 7 + 7.5)
    assert.equal(textWidth(`a${D}b`), textWidth('a钻b') - 8.5 + 7, 'a、b 按 Unifont 量（「钻」8.5；「中」是 6.5 的例外），图标 7')
    assert.throws(() => new GlyphSheet('E1'), /E2–F8/)
    assert.throws(() => sheet.icon('sword', 'x'), /重名/)
})

test('Paragraph：图标参与折行（按登记的字距）', () => {
    const sheet = new GlyphSheet('E4')
    const S = sheet.icon('sword', 'textures/items/diamond_sword', [0, 16])
    const p = new Paragraph(`${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}`, 50)
    // 每个 9，宽 50（预留 8 的悬挂）→ 一行最多放 4–5 个；10 个至少分 2 行，每行都不超过 50
    assert.ok(p.lines.length >= 2)
    for (const line of p.lines) assert.ok(textWidth(line) <= 50, `${line.length} 个：${textWidth(line)}`)
})

test('生成字形图：图标放进格子；墨迹与代码不符时报出正确值并改正字距；PNG 解码支持调色板（钻石剑 4 位调色板 + 透明表）', () => {
    const sword = decodePng(fs.readFileSync(TEX('diamond_sword')))
    assert.deepEqual([sword.width, sword.height, inkOf(sword)], [16, 16, [0, 16]])
    const sheet = new GlyphSheet('E5')
    sheet.icon('sword', 'textures/items/diamond_sword', [0, 16])
    const D = sheet.icon('diamond', 'textures/items/diamond')        // 缺省 [0, 16]，实际 [2, 12]
    assert.equal(textWidth(D.char), 9, '构建前按缺省（占满）')
    const files = { 'textures/items/diamond_sword': TEX('diamond_sword'), 'textures/items/diamond': TEX('diamond') }
    const { file, png, issues } = renderGlyphSheet(sheet, (p) => files[p])
    assert.equal(file, 'font/glyph_E5.png')
    assert.equal(issues.length, 1)
    assert.match(issues[0], /diamond.*\[2, 12\]/)
    assert.equal(textWidth(D.char), 7, '改正后：12 / 2 + 1')
    const out = decodePng(png)
    assert.deepEqual([out.width, out.height], [256, 256])
    // 第 1 格（x 16–31）放的是钻石：墨迹在格内的 2–13 列
    const cell1 = { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) cell1.data.set(out.data.subarray((y * 256 + 16 + x) * 4, (y * 256 + 16 + x) * 4 + 4), (y * 16 + x) * 4)
    assert.deepEqual(inkOf(cell1), [2, 12])
})
