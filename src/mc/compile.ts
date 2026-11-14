/**
 * 编译器：展开后的控件树 → 基岩版 JSON UI 命名空间文件。
 *
 * - 名字确定（同样输入同样输出），可做快照测试；
 * - 动态属性（visible / text / texture / clipRatio 写成 Expr）自动展开成绑定：
 *     声明全局绑定（#form_text）、集合绑定（#form_button_text）、从控件读属性（#toggle_state），
 *     字符串字面量提升成变量，最后一条 view 绑定写到目标属性；text / texture 写成 '#text' / '#texture'；
 * - 按钮继承 common.button（$pressed_button_name 缺省 button.form_button_click），三种状态各是一个子面板；
 * - 集合项（FormButton）编译成 sapdon 真机验证过的写法：正方形 grid + grid_position + 内层负偏移 + 集合绑定。
 */
import { compileExpr, isExpr, type Expr } from '../core/expr.js'
import { finalize, type Element } from '../core/element.js'
import type { RNode } from '../core/node.js'
import { lint, lintLayout, type LintIssue, type LintOptions } from './lint.js'
import { SCROLLBAR } from '../layout/engine.js'

type Json = Record<string, unknown>

/**
 * 静态文字的保护（真机 1.4.0「特殊字符」页）：
 *   · 以 # 开头会被当成绑定属性，整行不显示；以 $ 开头会被当成变量（找不到时原样显示，但日志报
 *     「Expected variable not found」——真机 1.5.0）⇒ 开头补一个不占宽度的 §r
 *   · % 会被当成格式占位符：「100%」显示成「100」、「%s」显示成「s」，只有「%%」显示成一个 % ⇒ 每个 % 写成 %%
 * 运行期文字（表单正文、按钮文字）由脚本发送，要在脚本里自己把 % 写成 %%。
 */
export function escapeText(text: unknown, localize = false): unknown {
    if (typeof text !== 'string' || localize) return text
    const t = text.replace(/%/g, '%%')
    return /^[#$]/.test(t) ? `§r${t}` : t
}

/**
 * 绑定的计算时机：一律 always。@bedrock-core/ui 的编译器对服务端表单里的集合 / 视图绑定也这样做（注释：工厂创建控件之后，
 * 集合与视图数据才可能到达）——我们的界面同样由 server_form 的工厂创建；真机 1.5.2 / 1.5.3 的「不重算」很可能与此有关。
 */
const ALWAYS = 'always'

/** 标记：外层集合项的上下文被开关遮住了 */
const THROUGH_TOGGLE = '\u0000toggle:'

/** 可写成表达式的属性 → 绑定的目标属性名；text / texture 还要把属性本身写成 '#…' */
const DYNAMIC: Record<string, { target: string, prop?: string }> = {
    visible: { target: '#visible' },
    enabled: { target: '#enabled' },
    stateFrom: { target: '#toggle_state' },
    text: { target: '#text', prop: 'text' },
    texture: { target: '#texture', prop: 'texture' },
    clipRatio: { target: '#clip_ratio', prop: 'clip_ratio' },
}

class Compiler {
    issues: LintIssue[] = []
    /** 提升到命名空间顶层的元素（Scroll 的内容） */
    readonly hoisted: Json = {}
    private scrolls = 0
    /** 当前根是否给绑定加 binding_condition: always（路由界面加；静态界面保持 1.5.4 的输出） */
    always = true
    constructor(private readonly namespace = '') { }
    /** 当前元素要求 always（setBindingAlways） */
    private forceAlways = false
    private cond(): { binding_condition?: string } { return this.always || this.forceAlways ? { binding_condition: ALWAYS } : {} }

    control(n: RNode, inCollection: string | undefined): Json {
        const saved = this.forceAlways
        this.forceAlways = Boolean(n.props.bindingAlways)
        try { return this.controlInner(n, inCollection) } finally { this.forceAlways = saved }
    }

    private controlInner(n: RNode, inCollection: string | undefined): Json {
        const p = n.props
        // type 放在最前面，生成的 JSON 好读
        const TYPE: Record<string, string> = { panel: 'panel', stack: 'stack_panel', grid: 'grid', image: 'image', label: 'label' }
        const out: Json = TYPE[n.type] ? { type: TYPE[n.type] } : {}
        const bindings: Json[] = []
        const vars: Json = {}
        // 布局
        if (p.size) out.size = p.size
        if (p.offset) out.offset = p.offset
        const from = p.anchorFrom ?? p.anchor, to = p.anchorTo ?? p.anchor
        if (from) out.anchor_from = from
        if (to) out.anchor_to = to
        if (p.layer !== undefined) out.layer = p.layer
        if (p.alpha !== undefined) out.alpha = p.alpha
        if (p.clip) out.clips_children = true
        if (p.gridPos) out.grid_position = p.gridPos
        // 最小 / 最大尺寸：百分比尺寸在大屏 / 小屏上的上下限（响应式）
        if (p.minSize) out.min_size = p.minSize
        if (p.maxSize) out.max_size = p.maxSize
        if (p.visible !== undefined && !isExpr(p.visible)) out.visible = p.visible
        if (p.enabled !== undefined && !isExpr(p.enabled)) out.enabled = p.enabled
        for (const [k, v] of Object.entries(p.variables ?? {})) vars[k.startsWith('$') ? k : `$${k}`] = v

        // 动态属性 → 绑定
        let dynIndex = 0
        const declaredGlobals = new Set<string>()
        const declaredCollections = new Set<string>()
        for (const [key, spec] of Object.entries(DYNAMIC)) {
            const v = p[key]
            if (!isExpr(v)) continue
            const c = compileExpr(v as Expr, `${key[0]}${dynIndex++}_`)
            Object.assign(vars, c.variables)
            if (c.globals.length && c.controls.length) {
                this.issues.push({ rule: 'mixed-sources', level: 'warning', path: n.path, message: `${key} 的表达式同时读全局绑定（${c.globals.join('、')}）与开关状态：真机里开关变化不会触发重新计算（1.5.2）。把全局条件放进一个 stateFrom 开关，再按开关名读` })
            }
            for (const g of c.globals) if (!declaredGlobals.has(g)) { declaredGlobals.add(g); bindings.push({ binding_name: g, ...this.cond() }) }
            for (const col of c.collections) {
                if (inCollection?.startsWith(THROUGH_TOGGLE)) this.issues.push({ rule: 'collection-through-toggle', level: 'error', path: n.path, message: `开关里读不到外层集合项的 ${col.name}（真机：common.toggle 自带空集合名的 collection_details 绑定）。把 CollectionItem 放进开关的状态面板里` })
                else if (!inCollection) this.issues.push({ rule: 'collection-ref-outside', level: 'error', path: n.path, message: `${col.name} 只能在 ${col.collection} 的集合项（FormButton）里使用` })
                const k2 = `${col.collection}|${col.name}`
                if (!declaredCollections.has(k2)) {
                    if (!declaredCollections.size) bindings.push({ binding_type: 'collection_details', binding_collection_name: col.collection })
                    declaredCollections.add(k2)
                    bindings.push({ binding_type: 'collection', binding_collection_name: col.collection, binding_name: col.name, ...this.cond() })
                }
            }
            // 跨区域读开关状态：不写 resolve_sibling_scope（原版主界面标签页的写法；只有兄弟控件才写 true）
            for (const ctl of c.controls) {
                bindings.push({ binding_type: 'view', source_control_name: ctl.control, ...(ctl.siblingScope ? { resolve_sibling_scope: true } : {}), source_property_name: ctl.property, target_property_name: ctl.local, ...this.cond() })
            }
            bindings.push({ binding_type: 'view', source_property_name: c.text, target_property_name: spec.target, ...this.cond() })
            if (spec.prop) out[spec.prop] = spec.target
        }

        // 各类型
        let key = n.name
        switch (n.type) {
            case 'panel': out.type = 'panel'; break
            case 'stack': out.type = 'stack_panel'; out.orientation = p.orientation ?? 'vertical'; break
            case 'grid': out.type = 'grid'; out.grid_dimensions = p.dims; break
            case 'image':
                out.type = 'image'
                if (!isExpr(p.texture)) out.texture = p.texture
                if (p.keepRatio !== undefined) out.keep_ratio = p.keepRatio
                if (p.nineslice !== undefined) out.nineslice_size = p.nineslice
                if (p.baseSize !== undefined) out.base_size = p.baseSize
                if (p.uv) out.uv = p.uv
                if (p.uvSize) out.uv_size = p.uvSize
                if (p.color) out.color = p.color
                if (p.clipDirection) out.clip_direction = p.clipDirection
                if (p.clipRatio !== undefined && !isExpr(p.clipRatio)) out.clip_ratio = p.clipRatio
                if (p.anims) out.anims = p.anims
                break
            case 'label':
                out.type = 'label'
                if (!isExpr(p.text)) out.text = escapeText(p.text, p.localize)
                if (p.color) out.color = p.color
                if (p.shadow !== undefined) out.shadow = p.shadow
                if (p.fontScale !== undefined) out.font_scale_factor = p.fontScale
                if (p.align) out.text_alignment = p.align
                if (p.localize !== undefined) out.localize = p.localize
                break
            case 'button': {
                key = `${n.name}@${p.template ?? 'common.button'}`
                vars.$pressed_button_name = p.pressedName ?? 'button.form_button_click'
                if (p.focusPrecedence !== undefined) out.default_focus_precedence = p.focusPrecedence
                const s = n.slots!
                // 悬停 / 按下态没写内容时沿用默认态：游戏里悬停只画 hover 控件，空的话内容会消失
                out.controls = [this.state('default', s.default, inCollection), this.state('hover', s.hover.length ? s.hover : s.default, inCollection), this.state('pressed', s.pressed.length ? s.pressed : s.hover.length ? s.hover : s.default, inCollection)]
                break
            }
            case 'toggle': {
                // 开关内部：外层集合项的上下文被 common.toggle 的绑定遮住（真机）；里面再放 CollectionItem 才能读
                if (inCollection && !inCollection.startsWith(THROUGH_TOGGLE)) inCollection = THROUGH_TOGGLE + inCollection
                // 继承原版 common.toggle（自带点击映射与音效）；单选组 = toggle_name + radio_toggle_group + toggle_group_forced_index
                key = `${n.name}@common.toggle`
                vars.$toggle_name = p.group
                vars.$radio_toggle_group = p.radio ?? true
                vars.$toggle_group_forced_index = p.index
                // 服务端分页的开关不写死初始选中序号：继承路由设在祖先上的变量（原版用 |default 声明）
                if (!p.inheritDefaultSelected) vars.$toggle_group_default_selected = p.defaultSelected ?? 0
                vars.$toggle_default_state = p.defaultState ?? false
                // 纯界面开关：不从全局绑定读初始状态（原版 light_template_toggle 同样设为 none）
                vars.$toggle_binding_type = 'none'
                if (p.focusPrecedence !== undefined) out.default_focus_precedence = p.focusPrecedence
                const s = n.slots!
                const hoverOf = (base: 'unchecked' | 'checked') => (s[`${base}_hover`].length ? s[`${base}_hover`] : s[base])
                out.controls = [
                    this.state('unchecked', s.unchecked, inCollection), this.state('checked', s.checked, inCollection),
                    this.state('unchecked_hover', hoverOf('unchecked'), inCollection), this.state('checked_hover', hoverOf('checked'), inCollection),
                    // 禁用（locked）态：缺省沿用普通态；lockedVisible: false 则什么都不画
                    this.state('unchecked_locked', p.lockedVisible === false ? [] : s.unchecked, inCollection), this.state('checked_locked', p.lockedVisible === false ? [] : s.checked, inCollection),
                    this.state('unchecked_locked_hover', p.lockedVisible === false ? [] : s.unchecked, inCollection), this.state('checked_locked_hover', p.lockedVisible === false ? [] : s.checked, inCollection),
                ]
                break
            }
            case 'scroll': {
                // 原版 common.scrolling_panel：内容提升为顶层元素，用 $scrolling_content 引用
                key = `${n.name}@common.scrolling_panel`
                const content = `${n.name}_scroll_content_${this.scrolls++}`
                // 内容宽 = 区域宽 − 8：原版的滚动条盖在内容上面（真机 1.10.0：文字被滚动条挡住），要给它让位
                this.hoisted[content] = { type: 'panel', size: [`100% - ${SCROLLBAR}px`, '100%c'], anchor_from: 'top_left', anchor_to: 'top_left', controls: n.children.map((c) => this.entry(c, undefined)) }
                vars.$scrolling_content = `${this.namespace}.${content}`
                vars.$show_background = false
                vars.$scroll_bar_contained = true
                vars.$scroll_bar_contained_touch = true
                if (inCollection) this.issues.push({ rule: 'scroll-in-collection', level: 'warning', path: n.path, message: 'Scroll 的内容提升为顶层元素，读不到外层集合项的数据；集合项请放在 Scroll 里面' })
                break
            }
            case 'collection_item':
                return this.collectionItem(n)
            case 'raw':
                if (p.template) key = `${n.name}@${p.template}`
                Object.assign(out, p.json)
                break
        }
        if (bindings.length) out.bindings = bindings
        Object.assign(out, vars)
        if (p.raw) Object.assign(out, p.raw)
        const kids = n.type === 'scroll' ? [] : n.children.map((c) => this.entry(c, inCollection))
        if (kids.length) out.controls = [...((out.controls as Json[]) ?? []), ...kids]
        return { [key]: out }
    }

    entry(n: RNode, inCollection: string | undefined): Json {
        return this.control(n, inCollection)
    }

    /** 状态面板 */
    state(name: string, list: RNode[], inCollection?: string): Json {
        return { [name]: { type: 'panel', size: ['100%', '100%'], controls: list.map((c) => this.entry(c, inCollection)) } }
    }

    /**
     * 集合项 → 外层面板（占位、定位）＋ 正方形 grid（collection_name；边长 = max(宽, 高)，居中）
     *   ＋ grid_item（grid_position [0, index]）＋ 内层面板（尺寸 = 集合项尺寸，offset ['0%', -index×100%] 抵消格位）。
     * 这是 sapdon FormButtonGrid 在真机上验证过的写法（按钮按放置顺序 / 格位绑定到 form_buttons 第 index 项）。
     */
    collectionItem(n: RNode): Json {
        const p = n.props
        const [w, h] = (p.size ?? ['100%', '100%']) as [number | string, number | string]
        const side = typeof w === 'number' && typeof h === 'number' ? Math.max(w, h) : '100%'
        const outer: Json = { type: 'panel', size: [w, h] }
        const from = p.anchorFrom ?? p.anchor, to = p.anchorTo ?? p.anchor
        if (p.offset) outer.offset = p.offset
        if (from) outer.anchor_from = from
        if (to) outer.anchor_to = to
        if (p.layer !== undefined) outer.layer = p.layer
        const inner: Json = {
            type: 'panel', size: [w, h], offset: ['0%', `${-p.index * 100}%`],
            bindings: [{ binding_type: 'collection_details', binding_collection_name: p.collection }],
            controls: n.children.map((c) => this.entry(c, p.collection)),
        }
        outer.controls = [{
            grid: {
                type: 'grid', collection_name: p.collection, grid_dimensions: [1, 1], size: [side, side], anchor_from: 'center', anchor_to: 'center',
                controls: [{ [`grid_item_${String(p.index).padStart(3, '0')}`]: { type: 'panel', grid_position: [0, p.index], controls: [{ cell: inner }] } }],
            },
        }]
        return { [n.name]: outer }
    }
}

export interface CompileResult {
    /** 命名空间文件内容 */
    json: Json
    issues: LintIssue[]
}

/**
 * 编译一个命名空间：`roots` 的每个键是一个顶层元素（可被 `@命名空间.键` 引用）。
 */
export function compileNamespace(namespace: string, roots: Record<string, Element>, options: LintOptions = {}): CompileResult {
    const c = new Compiler(namespace)
    const json: Json = { namespace }
    const all: RNode[] = []
    for (const [name, el] of Object.entries(roots)) {
        c.always = options.alwaysRoots ? options.alwaysRoots.includes(name) : true
        const saved = el.name
        el.name = name
        const [n] = finalize(el)
        el.name = saved
        Object.assign(json, c.control(n, undefined))
        all.push(n)
    }
    Object.assign(json, c.hoisted)
    return { json, issues: [...lint(all, options), ...lintLayout(all, options), ...c.issues] }
}
