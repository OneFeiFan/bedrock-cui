import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.resolve(import.meta.dirname, '..')

test('面向对象 API 完整：每个参数对象字段都有同名的属性读写与 setXxx()（用 TypeScript 编译器逐项核对）', () => {
    const files = ['element.ts', 'glyphs.ts'].map((f) => path.join(root, 'src/core', f))
        .concat(['text.ts', 'form.ts', 'pages.ts', 'richtext.ts'].map((f) => path.join(root, 'src/components', f)))
    const program = ts.createProgram(files, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true })
    const checker = program.getTypeChecker()
    const decl = {}
    for (const sf of program.getSourceFiles()) {
        if (!files.includes(path.resolve(sf.fileName))) continue
        ts.forEachChild(sf, (n) => { if ((ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n)) && n.name) decl[n.name.text] = n })
    }
    const pairs = [['Panel', 'LayoutOptions'], ['Stack', 'StackOptions'], ['Grid', 'GridOptions'], ['Image', 'ImageOptions'], ['Label', 'LabelOptions'],
        ['Button', 'ButtonOptions'], ['Toggle', 'ToggleOptions'], ['CollectionItem', 'CollectionItemOptions'], ['Raw', 'RawOptions'],
        ['Paragraph', 'ParagraphOptions'], ['FormButton', 'FormButtonOptions'], ['FormGate', 'FormGateOptions'], ['Pages', 'PagesOptions'], ['Text', 'TextOptions']]
    const missing = []
    for (const [cls, iface] of pairs) {
        assert.ok(decl[cls] && decl[iface], `${cls} / ${iface}`)
        const has = new Set()
        for (const s of checker.getPropertiesOfType(checker.getTypeAtLocation(decl[cls]))) {
            const flags = ts.getCombinedModifierFlags(s.valueDeclaration ?? s.declarations?.[0])
            if (!(flags & ts.ModifierFlags.Private)) has.add(s.name)
        }
        for (const m of checker.getPropertiesOfType(checker.getTypeAtLocation(decl[iface])).map((s) => s.name)) {
            if (['children', 'name', 'raw'].includes(m)) continue
            const setter = `set${m[0].toUpperCase()}${m.slice(1)}`
            if (!has.has(m)) missing.push(`${cls}.${m}`)
            if (!has.has(setter)) missing.push(`${cls}.${setter}()`)
        }
    }
    assert.deepEqual(missing, [], '缺的属性 / 方法')
})

test('属性赋值与 set({...})：有类型的值与早期写法的原始值都能转换；Paragraph 改选项会重新折行；FormButton 改 tag 同步显示条件；Pages 有页面后不能改组名', async () => {
    const { Anchor, Color, FormButton, Image, Label, Length, Pages, Panel, Paragraph, Size } = await import('../dist/index.js')
    // 属性赋值 = setXxx()
    const a = new Image('textures/ui/x'); a.color = Color.WHITE; a.keepRatio = false; a.nineslice = 4; a.anchorFrom = Anchor.TOP_RIGHT; a.anchorTo = Anchor.TOP_LEFT
    const b = new Image('textures/ui/x').setColor(Color.WHITE).setKeepRatio(false).setNineslice(4).setPlacement(Anchor.TOP_RIGHT, Anchor.TOP_LEFT)
    assert.deepEqual(a.props, b.props)
    // set({...})：有类型的值、原始值（数组 / 字符串）都转换成同样的结果
    const c = new Label('字').set({ size: Size.of(110, Length.auto()), color: Color.hex('#ffffff'), anchor: Anchor.TOP_LEFT, layer: 2, shadow: true })
    const d = new Label('字').set({ size: [110, 'default'], color: [1, 1, 1], anchor: 'top_left', layer: 2, shadow: true })
    assert.deepEqual(c.props, d.props)
    assert.ok(c.color instanceof Color && c.size instanceof Size, '读出来是有类型的值')
    // Paragraph：改折行选项、文字、宽度都会重新折行
    const p = new Paragraph('钻石剑Minecraft', 200)
    assert.equal(p.lines[0], '钻石剑 Minecraft')
    p.autoSpace = false
    assert.equal(p.lines[0], '钻石剑Minecraft')
    p.set({ text: '一二三四五六七八九十', width: 40 })
    assert.ok(p.lines.length > 1 && p.props.size[0] === 40)
    assert.throws(() => { p.text = 123 }, /只接受字符串/)
    // FormButton：改 tag，按钮的显示条件跟着变
    const fb = new FormButton(3, 'a|', 10, 10)
    fb.tag = 'b|'
    assert.match(JSON.stringify(fb.button.visible), /b\|/)
    // Pages：已有页面后不能改组名
    const pages = new Pages('g'); pages.page('home')
    assert.throws(() => { pages.group = 'h' }, /创建页面之前/)
    assert.equal(new Pages('g').setGroup('h').group, 'h')
    assert.equal(pages.setStart('home').start, 'home')
    void Panel
})
