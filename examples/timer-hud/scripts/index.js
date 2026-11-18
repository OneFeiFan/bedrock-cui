import './cui.generated.js'
import { system, world } from '@minecraft/server'
import { demo, timers } from '../ui/demo.mjs'

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const player = world.getAllPlayers().find((p) => p.id === event.sourceEntity?.id)
    if (!player) return
    if (event.id === 'cui_probe:overlay' || event.id === 'cui_probe:form' || event.id === 'cui_timers:demo') {
        system.runTimeout(() => demo.open(player), 20)
    } else if (event.id === 'cui_probe:stop' || event.id === 'cui_timers:stop') {
        demo.close(player)
        timers.close(player)
    } else if (event.id === 'cui_timers:title') {
        timers.showTitle(player, '任务完成', { policy: 'priority', fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 })
    } else if (event.id === 'cui_timers:notice') {
        timers.showTitle(player, 'Actionbar notification', { policy: 'actionbar' })
    } else if (event.id === 'cui_timers:clear') {
        timers.clearTitle(player)
    }
})
