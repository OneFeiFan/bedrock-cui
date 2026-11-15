/**
 * 混合翻页（服务端翻页箭头 + 客户端目录开关）构建端与脚本端共用的约定。真机结论（测试包 1.4.0–1.26.0）：
 *   · 翻页箭头 = 两个**序号相同**的表单按钮：普通版（文字含 `go<序号>|` 就显示，默认聚焦优先级 10）与聚焦版（文字含 `go<序号>|F` 才显示，优先级 100）。
 *     服务端重开表单时给「刚才点击方向」的箭头加 F——鼠标没动时，点击交给默认聚焦的控件，就能连续翻页；
 *   · 「原地不动」透明按钮（优先级 50）：当前方向没有箭头时（例如最后一页再点「下一页」）接住鼠标没动的点击，服务端原样重开当前页；
 *   · 表单标题 = `<界面 id>|P:<页名>;`：静态界面按标题里的页码显示那一页；
 *   · 翻页过程中（关表单再开）不要往聊天栏发消息、不要重复设置输入权限——否则进入地图后第一次翻页界面会消失一阵子（真机 1.24.0–1.26.0）。
 */
export interface ServerArrowRoute {
    /** 表单按钮序号 */
    index: number
    /** 箭头所在的页 */
    from: string
    /** 点了翻到哪页 */
    to: string
    /** 方向：重开时给这个方向的箭头默认聚焦 */
    dir: 'prev' | 'next'
}

/** 翻页路由表：构建时由 Pages.serverPaging() 导出，脚本端 ServerPagesForm 读它 */
export interface ServerPaging {
    /** 界面 id（表单标题的前缀，例如 'cui_ui:my_book'） */
    title: string
    /** 标题里页码的前缀（缺省 'P:'） */
    prefix: string
    /** 初始页 */
    start: string
    arrows: ServerArrowRoute[]
    /** 「原地不动」按钮的序号（没有则省略） */
    stay?: number
}

/** 一个表单按钮：文字，或文字加图标路径（ActionFormData.button(文字, 图标路径)；界面里用 form.buttonTexture 读图标） */
export type FormButtonSpec = string | { text: string, icon?: string }
export const buttonTextOf = (b: FormButtonSpec | undefined): string => (b === undefined ? '' : typeof b === 'string' ? b : b.text)
export const buttonIconOf = (b: FormButtonSpec | undefined): string | undefined => (b !== undefined && typeof b !== 'string' ? b.icon : undefined)

/** 箭头按钮文字的标记：普通版 / 聚焦版 */
export const arrowTag = (index: number, focused = false) => `go${index}|${focused ? 'F' : ''}`
/** 「原地不动」按钮文字的标记 */
export const STAY_TAG = 'stay|'
/** 表单标题：<界面 id>|<前缀><页名>; */
export const pageTitle = (routes: Pick<ServerPaging, 'title' | 'prefix'>, page: string) => `${routes.title}|${routes.prefix}${page};`

/**
 * 某一页的全部表单按钮文字（脚本端 ServerPagesForm 与预览 ServerPagesPreview 共用——行为一致）：
 * 翻页箭头写 go<序号>|，刚才点击方向、且在这一页上的箭头加 F；「原地不动」写 stay|；其余取 own（界面自己的按钮），没有的写空。
 */
export function pagingButtons(paging: ServerPaging, page: string, dir: 'prev' | 'next', own: Record<number, FormButtonSpec> = {}): string[] {
    const last = Math.max(-1, ...Object.keys(own).map(Number), ...paging.arrows.map((a) => a.index), paging.stay ?? -1)
    const out: string[] = []
    for (let i = 0; i <= last; i++) {
        const arrow = paging.arrows.find((a) => a.index === i)
        out.push(arrow ? arrowTag(i, arrow.from === page && arrow.dir === dir) : i === paging.stay ? STAY_TAG : buttonTextOf(own[i]))
    }
    return out
}

/** 点了第 index 个按钮之后：翻页（到哪页、默认聚焦哪个方向）/ 原地不动（重开当前页）/ 界面自己的按钮 */
export function pagingResponse(paging: ServerPaging, index: number, page: string, dir: 'prev' | 'next'):
    { kind: 'turn', page: string, dir: 'prev' | 'next' } | { kind: 'stay', page: string, dir: 'prev' | 'next' } | { kind: 'own', index: number } {
    const arrow = paging.arrows.find((a) => a.index === index)
    if (arrow) return { kind: 'turn', page: arrow.to, dir: arrow.dir }
    if (index === paging.stay) return { kind: 'stay', page, dir }
    return { kind: 'own', index }
}
