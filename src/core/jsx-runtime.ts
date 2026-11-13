/** JSX 运行时（tsconfig: "jsx": "react-jsx", "jsxImportSource": "cui"） */
import { Fragment, type CNode } from './node.js'

export { Fragment }
export function jsx(type: any, props: Record<string, any>, key?: string | number): CNode {
    return { type, props: key === undefined ? props : { ...props, key }, key }
}
export const jsxs = jsx
export const jsxDEV = jsx

export namespace JSX {
    export type Element = CNode
    export interface IntrinsicElements {
        panel: import('./node.js').PanelProps
        stack: import('./node.js').StackProps
        grid: import('./node.js').GridProps
        image: import('./node.js').ImageProps
        label: import('./node.js').LabelProps
        button: import('./node.js').ButtonProps
        collection_item: import('./node.js').CollectionItemProps
        raw: import('./node.js').IntrinsicProps['raw']
    }
}
