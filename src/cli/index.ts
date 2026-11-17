/**
 * bedrock-cui 命令行：
 *   bedrock-cui create <名字>   创建一个基于 sapdon 的项目
 *   bedrock-cui dev [--port n] [--game [端口]]  在浏览器中预览全部界面；--game：与游戏联动（/connect 后保存即构建并重新加载）
 *   bedrock-cui build [--pack]  构建（交给 sapdon compile；--pack 再打成 .mcaddon）
 */
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { create, resolveSapdon } from './create.js'
import { dev } from './dev.js'

const HELP = `bedrock-cui <命令>

  create <名字>      创建一个基于 sapdon 的项目（含 bedrock-cui 的配置、示例界面与脚本）
  dev [--port 5173] [--game [19135]]  在浏览器中预览全部界面；--game 与游戏联动
  build [--pack]     构建附加包（sapdon compile）；--pack 同时打成 .mcaddon
`

function sapdon(args: string[]): number {
    const bin = path.join(resolveSapdon(), 'prod', 'cli', 'start.js')
    return spawnSync(process.execPath, [bin, ...args], { stdio: 'inherit' }).status ?? 1
}

export async function main(argv: string[]): Promise<void> {
    const [command, ...rest] = argv
    const flag = (name: string) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined }
    switch (command) {
        case 'create': {
            if (!rest[0]) throw new Error('用法：bedrock-cui create <名字>')
            const dir = create(rest[0])
            console.log(`\n已创建 ${dir}\n\n  cd ${path.relative(process.cwd(), dir) || '.'}\n  npm install\n  npm run dev      # 浏览器预览\n  npm run build    # 构建附加包（sapdon）\n`)
            return
        }
        case 'dev':
            return dev({ port: flag('--port') ? Number(flag('--port')) : undefined, game: rest.includes('--game') ? Number(flag('--game')) || 19135 : undefined })
        case 'build': {
            if (sapdon(['compile']) !== 0) process.exit(1)
            if (rest.includes('--pack') && sapdon(['pack']) !== 0) process.exit(1)
            return
        }
        default:
            console.log(HELP)
    }
}
