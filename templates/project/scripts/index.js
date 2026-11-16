// 行为包脚本：手持书右键打开界面
import { world } from '@minecraft/server'
import './cui.generated.js'                    // 构建生成：登记项目中的界面，之后 open() 可用
import book from '../ui/book.screen.mjs'

world.afterEvents.itemUse.subscribe((e) => {
    // 打开界面，并传入 props：第 1 页显示玩家的名字
    if (e.itemStack.typeId === 'minecraft:book') book.open(e.source, { reader: `你好，${e.source.name}` })
})
