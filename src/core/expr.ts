/**
 * 绑定表达式：一份写法，两种用途——
 *  · 编译成 JSON UI 的绑定表达式字符串（`(not ((#form_text - $v0) = #form_text))`）；
 *  · 在浏览器预览里按 JSON UI 的语义直接求值。
 *
 * JSON UI 里一切动态效果（显示 / 隐藏、动态文字、按钮门控）都靠绑定表达式，手写极易出错
 * （漏声明 #form_text、字面量里带引号、`=` 与 `-` 的字符串语义……）。这里用带类型的构造器写，由编译器负责细节。
 */

/** 数据来源：全局绑定（#form_text、#title_text）、集合项（form_buttons 的 #form_button_text）、某个控件的属性（开关的 #toggle_state） */
export type Source =
    | { kind: 'global' }
    | { kind: 'collection', collection: string }
    | { kind: 'control', control: string }

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

/** 服务端表单的数据 */
export const form = {
    /** 表单正文（ActionFormData.body） */
    text: ref('#form_text'),
    /** 表单标题 */
    title: ref('#title_text'),
    /** 当前表单按钮的文字（只能在 FormButton 内部使用） */
    buttonText: ref('#form_button_text', { kind: 'collection', collection: 'form_buttons' }),
}

/** 某个开关控件的状态 */
export const toggleState = (control: string) => ref('#toggle_state', { kind: 'control', control })

// ───────────────────────────── 编译 ─────────────────────────────

export interface CompiledExpr {
    /** JSON UI 表达式字符串 */
    text: string
    /** 需要声明的全局绑定名（#form_text…） */
    globals: string[]
    /** 需要声明的集合绑定 */
    collections: { collection: string, name: string }[]
    /** 需要先从别的控件读进来的属性：读到局部属性 local 里 */
    controls: { control: string, property: string, local: string }[]
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
                const found = out.controls.find((c) => c.control === s.control && c.property === n.name)
                if (found) return found.local
                const local = `#cui_${s.control}_${n.name.replace(/^#/, '')}`
                out.controls.push({ control: s.control, property: n.name, local })
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
