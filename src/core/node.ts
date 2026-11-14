/**
 * 公共类型与快照（RNode）。用户代码写的是 element.ts 里的类；编译与预览用 finalize() 得到的 RNode 快照。
 */
import type { Expr } from './expr.js'

/** 尺寸 / 偏移：像素数字，或 JSON UI 的尺寸表达式（'100%'、'100%c + 8px'、'default'、'fill'…） */
export type Size = number | string
export type Anchor = 'top_left' | 'top_middle' | 'top_right' | 'left_middle' | 'center' | 'right_middle' | 'bottom_left' | 'bottom_middle' | 'bottom_right'
/** 静态值，或绑定表达式（运行期由游戏计算） */
export type Dyn<T> = T | Expr
export type RGB = [number, number, number]

export type Intrinsic = 'panel' | 'stack' | 'grid' | 'image' | 'label' | 'button' | 'toggle' | 'collection_item' | 'raw' | 'scroll'

/** 快照节点：名字确定、只有内置控件 */
export interface RNode {
    type: Intrinsic
    name: string
    /** 从根开始的路径（a/b/c） */
    path: string
    props: Record<string, any>
    children: RNode[]
    /** 按钮 / 开关的状态子树（default、hover、pressed / unchecked、checked、unchecked_hover、checked_hover） */
    slots?: Record<string, RNode[]>
}

/** 深度优先遍历（含状态子树） */
export function walk(nodes: RNode[], fn: (n: RNode, parent: RNode | undefined) => void, parent?: RNode): void {
    for (const n of nodes) {
        fn(n, parent)
        if (n.slots) for (const s of Object.values(n.slots)) walk(s, fn, n)
        walk(n.children, fn, n)
    }
}
