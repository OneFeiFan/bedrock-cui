import test from 'node:test'
import assert from 'node:assert/strict'
import { Anchor, Color, InlineIcon, Panel, Text, TextStyle, compileNamespace, finalize, findBox, layout, layoutInline, lineWidth, textWidth } from '../dist/index.js'

const D = InlineIcon.of('textures/items/diamond')
const K = InlineIcon.of('textures/items/stick')
const BIG = InlineIcon.of('textures/items/diamond_sword', 16)

test('行内排版：图标参与折行（宽 = 边长 + 1）；每行不超宽；逗号不在行首（避头）', () => {
    assert.deepEqual([D.advance, BIG.advance], [9, 17])
    const lines = layoutInline(`合成需要 ${D}${D}，下面放 ${K}，得到一把剑。附魔台旁放满书架能提高附魔等级。`, 60)
    assert.ok(lines.length >= 3)
    for (const l of lines) {
        const first = l[0]
        assert.ok(!('text' in first && /^(§.)*[，。]/.test(first.text)), '行首不是逗号句号')
        // 允许行末挂一个标点
        assert.ok(lineWidth(l) <= 60 + 4, `${lineWidth(l)}`)
    }
})

test('按段量宽度（与游戏一致）：图标隔开的纯英文段用 Minecraft 字体量，不是 Unifont', () => {
    const [line] = layoutInline(`钻石${D}abc`)
    assert.deepEqual(line.map((p) => ('text' in p ? p.text : 'icon')), ['钻石', 'icon', 'abc'])
    assert.equal(lineWidth(line), textWidth('钻石') + 9 + textWidth('abc', 1, false, false))
    assert.notEqual(textWidth('abc', 1, false, false), textWidth('abc', 1, false, true), '两种字体宽度确实不同')
})

test('编译：纯文字行合成一个文字控件；有图标的行 = 横向 stack_panel（文字段 + 8×8 图片）；样式码在段与段之间延续', () => {
    const t = new Text(`第一行纯文字\n§c红色${D}仍是红色`, 200, TextStyle.of(Color.hex('#45301c')))
    const { json, issues } = compileNamespace('t', { root: new Panel().add(t.setName('rt')) })
    assert.deepEqual(issues, [])
    const lines = json.root.controls[0].rt.controls[0].lines.controls
    assert.equal(lines.length, 2, '纯文字行 1 个文字控件 + 有图标的行 1 个 stack')
    assert.equal(Object.values(lines[0])[0].text, '第一行纯文字')
    const row = Object.values(lines[1])[0]
    assert.equal(row.type, 'stack_panel')
    assert.equal(row.orientation, 'horizontal')
    const cells = row.controls.map((c) => Object.values(c)[0].controls[0])
    const [seg1, icon, seg2] = cells.map((c) => Object.values(c)[0])
    assert.equal(seg1.text, '§c红色')
    assert.deepEqual([icon.type, icon.texture, icon.size], ['image', 'textures/items/diamond', [8, 8]])
    assert.equal(seg2.text, '§c仍是红色', '图标后面的段开头补上红色')
})

test('排版引擎：图标紧跟在文字后面；有 16 高图标的行加高到 16，文字下移 4（与图标居中）', () => {
    const t = new Text(`钻石${D}与${BIG}剑`).setName('rt')
    const b = layout(finalize(new Panel().setSize(300, 100).setAnchor(Anchor.TOP_LEFT).add(t)), { viewport: [300, 100] })
    const rt = findBox(b, 'rt')
    assert.equal(rt.rect.h, 16, '行高 16')
    const all = []
    const walk = (x) => { if (x.node.type === 'image' || x.node.type === 'label') all.push(x); x.children.forEach(walk) }
    walk(rt)
    const [l1, img, l2, big, l3] = all.sort((a, b2) => a.rect.x - b2.rect.x)
    assert.equal(img.rect.x - rt.rect.x, textWidth('钻石'), '小图标紧跟在「钻石」后面')
    assert.equal(img.rect.y - rt.rect.y, 4, '小图标与文字一起下移 4')
    assert.equal(big.rect.y - rt.rect.y, 0, '大图标占满 16')
    assert.equal(l1.rect.y - rt.rect.y, 4)
})

test('运行期文字：Label.setLineSpacing → line_padding；行距 ≥ 6 时 emoji 字形图标不算压行；行内图标写进普通 Label → 报错', async () => {
    const { GlyphSheet, Label } = await import('../dist/index.js')
    const big = new GlyphSheet('E6').icon('sword', 'textures/items/diamond_sword')
    const spaced = new Label(`第一行 ${big}\n第二行`).setName('spaced').setLineSpacing(6)
    const tight = new Label(`第一行 ${big}\n第二行`).setName('tight')
    const wrong = new Label(`钻石 ${D}`).setName('wrong')
    const { json, issues } = compileNamespace('t', { root: new Panel().add(spaced, tight, wrong) })
    assert.equal(json.root.controls[0].spaced.line_padding, 6)
    assert.deepEqual(issues.map((i) => `${i.rule}@${i.path.split('/').pop()}`).sort(), ['glyph-line-overlap@tight', 'inline-icon-in-label@wrong'])
    // 排版：两行、行距 6 → 高 = 2 × 10 + 6
    const b = layout(finalize(new Panel().setSize(200, 100).add(new Label('一\n二').setName('l').setLineSpacing(6))), { viewport: [200, 100] })
    assert.equal(findBox(b, 'l').rect.h, 26)
})

test('折行：新行开头不留空格（空格放不下时不带到下一行）', () => {
    // 「放」后面的空格放不下 → 下一行从图标开始
    const lines = layoutInline(`一二三四五六七八九十放 ${D}${D}，下面`, textWidth('一二三四五六七八九十放') + 1)
    assert.ok(lines.length >= 2)
    for (const l of lines.slice(1)) {
        const first = l[0]
        assert.ok(!('text' in first && /^(§.)*\s/.test(first.text)), `行首是空格：${JSON.stringify(first)}`)
    }
    assert.ok('icon' in lines[1][0], '第二行从图标开始')
})
