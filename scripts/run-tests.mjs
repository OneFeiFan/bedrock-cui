/**
 * 跑全部测试：自己列出 tests/*.test.mjs 再交给 node --test。
 * 不在 package.json 里写通配符——Windows 的 cmd 不展开 *，Node 20 也不展开（Node 21 起才支持）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => path.join(dir, f))
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })
process.exit(r.status ?? 1)
