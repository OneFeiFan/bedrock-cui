import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { GlyphSheet, Label, Panel, Paragraph, Texture, compileNamespace, textWidth } from '../dist/index.js'
import { decodePng, downscaleIcon, inkOf, renderGlyphSheet } from '../dist/node/index.js'

const TEX = (n) => `preview-src/public/textures/${n}.png`

test('字形图标（真机 1.17.0）：字距 = 墨迹宽 + 1；小图标缺省 8×8（与文字同高），大图标 16×16；字符从 U+XX00 起；只许 E2–F8', () => {
    const sheet = new GlyphSheet('E3')
    const S = sheet.icon('sword', Texture.of('textures/items/diamond_sword'), { size: 'large', ink: [0, 16] })
    const D = sheet.icon('diamond', 'textures/items/diamond', { size: 'large', ink: [2, 12] })
    const K = sheet.icon('stick', 'textures/items/stick', { size: 'large', ink: [2, 13] })
    const d = sheet.icon('diamond_s', 'textures/items/diamond', { ink: [1, 6] })
    assert.deepEqual([S, D, K, d].map((g) => g.char.codePointAt(0).toString(16)), ['e300', 'e301', 'e302', 'e303'])
    // 真机 1.17.0 字宽标尺：钻石剑 / 书 17、钻石 13、木棍 14
    assert.deepEqual([S.advance, D.advance, K.advance], [17, 13, 14])
    assert.deepEqual([d.size, d.pixels, d.advance], ['small', 8, 7])
    assert.equal(`${D}×2`, D.char + '×2')
    assert.equal(textWidth(`${S}${S}${S}`), 51)
    assert.equal(textWidth(`${D}${D}${D}${D}`), 52)
    assert.equal(textWidth(`§l${S}${D}`), 17 + 13 + 0.5 * 2, '粗体每个 + 0.5（与 Unifont 同）')
    assert.throws(() => new GlyphSheet('E1'), /E2–F8/)
    assert.throws(() => sheet.icon('sword', 'x'), /重名/)
})

test('Paragraph：小图标参与折行（按登记的字距）；大图标在多行文字里 → 静态检查 glyph-line-overlap', () => {
    const sheet = new GlyphSheet('E4')
    const s = sheet.icon('sword', 'textures/items/diamond_sword', { ink: [0, 8] })
    const S = sheet.icon('sword_big', 'textures/items/diamond_sword', { size: 'large', ink: [0, 16] })
    const p = new Paragraph(`${s}`.repeat(10), 50)
    assert.ok(p.lines.length >= 2)
    for (const line of p.lines) assert.ok(textWidth(line) <= 50, `${line.length} 个：${textWidth(line)}`)
    const ok = new Label(`标题 ${S}`)
    const bad = new Label(`第一行 ${S}\n第二行`)
    const issues = compileNamespace('t', { root: new Panel().add(ok.setName('ok'), bad.setName('bad')) }).issues
    assert.deepEqual(issues.map((i) => `${i.rule}@${i.path.split('/').pop()}`), ['glyph-line-overlap@bad'])
})

test('生成字形图：小图标缩成 8×8 放在格子第 4–11 行，大图标 16×16；墨迹与代码不符时报出正确值并改正字距；PNG 解码支持调色板', () => {
    const sword = decodePng(fs.readFileSync(TEX('diamond_sword')))
    assert.deepEqual([sword.width, sword.height, inkOf(sword)], [16, 16, [0, 16]])
    assert.deepEqual(inkOf({ width: 8, height: 8, data: downscaleIcon(sword.data) }), [0, 8])
    const sheet = new GlyphSheet('E5')
    sheet.icon('sword', 'textures/items/diamond_sword', { size: 'large', ink: [0, 16] })
    const d = sheet.icon('diamond', 'textures/items/diamond')                 // 小图标，缺省 [0, 8]，实际 [1, 6]
    assert.equal(textWidth(d.char), 9, '构建前按缺省（占满 8）')
    const files = { 'textures/items/diamond_sword': TEX('diamond_sword'), 'textures/items/diamond': TEX('diamond') }
    const { file, png, issues } = renderGlyphSheet(sheet, (p) => files[p])
    assert.equal(file, 'font/glyph_E5.png')
    assert.equal(issues.length, 1)
    assert.match(issues[0], /diamond（small）.*\[1, 6\]/)
    assert.equal(textWidth(d.char), 7, '改正后：6 + 1')
    const out = decodePng(png)
    // 第 1 格（x 16–31）：小图标只占第 4–11 行
    const rows = []
    for (let y = 0; y < 16; y++) { let any = false; for (let x = 16; x < 32; x++) any ||= out.data[(y * 256 + x) * 4 + 3] > 0; if (any) rows.push(y) }
    assert.ok(rows[0] >= 4 && rows.at(-1) <= 11, `小图标的像素都在第 4–11 行（实际 ${rows[0]}–${rows.at(-1)}）`)
})
