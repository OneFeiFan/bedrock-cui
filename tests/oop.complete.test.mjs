import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.resolve(import.meta.dirname, '..')

test('面向对象 API 完整：每个控件类的可写属性都有同名的 setXxx()，每个 setXxx() 都对应一个属性（用 TypeScript 编译器逐项核对）', () => {
    const files = ['element.ts', 'glyphs.ts'].map((f) => path.join(root, 'src/core', f))
        .concat(['text.ts', 'form.ts', 'pages.ts', 'richtext.ts'].map((f) => path.join(root, 'src/components', f)))
    const program = ts.createProgram(files, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true })
    const checker = program.getTypeChecker()
    const decl = {}
    for (const sf of program.getSourceFiles()) {
        if (!files.includes(path.resolve(sf.fileName))) continue
        ts.forEachChild(sf, (n) => { if (ts.isClassDeclaration(n) && n.name) decl[n.name.text] = n })
    }
    // 一次设置多项的便捷方法，不对应单个属性
    const COMBINED = new Set(['setAnchor', 'setPlacement', 'setUV', 'setStyle', 'setWidth', 'setHeight', 'setVariable', 'setRaw', 'setButtonBase', 'setBindingAlways'])
    const classes = ['Panel', 'Stack', 'Grid', 'Image', 'Label', 'Button', 'Toggle', 'CollectionItem', 'Raw', 'Row', 'Column', 'Scroll',
        'Paragraph', 'Text', 'FormButton', 'FormGate', 'Pages']
    const missing = []
    for (const cls of classes) {
        assert.ok(decl[cls], cls)
        const members = checker.getPropertiesOfType(checker.getTypeAtLocation(decl[cls])).filter((s) => {
            const d = s.valueDeclaration ?? s.declarations?.[0]
            return d && !(ts.getCombinedModifierFlags(d) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) && !s.name.startsWith('_')
        })
        const names = new Set(members.map((s) => s.name))
        // 可写属性：有 set 访问器
        const writable = members.filter((s) => s.declarations?.some((d) => ts.isSetAccessorDeclaration(d))).map((s) => s.name)
        for (const p of writable) {
            const setter = `set${p[0].toUpperCase()}${p.slice(1)}`
            if (!names.has(setter)) missing.push(`${cls}.${setter}()（属性 ${p}）`)
        }
        // setXxx() 方法都对应一个属性
        for (const m of members.filter((s) => /^set[A-Z]/.test(s.name) && s.flags & ts.SymbolFlags.Method).map((s) => s.name)) {
            if (COMBINED.has(m)) continue
            const p = m[3].toLowerCase() + m.slice(4)
            if (!names.has(p)) missing.push(`${cls}.${p}（方法 ${m}()）`)
        }
    }
    assert.deepEqual([...new Set(missing)], [], '缺的属性 / 方法')
})

test('属性赋值与 set({...})：有类型的值与早期写法的原始值都能转换；Paragraph 改选项会重新折行；FormButton 改 tag 同步显示条件；Pages 有页面后不能改组名', async () => {
    const { Anchor, Color, FormButton, Image, Label, Length, Pages, Panel, Paragraph, Size } = { ...(await import('../dist/index.js')), ...(await import('../dist/internal.js')) }
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
