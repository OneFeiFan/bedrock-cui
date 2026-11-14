// 富文本（基岩版 § 格式码）与长文本：解析、测宽、预折行、分页
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRich, richWidth, textWidth, wrapText, paginate, autoSpace, styleCodes, Paragraph, Panel, Label, compileNamespace, finalize, layout, findBox, NO_LINE_START, NO_LINE_END } from '../dist/index.js'

const plain = (s) => s.replace(/§./g, '')

test('基岩版语义：换颜色不清掉粗体 / 斜体，§r 全部重置；§m §n 是颜色', () => {
    const { runs, end } = parseRich('§l粗§c红§o斜§r普§m铜')
    assert.deepEqual(runs.map((r) => [r.text, r.style.color ?? '-', r.style.bold, r.style.italic]),
        [['粗', '-', true, false], ['红', 'c', true, false], ['斜', 'c', true, true], ['普', '-', false, false], ['铜', 'm', false, false]])
    assert.equal(end.color, 'm')
    assert.equal(styleCodes({ color: 'c', bold: true, italic: false, obfuscated: false }), '§c§l')
})

test('测宽（真机字宽标尺校准）：纯 ASCII 用 Minecraft 字体；含非 ASCII 的整段用 Unifont（连英文一起）；粗体 +1 / +0.5', async () => {
    const { charWidth, usesUnifont } = await import('../dist/index.js')
    // 纯 ASCII：Minecraft 字体
    assert.deepEqual(['i', 'l', 't', 'f', 'a', 'W', '0', '@', ' '].map((c) => charWidth(c, false)), [2, 3, 4, 5, 6, 6, 6, 6, 4])
    assert.equal(textWidth('a a a a a a'), 56)
    assert.equal(textWidth('§lWWWWWWWWWW'), 70, '粗体 ASCII 每字 +1')
    // Unifont：字距 = 墨迹 / 2 + 1
    assert.equal(textWidth('中'.repeat(10)), 65, '「中」6.5（窄字）')
    assert.equal(charWidth('钻'), 8.5, '绝大多数汉字 8.5')
    assert.equal(textWidth('，'.repeat(10)), 20)
    assert.equal(textWidth('。'.repeat(10)), 30)
    assert.equal(textWidth('§l' + '中'.repeat(9)), 63, '粗体 Unifont 每字 +0.5')
    // 含汉字 ⇒ 整段 Unifont：E s c 的字距是 4（真机），不是 6
    assert.equal(usesUnifont('Esc 关闭'), true)
    assert.equal(usesUnifont('§cEsc'), false)
    assert.equal(textWidth('Esc 关闭；左键'), 4 * 3 + 4 + 8.5 + 7.5 + 2 + 8.5 + 8.5)
    assert.equal(textWidth('背包里有 1 个'), 53, '提示框第二行（真机逐字位置吻合）')
    assert.equal(textWidth('§lW§cW§rW'), 7 + 7 + 6, '换颜色不清粗体，§r 清')
    assert.equal(richWidth('§l中文'), 7 + 9)
})

test('预折行：避头尾、续行补样式码、不丢字；中英文留空跳过格式码', () => {
    const text = '§c这是一段很长的红色文字，里面有英文 Minecraft 单词，还有「引号」与句号。§l后面变成粗体并且继续很长很长。'
    for (const w of [50, 60, 72, 90]) {
        const lines = wrapText(text, w)
        assert.ok(lines.every((l) => plain(l) !== ''), `宽 ${w}：不应有空行 ${JSON.stringify(lines)}`)
        assert.ok(lines.every((l) => !NO_LINE_START.includes(plain(l)[0])), `宽 ${w}：行首有标点 ${JSON.stringify(lines)}`)
        assert.ok(lines.every((l) => !NO_LINE_END.includes(plain(l).at(-1))), `宽 ${w}：行尾有左括号`)
        assert.ok(lines.slice(1).every((l) => l.startsWith('§c')), `宽 ${w}：续行开头要补颜色码 ${JSON.stringify(lines)}`)
        assert.equal(lines.map(plain).join('').replace(/\s/g, ''), plain(text).replace(/\s/g, ''), '不丢字')
        assert.ok(lines.every((l) => textWidth(l) <= w), `宽 ${w}：每行不超过总宽（含挂在行尾的标点）`)
        assert.ok(!lines.some((l) => /Mine$/.test(plain(l))), '英文单词不拆')
    }
    const bold = wrapText('§l粗体会延续很长很长很长很长很长的一段', 40)
    assert.ok(bold.slice(1).every((l) => l.startsWith('§l')))
    assert.equal(autoSpace('中§cEnglish字'), '中 §cEnglish 字')
    assert.deepEqual(wrapText('第一段\n\n第三段', 100), ['第一段', '', '第三段'], '空行保留')
})

test('分页：按每页行数切块；首页可单独设高度；页首不留空行；续页开头补样式码', () => {
    const text = '§9' + '这是用来分页的长文本。'.repeat(30)
    const pages = paginate(text, 110, { height: 100, firstHeight: 60 })
    const counts = pages.map((p) => p.split('\n').length)
    assert.ok(counts[0] <= 6, '首页 60 像素 ≤ 6 行')
    assert.ok(counts.every((c) => c <= 10), '其余每页 100 像素 ≤ 10 行')
    assert.ok(pages.every((p) => p.startsWith('§9')))
    assert.equal(pages.map((p) => plain(p).replace(/\s/g, '')).join(''), plain(text).replace(/\s/g, ''))
})

test('Paragraph：预折行写进文字（显式换行）、宽度固定高度 default；排版高度 = 行数 × 10', () => {
    const p = new Paragraph({ name: 'p', text: '§a绿色的一段比较长的文字，用来测试段落。', width: 60, anchor: 'top_left' })
    assert.ok(p.lines.length > 1)
    assert.equal(p.props.text, p.lines.join('\n'))
    assert.deepEqual(p.props.size, [60, 'default'])
    const b = findBox(layout(finalize(new Panel({ size: [200, 100], anchor: 'top_left', children: [p] })), { viewport: [200, 100] }), 'p')
    assert.equal(b.rect.h, p.lines.length * 10)
    assert.deepEqual(b.lines, p.lines, '引擎不会再折（每行都在宽度内）')
})

test('静态检查：固定高度的文字框放不下', () => {
    const root = new Panel({ size: [200, 100], children: [
        new Label({ name: 'over', text: '很长的文字'.repeat(10), size: [40, 20] }),
        new Label({ name: 'ok', text: '短', size: [40, 20] }),
    ] })
    assert.deepEqual(compileNamespace('t', { root }).issues.filter((i) => i.rule !== 'text-overlap').map((i) => `${i.rule}@${i.path.split('/').pop()}`), ['text-overflow@over'])
})

test('格式码与自动留空 / 行首空白：§9 的 9 不算英文；行首空白丢掉但格式码保留', () => {
    assert.equal(autoSpace('§9这是'), '§9这是')
    assert.equal(autoSpace('a§c中'), 'a§c 中')
    assert.equal(autoSpace('（例如Minecraft、Bedrock Edition、JSON UI）不'), '（例如 Minecraft、 Bedrock Edition、 JSON UI）不', '英文后面接中文标点不留空；标点后面接英文留空')
    assert.equal(autoSpace('点击；Esc关闭'), '点击； Esc 关闭', '中文标点后面接英文留空（基岩版窄标点）')
    assert.deepEqual(wrapText('§9 你好', 100), ['§9你好'])
    assert.ok(paginate('§9' + '这是用来分页的长文本。'.repeat(30), 110, { height: 100 }).every((p) => p.startsWith('§9')))
})

test('分页孤行控制：标题不落在页底（挪到下一页和正文在一起）；页末不留空行', async () => {
    const { wrapDetailed } = await import('../dist/index.js')
    const text = ['§6第一章§r', '正文'.repeat(40), '', '§6第二章§r', '第二章的正文'.repeat(20)].join('\n')
    const { starts } = wrapDetailed(text, 110)
    assert.ok(starts.has(0))
    for (const h of [60, 80, 100, 120]) {
        const pages = paginate(text, 110, { height: h })
        for (const p of pages) {
            const ls = p.split('\n').map(plain)
            assert.notEqual(ls.at(-1), '第二章', `高 ${h}：标题落在页底 ${JSON.stringify(pages.map((x) => x.split('\n').map(plain)))}`)
            assert.notEqual(ls.at(-1), '', `高 ${h}：页末留了空行`)
        }
        assert.equal(pages.map((p) => plain(p).replace(/\s/g, '')).join(''), plain(text).replace(/\s/g, ''), '不丢字')
    }
})

test('游戏折行（真机 1.20.1）：单词与紧跟的开括号不断、开括号后不断、闭括号 / 句读前不断——「6（line_padding），」整体换行；汉字之间照常可断', async () => {
    const { measureText, textWidth } = await import('../dist/index.js')
    for (const [open, close] of [['（', '）'], ['(', ')']]) {
        const text = `上：emoji 字形 + 行距 6${open}line_padding${close}，图标不压行。`
        // 宽度恰好放得下「…行距 6（」——先前会在「（」后断开
        const w = textWidth(`上：emoji 字形 + 行距 6${open}`)
        const { lines } = measureText(text, 1, w)
        assert.equal(lines[0], '上：emoji 字形 + 行距', `${open}${close}`)
        assert.ok(lines[1].startsWith(`6${open}line_padding${close}，`), lines[1])
    }
    // 纯汉字照常逐字断；句号不在行首
    const { lines } = measureText('看图标是否参与折行有没有阴影。', 1, textWidth('看图标是否参与折行有没'))
    assert.equal(lines[0], '看图标是否参与折行有没')
    assert.ok(!lines[1].startsWith('。'))
})
