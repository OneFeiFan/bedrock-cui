import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Label, Pages, Panel, Size, form } from '../dist/index.js'
import { CuiApp } from '../dist/node/index.js'

/** 两页的小书：服务端翻页箭头 + 原地不动 */
function book() {
    const pages = new Pages('b').startAt('p1').setSize(Size.full())
    pages.page('p1').add(pages.serverArrow('p1', 'p2', 'next', () => new Label('>'), 16, 12))
    pages.page('p2').add(pages.serverArrow('p2', 'p1', 'prev', () => new Label('<'), 16, 12))
    return new Panel().setSize(200, 120).add(pages, pages.stayButton())
}

test('CuiApp.compile：每个界面的翻页路由自动导出；一个界面里两组带服务端翻页的 Pages 报错（按钮序号会冲突）', () => {
    const c = new CuiApp('demo').screen('cui_ui:a', book()).screen('cui_ui:plain', new Panel().setSize(10, 10)).compile()
    assert.deepEqual(Object.keys(c.paging), ['cui_ui:a'])
    assert.deepEqual(c.paging['cui_ui:a'].arrows.map((a) => [a.index, a.to]), [[10, 'p2'], [11, 'p1']])
    assert.ok(c.files['ui/demo.json'] && c.files['ui/server_form.json'] && c.files['ui/_ui_defs.json'])
    assert.throws(() => new CuiApp('x').screen('cui_ui:x', new Panel().add(book(), book())).compile(), /两组|2 组/)
})

test('CuiApp.useSapdon：提交前钩子里登记界面 JSON（_ui_defs 交给 UISystemRegistry 合并），路由表模块与类型声明写进脚本目录；与 sapdon 的服务端表单界面冲突时报错', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-sapdon-'))
    const hooks = [], registered = [], defs = []
    const sapdon = {
        GRegistry: { register: (name, root, p, data) => registered.push({ name, root, path: p, data }), beforeSubmit: (h) => hooks.push(h) },
        UISystemRegistry: { addOuterUIdefs: (d) => defs.push(...d) },
    }
    new CuiApp('demo').screen('cui_ui:a', book()).useSapdon(sapdon, { scriptsDir: path.join(dir, 'scripts') })
    assert.equal(hooks.length, 1, '登记了一个提交前钩子，此时还没登记文件')
    assert.equal(registered.length, 0)
    hooks[0]([])
    assert.deepEqual(registered.map((r) => [r.name, r.root, r.path]), [['demo', 'resource', 'ui/'], ['server_form', 'resource', 'ui/']])
    assert.deepEqual(defs, ['ui/demo.json', 'ui/server_form.json'])
    assert.match(fs.readFileSync(path.join(dir, 'scripts', 'cui.generated.js'), 'utf8'), /import\('bedrock-cui\/runtime\/server-pages'\)/)
    assert.match(fs.readFileSync(path.join(dir, 'scripts', 'cui.generated.d.ts'), 'utf8'), /export declare const paging: Record<string, ServerPaging>/)
    assert.throws(() => hooks[0]([{ name: 'server_form', root: 'resource', path: 'ui/' }]), /同时用了 sapdon 的服务端表单界面/)
})

test('form.buttonTexture：图片贴图绑定表单按钮的图标，照原版 server_form.json 编译（贴图与文件系统直接覆盖、空或加载中时隐藏）；集合项之外报错', async () => {
    const { CollectionItem, Image, Panel, compileNamespace, form, pagingButtons } = await import('../dist/index.js')
    const root = new Panel().setSize(100, 40).add(form.button(3).setSize(16, 16).add(new Image(form.buttonTexture).setName('icon').setSize(16, 16)))
    const r = compileNamespace('t', { root })
    const json = JSON.stringify(r.json ?? r)
    for (const s of ['"binding_name":"#form_button_texture","binding_name_override":"#texture"', '"binding_name":"#form_button_texture_file_system","binding_name_override":"#texture_file_system"', "(not ((#texture = '') or (#texture = 'loading')))"])
        assert.ok(json.includes(s), s)
    assert.deepEqual(r.issues.filter((i) => i.level === 'error'), [])
    const outside = compileNamespace('t', { root: new Panel().add(new Image(form.buttonTexture)) })
    assert.ok(outside.issues.some((i) => i.rule === 'collection-ref-outside'))
    // 带图标的按钮：{ text, icon }，按钮文字照常生成
    assert.deepEqual(pagingButtons({ title: 'x', prefix: 'P:', start: 'a', arrows: [] }, 'a', 'next', { 0: 'close|', 1: { text: 'ico|钻石', icon: 'textures/items/diamond' } }), ['close|', 'ico|钻石'])
})

test('form.button(n)：表单的第 n 个按钮——返回 form_buttons 集合第 n 项的容器，内部可读按钮的文字与图标；本身不可点击', async () => {
    const { CollectionItem, FormButton, Label, Panel, compileNamespace, form } = await import('../dist/index.js')
    const item = form.button(2)
    assert.ok(item instanceof CollectionItem)
    assert.ok(!(item instanceof FormButton), '不是可点击的 FormButton')
    assert.deepEqual([item.collection, item.index], ['form_buttons', 2])
    const r = compileNamespace('t', { root: new Panel().setSize(200, 40).add(item.setSize(160, 10).add(new Label(form.buttonText))) })
    assert.deepEqual(r.issues.filter((i) => i.level === 'error'), [])
    assert.notEqual(form.button(1), form.button(1), '每次调用返回新的容器')
})
