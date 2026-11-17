import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Label, Panel, Size, defineConfig } from '../dist/index.js'
import { Pages } from '../dist/internal.js'
import { CuiApp, useSapdon } from '../dist/node/index.js'
import { create } from '../dist/cli/create.js'

const book = () => {
    const pages = new Pages('b').startAt('p1').setSize(Size.full())
    pages.page('p1').add(pages.serverArrow('p1', 'p2', 'next', () => new Label('>'), 16, 12))
    pages.page('p2').add(new Label('2'))
    return new Panel().setSize(200, 120).add(pages, pages.stayButton())
}

test('create：用 sapdon 的项目模板建项目，加上 bedrock-cui 的配置、示例界面、入口、脚本与示例贴图；mod.info 含 BP / RP 的 UUID', () => {
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cui-create-')), 'my_ui')
    create(dir)
    for (const f of ['build.config', 'mod.info', 'cui.config.mjs', 'ui/book.screen.mjs', 'main.mjs', 'scripts/index.js', 'res/textures/cui_example/panel.png', 'res/textures/cui_example/panel.json'])
        assert.ok(fs.existsSync(path.join(dir, f)), f)
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    assert.equal(pkg.name, 'my_ui')
    assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['bedrock-cui', 'sapdon'])
    assert.equal(pkg.scripts.dev, 'bedrock-cui dev')
    const info = JSON.parse(fs.readFileSync(path.join(dir, 'mod.info'), 'utf8'))
    assert.match(info.bp, /^[0-9a-f-]{36}$/); assert.match(info.rp, /^[0-9a-f-]{36}$/)
    assert.match(fs.readFileSync(path.join(dir, 'main.mjs'), 'utf8'), /useSapdon\(config, \{ GRegistry, UISystemRegistry, addPacketResolver \}\)/)
    assert.throws(() => create(dir), /已存在/)
})

test('defineConfig + CuiApp.fromConfig + useSapdon(config, sapdon)：按配置编译、登记界面、把路由表写进配置的脚本目录', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-config-'))
    const config = defineConfig({ namespace: 'demo', screens: { 'cui_ui:demo': book }, scripts: 'src/scripts' })
    assert.deepEqual(Object.keys(CuiApp.fromConfig(config, root).compile().paging), ['cui_ui:demo'])
    const hooks = [], registered = []
    useSapdon(config, { GRegistry: { register: (name, r, p) => registered.push(`${r}:${p}${name}`), beforeSubmit: (h) => hooks.push(h) } }, root)
    hooks[0]([])
    assert.deepEqual(registered, ['resource:ui/demo', 'resource:ui/server_form', 'resource:ui/_ui_defs'], '没给 UISystemRegistry：自己登记 _ui_defs')
    assert.ok(fs.existsSync(path.join(root, 'src', 'scripts', 'cui.generated.js')))
})
