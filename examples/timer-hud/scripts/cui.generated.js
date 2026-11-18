// 由 bedrock-cui 生成，请勿手改（每次构建覆盖）
/** 界面 id → 翻页路由表（new ServerPagesForm(paging[界面 id])） @type {Record<string, import('bedrock-cui').ServerPaging>} */
export const paging = {}
/** defineScreen 定义的界面：界面 id → 清单（名字与按钮序号的对应） @type {Record<string, import('bedrock-cui').ScreenManifest & { paging?: import('bedrock-cui').ServerPaging }>} */
export const screens = {
  "cui_ui:timer_hud_demo": {
    "id": "cui_ui:timer_hud_demo",
    "data": [],
    "buttons": [
      {
        "index": 0,
        "tag": "@b0|",
        "focusTag": "@b0|F",
        "method": "__close",
        "args": []
      }
    ]
  }
}
// 登记清单：之后界面的 open() / close() 可用
import { registerScreens } from 'bedrock-cui/runtime/screens'
registerScreens(screens)
/** @type {Record<string, import('bedrock-cui').TimerHudManifest>} */
export const timerHuds = {
  "cooldowns": {
    "id": "cooldowns",
    "namespace": "cui_timer_demo_timers",
    "names": [
      "a",
      "b",
      "c"
    ],
    "steps": 100,
    "transport": "actionbar",
    "prefix": "cui.timers|v3|cui_timer_demo_timers|cooldowns|",
    "receiver": "cui_timers_cui_timer_demo_timers_cooldowns",
    "titlePolicy": "priority"
  }
}
import { registerTimerHuds } from 'bedrock-cui/runtime/timers'
registerTimerHuds(timerHuds)
