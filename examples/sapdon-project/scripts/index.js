// 行为包脚本：手持书右键打开界面
import { world } from '@minecraft/server'
import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
import { paging } from './cui.generated.js'

const book = new ServerPagesForm(paging['cui_ui:book'])
    .setButtons(() => ({ 0: 'close|' }))

world.afterEvents.itemUse.subscribe((e) => {
    if (e.itemStack.typeId === 'minecraft:book') book.open(e.source)
})
