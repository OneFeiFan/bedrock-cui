import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

// 仓库中的文本文件：末尾恰好一个换行、行尾没有空白、不用 CRLF（否则 git am 应用补丁时报 whitespace 警告）
test('文本文件没有空白错误（文件末尾的空行、行尾空白、CRLF）', () => {
    let files
    try { files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean) } catch { return }   // 不在 git 仓库中（例如从 npm 安装）时跳过
    const text = /\.(md|mjs|js|ts|json|css|html|txt|yml|yaml|config)$|^\.gitignore$|(^|\/)LICENSE$/
    const bad = []
    for (const f of files.filter((f) => text.test(f) && fs.existsSync(f))) {
        const s = fs.readFileSync(f, 'utf8')
        if (s.includes('\r\n')) bad.push(`${f}：CRLF`)
        if (s.length && !s.endsWith('\n')) bad.push(`${f}：末尾没有换行`)
        if (/\n\n$/.test(s)) bad.push(`${f}：末尾多了空行`)
        const line = s.split('\n').findIndex((l) => /[ \t]+$/.test(l))
        if (line >= 0) bad.push(`${f}:${line + 1}：行尾空白`)
    }
    assert.deepEqual(bad, [])
})
