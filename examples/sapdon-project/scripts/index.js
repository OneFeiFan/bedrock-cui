import { world } from '@minecraft/server'
import { ServerPagesForm } from 'bedrock-cui/runtime/server-pages'
import { softWrap } from 'bedrock-cui/runtime'
import { paging } from './cui.generated.js'

const book = new ServerPagesForm(paging['cui_ui:demo']).setButtons(() => ({ 0: softWrap('关闭 close', 50) }))
world.afterEvents.itemUse.subscribe((e) => { if (e.itemStack.typeId === 'minecraft:book') book.open(e.source) })
