import { defineConfig } from 'bedrock-cui'
import { demo, timers } from './ui/demo.mjs'

export default defineConfig({ namespace: 'cui_timer_demo', screens: [demo], timerHuds: [timers], textures: ['res'] })
