import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GameLink } from '../dist/cli/game.js'

test('GameLink：游戏（WebSocket 客户端）连接后收到命令请求；客户端发来的消息（带掩码）能解析；断开后不再计入', async () => {
    const link = new GameLink(19735)
    const status = [], messages = []
    link.onStatus = (t) => status.push(t)
    link.onMessage = (m) => messages.push(m)
    await link.start()
    try {
        const ws = new WebSocket('ws://localhost:19735')
        const received = new Promise((resolve) => ws.addEventListener('message', (e) => resolve(JSON.parse(e.data))))
        await new Promise((resolve) => ws.addEventListener('open', resolve))
        await new Promise((r) => setTimeout(r, 50))
        assert.ok(link.connected)
        assert.equal(link.command('reload all'), 1)
        const msg = await received
        assert.equal(msg.header.messagePurpose, 'commandRequest')
        assert.equal(msg.body.commandLine, 'reload all')
        ws.send(JSON.stringify({ body: { statusCode: 0, statusMessage: '已重新加载' }, header: { messagePurpose: 'commandResponse' } }))
        await new Promise((r) => setTimeout(r, 100))
        assert.equal(messages[0].body.statusMessage, '已重新加载', '客户端的帧带掩码，解开后得到原文')
        ws.send('x'.repeat(300))                                 // 126 以上的长度（16 位长度字段）
        ws.close()
        await new Promise((r) => setTimeout(r, 150))
        assert.ok(!link.connected)
        assert.deepEqual(status, ['游戏已连接', '游戏已断开'])
    } finally { await link.close() }
})
