import { Image, Panel } from '../core/element.js'
import { compileExpr, Expr, type ExprNode } from '../core/expr.js'
import { Anchor, Color, Texture } from '../core/values.js'

// 在 source_control_name 的作用域内直接求值，不先导入局部别名。
function atSource(n: ExprNode): ExprNode {
    switch (n.k) {
        case 'ref': return { ...n, source: { kind: 'global' } }
        case 'bin': return { ...n, a: atSource(n.a), b: atSource(n.b) }
        case 'not': return { ...n, a: atSource(n.a) }
        default: return n
    }
}

/**
 * 实验性数值进度条（仅 bedrock-cui/internal）。
 *
 * value 必须只读取同一个控件的属性，结果由调用方保证为 0..max 的整数；本组件尚未自动钳制越界输入。
 * 例如 ref('#retained', { kind: 'control', control: 'receiver' }).minus('p|').times(1)。
 * 尺寸须为正整数像素；每次按当前值计算绝对宽度，没有动画时间线或增长量累积。
 * 单字段 HUD 探针 V7 验证原始 SIZE 结构，V9 用户真机反馈确认 SIZE 与 CUI 封装均正常。
 * 外层裁剪保留作兜底；输入超出 0..max 仍可产生超长尺寸，发送端须先限制范围。
 * 本组件只负责绘制，不提供实时传输、表单 props 更新或浏览器动态尺寸预览。
 */
export class LiveBar extends Panel {
    private fill = Color.hex('#3fa04a')
    private track: Color | undefined = Color.hex('#cfc3a3')
    private background?: Image
    private unit?: Panel
    private readonly source: { control: string, property: string }

    constructor(readonly value: Expr, readonly max: number) {
        super()
        if (!(value instanceof Expr)) throw new Error('LiveBar 需要来自同一个控件的数值表达式')
        if (!Number.isSafeInteger(max) || max <= 0) throw new Error('LiveBar 的 max 须是正整数')
        const c = compileExpr(value)
        const first = c.controls[0]
        if (!first || c.globals.length || c.collections.length || c.controls.some((s) => s.control !== first.control || s.siblingScope)) {
            throw new Error('LiveBar 只支持读取同一个控件的属性，不支持全局、集合或兄弟作用域')
        }
        this.source = first
        this.setClip(true)
    }

    setFill(color: Color): this { this.fill = color; return this }
    setTrack(color: Color | undefined): this { this.track = color; return this }

    protected override beforeFinalize(): void {
        const s = this.size?.toJSON()
        if (!s || !s.every((v) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0)) {
            throw new Error('LiveBar 需要正整数像素尺寸，例如 setSize(160, 8)')
        }
        const [W, H] = s as [number, number]
        // 先乘后除，避免 JSON UI 的整数除法提前截断进度；等宽时保留探针原式。
        const px = W === this.max ? this.value : this.value.times(W).div(this.max)
        const compiled = compileExpr(new Expr(atSource(px.node)), 'live')
        const binding = (text: string, target: string) => ({
            binding_type: 'view', source_control_name: this.source.control,
            source_property_name: text, target_property_name: target, binding_condition: 'always',
        })
        const image = (color: Color, w: number, h: number, layer: number) =>
            new Image(Texture.SOLID).setSize(w, h).setAnchor(Anchor.TOP_LEFT).setKeepRatio(false).setColor(color).setLayer(layer)
        const fill = image(this.fill, 1, 1, 1).setName('fill').setRaw('bindings', [
            binding(compiled.text, '#size_binding_x'),
            // 与 V7 保持一致：高度也通过同一个接收器求值，单位容器保持 1x1。
            binding(`((${this.source.property} = ${this.source.property}) * ${H})`, '#size_binding_y'),
        ])
        for (const [key, value] of Object.entries(compiled.variables)) fill.setRaw(key, value)
        if (this.background) this.remove(this.background)
        if (this.unit) this.remove(this.unit)
        this.background = this.track ? image(this.track, W, H, 0).setName('track') : undefined
        this.unit = new Panel().setName('unit').setSize(1, 1).setAnchor(Anchor.TOP_LEFT).add(fill)
        this.add(this.background, this.unit)
    }
}
