/**
 * CUI 脚本端运行时：在行为包脚本里用（没有 Node / 浏览器依赖，约 90 KB，大部分是 Unifont 字宽表）。
 *
 * 服务端运行期生成的文字（按玩家背包拼的说明、聊天记录……），在发给界面之前按与 Paragraph **同一套规则与字宽**预折行——
 * 游戏只在空格处换行，中英混排会折出很短的行（真机 1.23.0）；预折好的行每行都放得下，游戏不会再折。
 *
 *   import { softWrap } from './cui/runtime/index.js'         // 构建时用 cui/node 的 copyRuntime() 复制进行为包
 *   form.button('txw|' + softWrap(text, 110))                  // 110 = 显示它的文字控件的宽度（像素）
 *
 * softWrap（推荐）：交给游戏折行，只调整汉字与英文 / 数字交界处的间隔，游戏用当前平台的真实字宽逐字排满——PC 与安卓都对（真机 1.28.0）。
 * preWrap：按 PC 字宽排好每一行——只在 PC 上精确（安卓汉字 9、全角标点 9，会超宽、被再折一次）。
 *
 * 游戏自己提供的文字（玩家名、原版物品名这些直接绑定的内容）脚本拿不到，没法预折行：尽量单行显示或留足宽度。
 */
import { softWrapText, wrapText, type SoftWrapOptions, type WrapOptions } from '../font/rich.js'

export { autoSpace, softWrapText, wrapText, type SoftWrapOptions, type WrapOptions } from '../font/rich.js'
export { measureText, setMetricsProfile, textWidth, withMetricsProfile, type MetricsProfile } from '../font/metrics.js'

/** 最近的结果（翻页时背包没变，文字一样：直接取，不再模拟） */
const CACHE = new Map<string, string>()

/**
 * 软换行（推荐）：返回交给游戏折行的文字。width = 显示它的文字控件的宽度（像素）；字号不是 1 时传 { scale }。
 * 缺省用 'fast' 择优（QuickJS 上一段通常几毫秒到十几毫秒）；同样的文字与宽度直接取缓存
 */
export function softWrap(text: string, width: number, options: Omit<SoftWrapOptions, 'width'> = {}): string {
    const key = `${width}|${options.scale ?? 1}|${options.effort ?? 'fast'}|${text}`
    const hit = CACHE.get(key)
    if (hit !== undefined) return hit
    const out = softWrapText(text, { effort: 'fast', ...options, width })
    if (CACHE.size >= 64) CACHE.delete(CACHE.keys().next().value!)
    CACHE.set(key, out)
    return out
}

/** 预折行（只在 PC 上精确）：返回用 \n 连接的行（行首补上延续的样式码）。width = 显示它的文字控件的宽度（像素）；字号不是 1 时传 { scale } */
export function preWrap(text: string, width: number, options: WrapOptions = {}): string {
    return wrapText(text, width, options).join('\n')
}
