import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Label, Pages, Panel, Size } from '../dist/index.js'
import { CuiApp, rewriteRuntimeImports } from '../dist/node/index.js'

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

test('rewriteRuntimeImports：bedrock-cui/runtime… 改写成行为包里运行时的相对路径（按脚本所在的层级）', () => {
    const code = "import { softWrap } from 'bedrock-cui/runtime'\nimport { ServerPagesForm } from \"bedrock-cui/runtime/server-pages\"\n"
    assert.equal(rewriteRuntimeImports(code, 'main.js'), "import { softWrap } from './cui/runtime/index.js'\nimport { ServerPagesForm } from \"./cui/runtime/serverPages.js\"\n")
    assert.match(rewriteRuntimeImports(code, 'ui/book.js'), /'\.\.\/cui\/runtime\/index\.js'/)
})

test('CuiApp.build（独立打包）：.mcaddon、生成的路由表、脚本里的运行时导入改写、类型检查（脚本写错就构建失败）', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-app-'))
    const script = (call) => "import { world } from '@minecraft/server'\nimport { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'\nimport { paging } from './cui.generated.js'\n" +
        `const book = new ServerPagesForm(paging['cui_ui:a'])\nworld.afterEvents.itemUse.subscribe((e) => book.${call}(e.source))\n`
    const app = new CuiApp('demo').screen('cui_ui:a', book())
    const file = await app.build({ out, title: '演示', scripts: { 'main.js': script('open') } })
    assert.ok(fs.existsSync(file))
    const bp = path.join(out, 'demo_BP', 'scripts')
    assert.match(fs.readFileSync(path.join(bp, 'main.js'), 'utf8'), /from '\.\/cui\/runtime\/serverPages\.js'/)
    assert.match(fs.readFileSync(path.join(bp, 'cui.generated.js'), 'utf8'), /"cui_ui:a"/)
    assert.ok(fs.existsSync(path.join(bp, 'cui', 'runtime', 'serverPages.js')))
    await assert.rejects(app.build({ out, scripts: { 'main.js': script('opne') } }), /类型检查失败[\s\S]*opne/)
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
