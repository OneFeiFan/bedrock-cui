import { Panel, Raw } from '../core/element.js'
import { Color } from '../core/values.js'
import { TimerHudRef } from '../core/timerHud.js'
import { eventTimerBarParts } from '../mc/eventTimer.js'

/** 计时 HUD 的事件驱动进度条；运行期间由原版客户端推进剩余段。 */
export class EventProgressBar extends Panel {
    private _fill = Color.fromJSON([0.12, 0.9, 0.62])
    private _track = Color.fromJSON([0.18, 0.23, 0.29])
    private _direction: 'progress' | 'remaining' = 'progress'
    private background?: Raw
    private motion?: Raw

    constructor(readonly value: TimerHudRef) {
        super()
        if (!(value instanceof TimerHudRef)) throw new Error('EventProgressBar 需要 defineTimerHud 的计时器引用')
        this.props.timerHudOwner = value.manifest.prefix
        this.setSize(160, 8)
    }
    get fill(): Color { return this._fill }
    set fill(value: Color) { if (!(value instanceof Color)) throw new Error('fill 必须是 Color'); this._fill = value }
    setFill(value: Color): this { this.fill = value; return this }
    get track(): Color { return this._track }
    set track(value: Color) { if (!(value instanceof Color)) throw new Error('track 必须是 Color'); this._track = value }
    setTrack(value: Color): this { this.track = value; return this }
    get direction(): 'progress' | 'remaining' { return this._direction }
    set direction(value: 'progress' | 'remaining') { if (value !== 'progress' && value !== 'remaining') throw new Error('未知的进度方向'); this._direction = value }
    setDirection(value: 'progress' | 'remaining'): this { this.direction = value; return this }

    protected override beforeFinalize(): void {
        const size = this.size?.toJSON()
        if (!size || !size.every((v) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0)) throw new Error('EventProgressBar 需要正整数像素尺寸')
        const [W, H] = size as [number, number], ref = this.value
        const expressions = ref._bindings(W)
        const parts = eventTimerBarParts(ref.manifest.namespace, { receiverName: expressions.receiver, width: W, height: H,
            sourceProperty: '#cui_position',
            boundDimensions: true,
            fill: this.fill, track: this.track, progressExpression: expressions.progress, runningExpression: expressions.running,
            pausedExpression: expressions.paused, clockVariable: expressions.clock,
            animationNames: { grow: `cui_${ref.manifest.id}_${ref.slot}_grow`, shrink: `cui_${ref.manifest.id}_${ref.slot}_shrink` } })
        if (this.background) this.remove(this.background)
        if (this.motion) this.remove(this.motion)
        this.background = new Raw(parts.track).setName('track')
        this.motion = new Raw(this.direction === 'progress' ? parts.grow : parts.shrink).setName('motion')
        this.props.eventAnimations = parts.animations
        this.add(this.background, this.motion)
    }
}
