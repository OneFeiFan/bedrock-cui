import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Align, Anchor, Color, Column, Image, Insets, Justify, Label, Length, Panel, Row, Size, compileNamespace } from '../dist/index.js'
import { Html, Link, cssLength, formatCodesToHtml, renderHtml } from '../dist/dom/index.js'

test('cssLength：像素、百分比、加减（calc）、子控件之和（fit-content）、default 与 fill 不写', () => {
    assert.equal(cssLength(200), '200px')
    assert.equal(cssLength('100%'), '100%')
    assert.equal(cssLength('100% - 6px'), 'calc(100% - 6px)')
    assert.equal(cssLength('50% + 4px'), 'calc(50% + 4px)')
    assert.equal(cssLength('100%c'), 'fit-content')
    assert.equal(cssLength('default'), undefined)
    assert.equal(cssLength('fill'), undefined)
})

test('§ 格式码 → HTML：颜色、粗体、§r 复原；转义 HTML', () => {
    assert.equal(formatCodesToHtml('a§cb§lc§rd<'), 'a<span style="color:#FF5555">b</span><span style="color:#FF5555;font-weight:bold">c</span>d&lt;')
})

test('renderHtml：Row → flex（间距、分布、对齐、伸展）；Label 颜色与字号；Link、Html', () => {
    const row = new Row().setGap(4).setJustify(Justify.SPACE_BETWEEN).setAlign(Align.CENTER).setClassName('bar')
    row.add(new Label('§l标题').setColor(Color.WHITE).setFontScale(2), new Panel().setGrow(), new Link('guide/a.html', '快速上手'), new Html('<p>正文</p>'))
    const html = renderHtml(row)
    assert.match(html, /^<div class="bar" style="display:flex;flex-direction:row;gap:4px;justify-content:space-between;align-items:center">/)
    assert.match(html, /<span style="color:rgb\(255,255,255\);font-size:2em"><span style="font-weight:bold">标题<\/span><\/span>/)
    assert.match(html, /<div style="flex:1 1 0"><\/div>/)
    assert.match(html, /<a href="guide\/a\.html"><span>快速上手<\/span><\/a>/)
    assert.match(html, /<div><p>正文<\/p><\/div>/)
})

test('renderHtml：Panel 的子控件按锚点与偏移绝对定位；尺寸、内边距、图片', () => {
    const panel = new Panel().setSize(Length.pct(100).minus(6), 100).setPadding(Insets.of(1, 2, 3, 4))
    panel.add(new Label('x').setAnchor(Anchor.BOTTOM_RIGHT).setOffset(-4, -2), new Image('textures/ui/a').setSize(Size.full()).setKeepRatio(false))
    const html = renderHtml(panel, { assetUrl: (t) => `/assets/${t}.png` })
    assert.match(html, /width:calc\(100% - 6px\);height:100px;padding:2px 3px 4px 1px;box-sizing:border-box;position:relative/)
    assert.match(html, /position:absolute;left:calc\(100% \+ -4px\);top:calc\(100% \+ -2px\);transform:translate\(-100%, -100%\)/)
    assert.match(html, /<img src="\/assets\/textures\/ui\/a\.png" alt="" style="width:100%;height:100%;position:absolute;left:calc\(50% \+ 0px\);top:calc\(50% \+ 0px\);transform:translate\(-50%, -50%\);object-fit:fill">/)
})

test('网页专用的元素编译成 JSON UI 时报 web-only；className 不进 JSON UI', () => {
    const root = new Column().setClassName('nav').add(new Link('a.html', 'A'), new Label('b').setClassName('x'))
    const r = compileNamespace('t', { root })
    assert.deepEqual(r.issues.filter((i) => i.rule === 'web-only').length, 1)
    assert.doesNotMatch(JSON.stringify(r.json ?? r), /className|"nav"/)
})
