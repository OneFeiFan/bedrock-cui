// 比较运算实验（1.55.0）：比较运算（> < >= <=）在绑定中是否生效
// 1.46.0 真机：(p >= 0) and (p < 1000) 作为显示条件时一直为假；原版的表达式从未用过比较运算
// 1.55.0 真机：A–F、H、I 全部正确（单个比较可用）；只有 G「(5>=0) and (5<10)」错误——1.56.0 加 J–M 区分是 and 还是与 0 比较的问题
// 1.56.0 真机：J、K、L 正确，G、M 错误——两者都是 >= 作为 and 的一边。1.57.0：>= / <= 编译为 not < / not >，预期除 B、E 外全部显示
// 1.57.0 真机：除 B、E 外全部显示。1.61.0 加 N–Q：or 连接的「包含」与「不包含」（编译时 not 规范到表达式开头）
import { Anchor, Color, Image, Label, Panel, Size, Texture, defineScreen } from 'bedrock-cui'

const INK = Color.hex('#3c2814')

export default defineScreen({
    id: 'cui_ui:compare_lab',
    props: { n: { type: String, default: '5' }, s: { type: String, default: 'abc' } },     // 默认值即可

    view({ n: nText, s, button, close: closeIt }) {
        const n = nText.number
        // 每一行：说明（括号里是按数学应有的结果）＋ 条件成立时显示的绿色方块
        const rows = [
            ['A  5 > 3（显示）', n.gt(3)],
            ['B  5 > 7（不显示）', n.gt(7)],
            ['C  5 < 7（显示）', n.lt(7)],
            ['D  5 >= 5（显示）', n.gte(5)],
            ['E  5 <= 4（不显示）', n.lte(4)],
            ['F  5 = 5（显示）', n.eq(5)],
            ['G  (5>=0) and (5<10)（显示）', n.gte(0).and(n.lt(10))],
            ['H  not (5 > 7)（显示）', n.gt(7).not()],
            ['I  文字 abc = abc（显示）', s.eq('abc')],
            ['J  5 >= 0（显示）', n.gte(0)],
            ['K  (5>3) and (5<7)（显示）', n.gt(3).and(n.lt(7))],
            ['L  (5=5) and (5<7)（显示）', n.eq(5).and(n.lt(7))],
            ['M  (5>=0) and (5=5)（显示）', n.gte(0).and(n.eq(5))],
            // 1.61.0：or 连接的「包含」（1.60.0 暂停时「包含 I 或 P 或 D」为假）——现在编译为 not (… and …)
            ['N  含 a 或 含 z（显示）', s.contains('a').or(s.contains('z'))],
            ['O  含 z 或 含 b（显示）', s.contains('z').or(s.contains('b'))],
            ['P  不含 z（显示）', s.contains('z').not()],
            ['Q  含 a 且不含 z（显示）', s.contains('a').and(s.contains('z').not())],
        ]
        const box = new Panel().setSize(240, 22 + rows.length * 14)
        box.add(new Image('textures/ui/dialog_background_opaque').setSize(Size.full()))
        box.add(new Label('条件成立时显示绿色方块').setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(10, 6))
        rows.forEach(([text, cond], i) => {
            const y = 20 + i * 14
            box.add(new Label(text).setColor(INK).setAnchor(Anchor.TOP_LEFT).setOffset(10, y))
            box.add(new Image(Texture.SOLID).setColor(Color.hex('#3fa04a')).setSize(10, 10).setAnchor(Anchor.TOP_LEFT).setOffset(200, y - 1).setVisible(cond))
        })
        const close = button().onClick(closeIt).setSize(12, 12).setAnchor(Anchor.TOP_RIGHT).setOffset(-6, 6)
        close.default.add(new Label('§4x'))
        close.hover.add(new Label('§cx'))
        return box.add(close)
    },
})
