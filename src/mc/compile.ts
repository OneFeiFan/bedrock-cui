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
import { resolve, type Child, type RNode } from '../core/node.js'
import { lint, type LintIssue, type LintOptions } from './lint.js'

type Json = Record<string, unknown>

/** 可写成表达式的属性 → 绑定的目标属性名；text / texture 还要把属性本身写成 '#…' */
const DYNAMIC: Record<string, { target: string, prop?: string }> = {
    visible: { target: '#visible' },
    text: { target: '#text', prop: 'text' },
    texture: { target: '#texture', prop: 'texture' },
    clipRatio: { target: '#clip_ratio', prop: 'clip_ratio' },
}

class Compiler {
    issues: LintIssue[] = []

    control(n: RNode, inCollection: string | undefined): Json {
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
        if (p.visible !== undefined && !isExpr(p.visible)) out.visible = p.visible
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
            for (const g of c.globals) if (!declaredGlobals.has(g)) { declaredGlobals.add(g); bindings.push({ binding_name: g }) }
            for (const col of c.collections) {
                if (!inCollection) this.issues.push({ rule: 'collection-ref-outside', level: 'error', path: n.path, message: `${col.name} 只能在 ${col.collection} 的集合项（FormButton）里使用` })
                const k2 = `${col.collection}|${col.name}`
                if (!declaredCollections.has(k2)) {
                    if (!declaredCollections.size) bindings.push({ binding_type: 'collection_details', binding_collection_name: col.collection })
                    declaredCollections.add(k2)
                    bindings.push({ binding_type: 'collection', binding_collection_name: col.collection, binding_name: col.name })
                }
            }
            for (const ctl of c.controls) {
                bindings.push({ binding_type: 'view', source_control_name: ctl.control, resolve_sibling_scope: true, source_property_name: ctl.property, target_property_name: ctl.local })
            }
            bindings.push({ binding_type: 'view', source_property_name: c.text, target_property_name: spec.target })
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
                if (p.uv) out.uv = p.uv
                if (p.uvSize) out.uv_size = p.uvSize
                if (p.color) out.color = p.color
                if (p.clipDirection) out.clip_direction = p.clipDirection
                if (p.clipRatio !== undefined && !isExpr(p.clipRatio)) out.clip_ratio = p.clipRatio
                if (p.anims) out.anims = p.anims
                break
            case 'label':
                out.type = 'label'
                if (!isExpr(p.text)) out.text = p.text
                if (p.color) out.color = p.color
                if (p.shadow !== undefined) out.shadow = p.shadow
                if (p.fontScale !== undefined) out.font_scale_factor = p.fontScale
                if (p.align) out.text_alignment = p.align
                if (p.localize !== undefined) out.localize = p.localize
                break
            case 'button': {
                key = `${n.name}@${p.template ?? 'common.button'}`
                vars.$pressed_button_name = p.pressedName ?? 'button.form_button_click'
                const state = (name: string, list: RNode[]) => ({ [name]: { type: 'panel', size: ['100%', '100%'], controls: list.map((c) => this.entry(c, inCollection)) } })
                out.controls = [state('default', n.slots!.default), state('hover', n.slots!.hover), state('pressed', n.slots!.pressed)]
                break
            }
            case 'collection_item':
                return this.collectionItem(n)
            case 'raw':
                Object.assign(out, p.json)
                break
        }
        if (bindings.length) out.bindings = bindings
        Object.assign(out, vars)
        if (p.raw) Object.assign(out, p.raw)
        const kids = n.children.map((c) => this.entry(c, inCollection))
        if (kids.length) out.controls = [...((out.controls as Json[]) ?? []), ...kids]
        return { [key]: out }
    }

    entry(n: RNode, inCollection: string | undefined): Json {
        return this.control(n, inCollection)
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
export function compileNamespace(namespace: string, roots: Record<string, Child>, options: LintOptions = {}): CompileResult {
    const c = new Compiler()
    const json: Json = { namespace }
    const all: RNode[] = []
    for (const [name, child] of Object.entries(roots)) {
        const nodes = resolve(child, name)
        if (nodes.length !== 1) throw new Error(`顶层元素 ${name} 必须正好是一个控件（现在是 ${nodes.length} 个）`)
        const n = { ...nodes[0], name, path: name }
        const entry = c.control(n, undefined)
        Object.assign(json, entry)
        all.push(n)
    }
    return { json, issues: [...lint(all, options), ...c.issues] }
}
