// 富文本（基岩版 § 格式码）与长文本：解析、测宽、预折行、分页
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Anchor, parseRich, richWidth, textWidth, wrapText, paginate, autoSpace, styleCodes, Paragraph, Panel, Label, compileNamespace, finalize, layout, findBox, NO_LINE_START, NO_LINE_END } from '../dist/index.js'

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

test('Paragraph hard 模式：CUI 排好每一行写进文字（显式换行）、宽度固定高度 default；排版高度 = 行数 × 10', () => {
    const p = new Paragraph('§a绿色的一段比较长的文字，用来测试段落。', 60).set({ name: 'p', anchor: 'top_left', wrap: 'hard' })
    assert.ok(p.lines.length > 1)
    assert.equal(p.props.text, p.lines.join('\n'))
    assert.deepEqual(p.props.size, [60, 'default'])
    const b = findBox(layout(finalize(new Panel().set({ size: [200, 100], anchor: 'top_left', children: [p] })), { viewport: [200, 100] }), 'p')
    assert.equal(b.rect.h, p.lines.length * 10)
    assert.deepEqual(b.lines, p.lines, '引擎不会再折（每行都在宽度内）')
})

test('Paragraph soft 模式（缺省）：文字不写换行、交给游戏；lines = 按当前字宽档案模拟的游戏折行；排版高度按模拟的行数', async () => {
    const { withMetricsProfile } = await import('../dist/index.js')
    const p = new Paragraph('§2背包里一共 11 种物品，其中钻石有 0 个，每 2 个钻石加 1 根木棍可以合成 1 把钻石剑。', 110).setName('p').setAnchor(Anchor.TOP_LEFT)
    assert.equal(p.wrap, 'soft')
    assert.ok(!p.props.text.includes('\n'), '不写换行')
    const tree = finalize(new Panel().setSize(200, 200).setAnchor(Anchor.TOP_LEFT).add(p))
    const box = () => findBox(layout(tree, { viewport: [200, 200] }), 'p')
    assert.equal(box().rect.h, p.lines.length * 10)
    const android = withMetricsProfile('android', () => box().rect.h)
    assert.ok(android >= box().rect.h, '安卓字宽更宽：行数不少于 PC')
    p.wrap = 'hard'
    assert.ok(p.props.text.includes('\n'))
})

test('软换行与游戏折行模拟（真机 1.28.0）：不换行空格判断宽度按 9、画 4——PC 与安卓的 C 段逐字一致；auto 择优后两个平台都没有标点或空格落在行首', async () => {
    const { measureText, withMetricsProfile, softWrapText } = await import('../dist/index.js')
    const show = (l) => l.replace(/§./g, '').replace(/\u00A0/g, '⍽')
    const C = '§2背包里一共 11 种物品，其中钻石有 0 个，每 2 个钻石加 1 根木棍可以合成 1 把钻石剑。'.replace(/ /g, '\u00A0')
    assert.deepEqual(measureText(C, 1, 110).lines.map(show), ['背包里一共⍽11⍽种物品，其中', '钻石有⍽0⍽个，每⍽2⍽个钻', '石加⍽1⍽根木棍可以合成⍽1', '⍽把钻石剑。'], 'PC 真机')
    assert.deepEqual(withMetricsProfile('android', () => measureText(C, 1, 110).lines.map(show)), ['背包里一共⍽11⍽种物品，', '其中钻石有⍽0⍽个，每⍽2', '⍽个钻石加⍽1⍽根木棍可', '以合成⍽1⍽把钻石剑。'], '安卓真机')
    const s = softWrapText('§2背包里一共 11 种物品，其中钻石有 0 个，每 2 个钻石加 1 根木棍可以合成 1 把钻石剑。', { width: 110 })
    for (const p of ['pc', 'android']) {
        const lines = withMetricsProfile(p, () => measureText(s, 1, 110).lines.map(show))
        for (const l of lines.slice(1)) assert.ok(!NO_LINE_START.includes(l[0]) && l[0] !== '⍽', `${p}：${JSON.stringify(lines)}`)
    }
})

test('静态检查：固定高度的文字框放不下', () => {
    const root = new Panel().set({ size: [200, 100], children: [
        new Label('很长的文字'.repeat(10)).set({ name: 'over', size: [40, 20] }),
        new Label('短').set({ name: 'ok', size: [40, 20] }),
    ] })
    assert.deepEqual(compileNamespace('t', { root }).issues.filter((i) => i.rule !== 'text-overlap').map((i) => `${i.rule}@${i.path.split('/').pop()}`), ['text-overflow@over'])
})

test('格式码与自动留空 / 行首空白：§9 的 9 不算英文；行首空白丢掉但格式码保留', () => {
    assert.equal(autoSpace('§9这是'), '§9这是')
    assert.equal(autoSpace('a§c中'), 'a§c 中')
    assert.equal(autoSpace('（例如Minecraft、Bedrock Edition、JSON UI）不'), '（例如 Minecraft、Bedrock Edition、JSON UI）不', '只在汉字与英文之间留空，全角标点前后都不加')
    assert.equal(autoSpace('点击；Esc关闭'), '点击；Esc 关闭', '全角标点后面不加，英文与汉字之间留空')
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

test('游戏折行（真机 1.20.1 / 1.23.0）：只在空格处换行；单词一整行放得下就整个移到下一行，放不下就从当前行剩下的地方逐字往下排', async () => {
    const { measureText } = await import('../dist/index.js')
    const cases = [
        ['§8页首有一张 1 层紫色小图抢先出现（1.22.0 的 G 没有它，被盖住）。', ['页首有一张 1', '层紫色小图抢先出现（1.22.0 的', 'G 没有它，被盖住）。']],
        ['§8青色贴图在 0 层第一次出现时，0 层的文字已经出现过了：青色这一批后画。', ['青色贴图在 0', '层第一次出现时，0 层的文字已', '经出现过了：青色这一批后画。']],
        ['§8上：emoji 字形 + 行距 6（line_padding），图标不压行。', ['上：emoji 字形 + 行距', '6（line_padding），图标不压行。']],
    ]
    for (const [text, game] of cases) assert.deepEqual(measureText(text, 1, 110).lines.map((l) => l.replace(/§./g, '')), game, text)
})

test('静态检查 engine-wrap-short-line：交给游戏折行的静态文字折出过短的行（游戏只在空格处换行，真机 1.23.0）；Paragraph、运行期文字、折得好的文字不报', async () => {
    const { compileNamespace, Label, Panel, Paragraph, Length, form } = { ...(await import('../dist/index.js')), ...(await import('../dist/internal.js')) }
    const text = '页首有一张 1 层紫色小图抢先出现（1.22.0 的 G 没有它，被盖住）。'
    const rule = (...items) => compileNamespace('t', { root: new Panel().setSize(200, 200).add(...items) }).issues
        .filter((i) => i.rule === 'engine-wrap-short-line').map((i) => i.path.split('/').pop())
    assert.deepEqual(rule(new Label(text).setName('game').setSize(110, Length.auto())), ['game'])
    assert.deepEqual(rule(new Paragraph(text, 110).setName('cui')), [], 'Paragraph 由 CUI 预折行')
    assert.deepEqual(rule(new Label(form.buttonText).setName('runtime').setSize(110, Length.auto())), [], '运行期文字没法预折行')
    assert.deepEqual(rule(new Label('没有空格的一整段中文会在任意字之间断开所以不会出现过短的行').setName('fine').setSize(110, Length.auto())), [])
})

test('autoSpace：只在汉字与英文 / 数字之间留空，全角标点前后都不加（「（1.22.0」「×1、diamond」「上：emoji」）', async () => {
    const { autoSpace } = await import('../dist/font/rich.js')
    assert.equal(autoSpace('抢先出现（1.22.0 的'), '抢先出现（1.22.0 的')
    assert.equal(autoSpace('按「Esc」关闭'), '按「Esc」关闭')
    assert.equal(autoSpace('《Bedrock》'), '《Bedrock》')
    assert.equal(autoSpace('钻石剑Minecraft'), '钻石剑 Minecraft')
    assert.equal(autoSpace('；Esc'), '；Esc')
    assert.equal(autoSpace('×1、diamond'), '×1、diamond')
    assert.equal(autoSpace('上：emoji'), '上：emoji')
})

test('预折行：每行用满宽度；行首不能放的标点放不下时把上一个字一起推到下一行（不再每行预留 8 像素）；每行都不超宽', async () => {
    const { wrapText, textWidth } = await import('../dist/index.js')
    const han = '一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑寅卯'
    const lines = wrapText(han, 105)
    assert.equal(lines[0], '一二三四五六七八九十甲乙', '12 个汉字 = 102 ≤ 105（先前目标宽 97，只放 11 个）')
    for (const l of lines) assert.ok(textWidth(l) <= 105, `${l}：${textWidth(l)}`)
    // 推出：宽度刚好放下十个字，第十一个是逗号 → 「十」带着逗号到下一行
    const w = textWidth('一二三四五六七八九十')
    const k = wrapText('一二三四五六七八九十，十一', w)
    assert.deepEqual(k, ['一二三四五六七八九', '十，十一'])
    for (const l of k) assert.ok(textWidth(l) <= w)
    // 允许悬挂（hang）时，标点挂在行尾
    assert.deepEqual(wrapText('一二三四五六七八九十，十一', w, { hang: 4 }), ['一二三四五六七八九十，', '十一'])
})

test('预折行：「×3」「diamond_sword」「1.22.0」这类连续的非汉字字符是一个单词，不拆开（先前「×3」被拆成「×」/「3」两行）', async () => {
    const { wrapText } = await import('../dist/index.js')
    const sample = '§8diamond_sword §0×1§8、§8diamond §0×3§8、§8stick §0×12§8、§8oak_planks §0×64'
    for (const w of [80, 90, 100, 110, 120]) {
        const lines = wrapText(sample, w).map((l) => l.replace(/§./g, ''))
        for (let i = 0; i + 1 < lines.length; i++) assert.ok(!(lines[i].endsWith('×') && /^\d/.test(lines[i + 1])), `宽 ${w}：${JSON.stringify(lines)}`)
    }
    assert.ok(wrapText('版本 1.22.0 的说明', 40).some((l) => l.includes('1.22.0')), '「1.22.0」不拆开')
})

test('安卓字宽档案（真机 1.28.0，小米 14）：汉字与全角标点 9、粗体每字加 1——「折行对比」页游戏折行的 8 行逐行一致', async () => {
    const { measureText, withMetricsProfile } = await import('../dist/index.js')
    const SAMPLE = '§2绿色开头的一段文字会跨过好几行，看看§c红色§2在引擎自动折行后会不会延续。英文 Minecraft Bedrock 不应被拆开，标点「引号」、句号。逗号，都要看位置。§l粗体也要延续到下一行吗？§r最后恢复普通。'
    assert.deepEqual(withMetricsProfile('android', () => measureText(SAMPLE, 1, 110).lines.map((l) => l.replace(/§./g, ''))),
        ['绿色开头的一段文字会跨过', '好几行，看看红色在引擎自', '动折行后会不会延续。英文', 'Minecraft Bedrock 不应被拆', '开，标点「引号」、句号。', '逗号，都要看位置。粗体', '也要延续到下一行吗？最后', '恢复普通。'])
})
