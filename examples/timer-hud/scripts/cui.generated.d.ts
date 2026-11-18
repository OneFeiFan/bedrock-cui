// 由 bedrock-cui 生成，请勿手改
import type { ScreenManifest, ServerPaging, TimerHudManifest } from 'bedrock-cui'
/** 界面 id → 翻页路由表 */
export declare const paging: Record<string, ServerPaging>
/** defineScreen 定义的界面：界面 id → 清单 */
export declare const screens: Record<string, ScreenManifest & { paging?: ServerPaging }>
export declare const timerHuds: Record<string, TimerHudManifest>
