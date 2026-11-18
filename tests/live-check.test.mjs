import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkScripts } from '../dist/node/index.js'

test('checkScripts：精简数值运行时不要求字体模块，仍能检查帧发送器调用参数', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cui-live-check-'))
    try {
        for (const rel of ['core/liveFrame.js', 'core/timer.js', 'runtime/liveFrame.js']) {
            const target = path.join(dir, 'scripts/cui', rel)
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.copyFileSync(new URL('../dist/' + rel, import.meta.url), target)
        }
        const entry = path.join(dir, 'scripts/index.js')
        const code = `import { LiveFrameCodec } from './cui/core/liveFrame.js'
import { LiveFrameSender } from './cui/runtime/liveFrame.js'
const sender = new LiveFrameSender(new LiveFrameCodec({ pixels: { max: 160 } }), { pixels: 0 }, () => {})
sender.update({ pixels: 40 })
sender.flush(2)
`
        fs.writeFileSync(entry, code)
        assert.deepEqual(await checkScripts(dir), [])
        fs.writeFileSync(entry, code + `sender.update({ pixels: 'wrong' })\n`)
        const errors = await checkScripts(dir)
        assert.ok(errors.some((e) => /string.*number/.test(e)), errors.join('\n'))
    } finally {
        assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()))
        assert.ok(path.basename(dir).startsWith('cui-live-check-'))
        fs.rmSync(dir, { recursive: true, force: true })
    }
})
