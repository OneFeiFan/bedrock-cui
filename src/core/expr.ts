/**
 * 绑定表达式：一份写法，两种用途——
 *  · 编译成 JSON UI 的绑定表达式字符串（`(not ((#form_text - $v0) = #form_text))`）；
 *  · 在浏览器预览里按 JSON UI 的语义直接求值。
 *
 * JSON UI 里一切动态效果（显示 / 隐藏、动态文字、按钮门控）都靠绑定表达式，手写极易出错
 * （漏声明 #form_text、字面量里带引号、`=` 与 `-` 的字符串语义……）。这里用带类型的构造器写，由编译器负责细节。
 */

import type { CollectionItem } from './element.js'

/** 数据来源：全局绑定（#form_text、#title_text）、集合项（form_buttons 的 #form_button_text）、某个控件的属性（开关的 #toggle_state） */
export type Source =
    | { kind: 'global' }
    | { kind: 'collection', collection: string, index?: number }    // index：界面的 prop 所对应的按钮（快照时自动包上读取它的容器）
    | { kind: 'control', control: string, siblingScope?: boolean }

export type Op = '+' | '-' | '*' | '/' | '%' | '=' | '>' | '<' | '>=' | '<=' | 'and' | 'or'

export type ExprNode =
    | { k: 'lit', v: string | number | boolean }
    | { k: 'ref', name: string, source: Source }
    | { k: 'var', name: string }
    | { k: 'bin', op: Op, a: ExprNode, b: ExprNode }
    | { k: 'not', a: ExprNode }

export type Value = string | number | boolean

export type ExprLike = Expr | Value

const node = (x: ExprLike): ExprNode => (x instanceof Expr ? x.node : { k: 'lit', v: x })

export class Expr {
    constructor(readonly node: ExprNode) { }

    private bin(op: Op, x: ExprLike): Expr { return new Expr({ k: 'bin', op, a: this.node, b: node(x) }) }
    /** 数字相加；字符串拼接 */
    plus(x: ExprLike): Expr { return this.bin('+', x) }
    /** 数字相减；字符串：去掉其中所有出现的 x（JSON UI 的字符串减法） */
    minus(x: ExprLike): Expr { return this.bin('-', x) }
    times(x: ExprLike): Expr { return this.bin('*', x) }
    div(x: ExprLike): Expr { return this.bin('/', x) }
    mod(x: ExprLike): Expr { return this.bin('%', x) }
    eq(x: ExprLike): Expr { return this.bin('=', x) }
    ne(x: ExprLike): Expr { return this.eq(x).not() }
    gt(x: ExprLike): Expr { return this.bin('>', x) }
    lt(x: ExprLike): Expr { return this.bin('<', x) }
    gte(x: ExprLike): Expr { return this.bin('>=', x) }
    lte(x: ExprLike): Expr { return this.bin('<=', x) }
    and(x: ExprLike): Expr { return this.bin('and', x) }
    or(x: ExprLike): Expr { return this.bin('or', x) }
    not(): Expr { return new Expr({ k: 'not', a: this.node }) }
    /** 是否包含子串：`not ((a - b) = a)`——门控常用 */
    contains(x: ExprLike): Expr { return this.minus(x).eq(this).not() }
    /** 是否为空字符串 */
    isEmpty(): Expr { return this.eq('') }
}

export const lit = (v: Value) => new Expr({ k: 'lit', v })
export const ref = (name: string, source: Source = { kind: 'global' }) => new Expr({ k: 'ref', name, source })
export const variable = (name: string) => new Expr({ k: 'var', name: name.startsWith('$') ? name : `$${name}` })
export const isExpr = (x: unknown): x is Expr => x instanceof Expr

// form.button(n) 返回的容器（CollectionItem）定义在 element.ts，而 element.ts 依赖本模块：由 element.ts 加载时注册工厂，避免循环依赖
let buttonItemFactory: ((index: number) => CollectionItem) | undefined
/** @internal 由 element.ts 注册 form.button() 的工厂 */
export function _registerFormButtonFactory(f: (index: number) => CollectionItem): void { buttonItemFactory = f }

/** 当前打开的服务端表单的内容：写进界面后编译为 JSON UI 的绑定，游戏显示界面时从当前表单取值 */
export const form = {
    /** 表单正文（ActionFormData 的 body()） */
    text: ref('#form_text'),
    /** 表单标题（ActionFormData 的 title()） */
    title: ref('#title_text'),
    /** 按钮的文字（ActionFormData 的 button() 的第一个参数）。只能在 form.button(n) 或 FormButton 内部使用 */
    buttonText: ref('#form_button_text', { kind: 'collection', collection: 'form_buttons' }),
    /**
     * 按钮的图标路径（ActionFormData 的 button() 的第二个参数）。只能在 form.button(n) 或 FormButton 内部使用。
     * 用作 Image 的贴图：new Image(form.buttonTexture)——游戏加载了的贴图都可以显示，包括其他附加包的
     */
    buttonTexture: ref('#form_button_texture', { kind: 'collection', collection: 'form_buttons' }),
    /**
     * 表单的第 index 个按钮（从 0 开始，对应脚本中第 index 个 button()）：返回一个容器，在它内部用 form.buttonText、form.buttonTexture 读取这个按钮的内容。
     * 容器本身不可点击；需要点击时用 FormButton
     */
    button(index: number): CollectionItem {
        if (!buttonItemFactory) throw new Error('form.button() 需要先加载 bedrock-cui 的控件模块')
        return buttonItemFactory(index)
    },
}

/**
 * 某个开关控件的状态（按控件名查找）。
 * 真机（测试包 1.0.1 探针矩阵）：缺省**全局查找**——从界面任何位置都读得到任何位置的开关；
 * siblingScope = 绑定加 resolve_sibling_scope: true，查找范围**收窄**到兄弟控件（从深处读别处的开关会读不到）。
 */
export const toggleState = (control: string, options: { siblingScope?: boolean } = {}) =>
    ref('#toggle_state', { kind: 'control', control, ...(options.siblingScope ? { siblingScope: true } : {}) })

// ───────────────────────────── 编译 ─────────────────────────────

export interface CompiledExpr {
    /** JSON UI 表达式字符串 */
    text: string
    /** 需要声明的全局绑定名（#form_text…） */
    globals: string[]
    /** 需要声明的集合绑定 */
    collections: { collection: string, name: string }[]
    /** 需要先从别的控件读进来的属性：读到局部属性 local 里 */
    controls: { control: string, property: string, local: string, siblingScope?: boolean }[]
    /** 字面量被提升成的变量（避免引号转义问题）：{ $v0: 'ITM:3;|' } */
    variables: Record<string, Value>
}

/**
 * 编译表达式。字符串字面量一律提升成变量（`$v0`）：JSON UI 表达式里的字符串字面量不能含单引号，
 * 提升后任意内容都安全（sapdon 的门控也是这样写的）。
 */
export function compileExpr(e: ExprLike, varPrefix = 'v'): CompiledExpr {
    const out: CompiledExpr = { text: '', globals: [], collections: [], controls: [], variables: {} }
    let vi = 0
    const visit = (n: ExprNode): string => {
        switch (n.k) {
            case 'lit':
                if (typeof n.v === 'string') {
                    const existing = Object.entries(out.variables).find(([, v]) => v === n.v)
                    if (existing) return existing[0]
                    const name = `$${varPrefix}${vi++}`
                    out.variables[name] = n.v
                    return name
                }
                return typeof n.v === 'boolean' ? (n.v ? 'true' : 'false') : String(n.v)
            case 'var': return n.name
            case 'ref': {
                const s = n.source
                if (s.kind === 'global') { if (!out.globals.includes(n.name)) out.globals.push(n.name); return n.name }
                if (s.kind === 'collection') {
                    if (!out.collections.some((c) => c.collection === s.collection && c.name === n.name)) out.collections.push({ collection: s.collection, name: n.name })
                    return n.name
                }
                const found = out.controls.find((c) => c.control === s.control && c.property === n.name && !!c.siblingScope === !!s.siblingScope)
                if (found) return found.local
                const local = `#cui_${s.control}_${n.name.replace(/^#/, '')}${s.siblingScope ? '_sib' : ''}`
                out.controls.push({ control: s.control, property: n.name, local, ...(s.siblingScope ? { siblingScope: true } : {}) })
                return local
            }
            case 'not': return `(not ${visit(n.a)})`
            case 'bin': return `(${visit(n.a)} ${n.op} ${visit(n.b)})`
        }
    }
    out.text = visit(node(e))
    return out
}

// ───────────────────────────── 求值（预览） ─────────────────────────────

export interface EvalEnv {
    /** 读数据来源（预览里来自信号：表单正文、按钮文字、开关状态） */
    ref(name: string, source: Source): Value
    /** 读变量 */
    variable?(name: string): Value | undefined
}

const truthy = (v: Value) => (typeof v === 'string' ? v !== '' && v !== 'false' : Boolean(v))

/** 按 JSON UI 语义求值：字符串 `-` 去掉所有出现，`+` 拼接；`=` 按值比较 */
export function evalExpr(e: ExprLike, env: EvalEnv): Value {
    const visit = (n: ExprNode): Value => {
        switch (n.k) {
            case 'lit': return n.v
            case 'var': return env.variable?.(n.name) ?? ''
            case 'ref': return env.ref(n.name, n.source)
            case 'not': return !truthy(visit(n.a))
            case 'bin': {
                const a = visit(n.a), b = visit(n.b)
                switch (n.op) {
                    case '+': return typeof a === 'number' && typeof b === 'number' ? a + b : `${a}${b}`
                    case '-':
                        if (typeof a === 'number' && typeof b === 'number') return a - b
                        return String(b) === '' ? String(a) : String(a).split(String(b)).join('')
                    case '*': return Number(a) * Number(b)
                    case '/': return Number(a) / Number(b)
                    case '%': return Number(a) % Number(b)
                    case '=': return typeof a === 'number' && typeof b === 'number' ? a === b : String(a) === String(b)
                    case '>': return Number(a) > Number(b)
                    case '<': return Number(a) < Number(b)
                    case '>=': return Number(a) >= Number(b)
                    case '<=': return Number(a) <= Number(b)
                    case 'and': return truthy(a) && truthy(b)
                    case 'or': return truthy(a) || truthy(b)
                }
            }
        }
    }
    return visit(node(e))
}

export const asBool = (v: Value) => truthy(v)

// ───────── 界面的 prop（defineScreen 的 props）─────────

/**
 * 界面的一个 prop：由行为包脚本在打开表单时提供的数据，通过第 index 个表单按钮传输（按钮文字 = 标记 + 文字，图标 = 按钮的图标）。
 * 本身是一个表达式（取文字）：new Label(props.greeting)。用在 Image 的贴图上时取图标，用在 setVisible() 上时表示「有值时显示」。
 * 读取按钮数据需要在对应的集合项内部：快照时自动给使用它的控件包上容器（使用者看不到序号、标记与容器）。
 */
export class PropRef extends Expr {
    constructor(readonly propName: string, readonly index: number, readonly tag: string) {
        super(ref('#form_button_text', { kind: 'collection', collection: 'form_buttons', index }).minus(tag).node)
    }
    /** prop 的图标（Image 的贴图） */
    get icon(): Expr { return ref('#form_button_texture', { kind: 'collection', collection: 'form_buttons', index: this.index }) }
    /** prop 是否有值（显示条件） */
    get present(): Expr { return ref('#form_button_text', { kind: 'collection', collection: 'form_buttons', index: this.index }).contains(this.tag) }
}

/** 表达式中引用的 prop 按钮序号（快照时据此包容器） */
export function propIndices(v: unknown, out = new Set<number>()): Set<number> {
    const walk = (n: unknown): void => {
        if (!n || typeof n !== 'object') return
        if (Array.isArray(n)) { n.forEach(walk); return }
        const o = n as Record<string, unknown>
        if (o.k === 'ref' && (o.source as { kind?: string, index?: number })?.kind === 'collection' && typeof (o.source as { index?: number }).index === 'number') out.add((o.source as { index: number }).index)
        for (const x of Object.values(o)) if (x && typeof x === 'object') walk(x)
    }
    walk(v instanceof Expr ? v.node : v)
    return out
}
