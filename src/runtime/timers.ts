/** Minecraft 适配器：构建生成的 cui.generated.js 自动导入。 */
import { system, world, type Player } from '@minecraft/server'
import { _setTimerHudRuntime, type TimerHudManifest } from '../core/timerHud.js'
import { TimerHudRuntime } from './timerHudRuntime.js'

export { TimerHudRuntime, type TimerHudPlatform, type TimerHudPlayer } from './timerHudRuntime.js'
export const timerHudRuntime = new TimerHudRuntime<Player>({
    title(player, text, options) { player.onScreenDisplay.setTitle(text, options) },
    actionbar(player, text) { player.onScreenDisplay.setActionBar(text) },
    subtitle(player, text) { player.onScreenDisplay.updateSubtitle(text) },
    now: () => Date.now(),
    schedule(fn, ticks) { const id = system.runTimeout(fn, ticks); return () => system.clearRun(id) },
    error(message, error) { console.warn(`[bedrock-cui] ${message}: ${error}`) },
})
_setTimerHudRuntime(timerHudRuntime)
export function registerTimerHuds(manifests: Record<string, TimerHudManifest>): void { timerHudRuntime.register(manifests) }
world.afterEvents.playerLeave.subscribe((event) => timerHudRuntime.remove(event.playerId))
world.afterEvents.playerSpawn.subscribe((event) => timerHudRuntime.requestSnapshot(event.player))
