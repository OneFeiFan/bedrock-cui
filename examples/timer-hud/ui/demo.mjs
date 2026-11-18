import { Anchor, Color, EventProgressBar, Image, Label, Panel, Raw, Size, Texture, Timer, defineScreen, defineTimerHud } from 'bedrock-cui'

// 探针文字直接读取与进度条相同的接收器，避免诊断本身依赖局部属性转发。
function trace(ref, text, y, x = 4, width = 270, source = ref._bindings(200).receiver) {
    return new Raw({ type: 'label', text: '#text', size: [width, 12], offset: [x, y],
        anchor_from: 'top_left', anchor_to: 'top_left', text_alignment: 'left', localize: false, layer: 20,
        bindings: [{ binding_type: 'view', source_control_name: source,
            source_property_name: text, target_property_name: '#text', binding_condition: 'always' }] })
}

function clockReference(ref, y) {
    // 固定 200 像素容器，仅使用原生时长，无进度解码、动态尺寸或运行标记门控。
    const image = { type: 'image', texture: 'textures/bedrock_cui/solid', keep_ratio: false,
        anchor_from: 'top_left', anchor_to: 'top_left' }
    return new Raw({ type: 'panel', size: [200, 3], offset: [40, y],
        anchor_from: 'top_left', anchor_to: 'top_left', controls: [
            { track: { ...image, size: [200, 3], color: [0.18, 0.23, 0.29], layer: 0 } },
            { clock: { ...image, size: [0, '100%'], color: [1, 1, 1], layer: 1,
                anims: [`@${ref.manifest.namespace}.cui_${ref.manifest.id}_${ref.slot}_grow`] } },
        ] })
}

export const timers = defineTimerHud({
    id: 'cooldowns',
    timers: { a: Timer.idle(12), b: Timer.idle(18), c: Timer.idle(24) },
    titlePolicy: 'actionbar',
    view(t) {
        const root = new Panel().setSize(280, 130).setOffset(0, 5)
        for (const [i, key] of ['a', 'b', 'c'].entries()) {
            const ref = t[key], expressions = ref._bindings(200)
            root.add(new Label(key.toUpperCase()).setSize(14, 12).setAnchor(Anchor.TOP_LEFT).setOffset(4, i * 35))
            root.add(trace(ref, '#cui_field', i * 35, 22, 60))
            root.add(trace(ref, `('p=' + ${expressions.progress})`, i * 35, 88, 76))
            root.add(trace(ref, `('left=' + (200 - ${expressions.progress}))`, i * 35, 168, 108))
            root.add(new EventProgressBar(ref).setSize(200, 8).setAnchor(Anchor.TOP_LEFT).setOffset(40, 14 + i * 35)
                .setFill(Color.hex(['#34d399', '#60a5fa', '#fbbf24'][i])))
            root.add(clockReference(ref, 26 + i * 35))
        }
        root.add(trace(t.a, `('DATA: ' + (#cui_retained - '${t.a.manifest.prefix}'))`, 108, 4, 270, t.a.manifest.receiver))
        return root
    },
})

export const demo = defineScreen({
    id: 'cui_ui:timer_hud_demo',
    onOpen() {
        const now = Date.now(), player = this.player
        let b = Timer.idle(18).start(now), c = Timer.idle(24).start(now)
        timers.open(player, { a: Timer.idle(12).start(now), b, c })
        this.setTimeout(() => { b = b.pause(); timers.update(player, { b }) }, 60)
        this.setTimeout(() => { b = b.resume(); timers.update(player, { b }) }, 120)
        this.setTimeout(() => timers.showTitle(player, 'Actionbar: timers keep moving', { subtitle: 'No title-channel interruption' }), 150)
        this.setTimeout(() => timers.showTitle(player, '任务完成 / TITLE', {
            policy: 'priority', fadeInDuration: 10, stayDuration: 40, fadeOutDuration: 10,
            subtitle: 'Timers resume from current progress',
        }), 190)
        this.setTimeout(() => { b = b.pause(); c = c.pause(); timers.update(player, { b, c }) }, 300)
        this.setTimeout(() => { b = b.resume(); c = c.resume(); timers.update(player, { b, c }) }, 360)
    },
    onClose() { timers.close(this.player) },
    view({ button, close }) {
        const root = new Panel().setSize(300, 220).add(
            new Image(Texture.SOLID).setSize(Size.full()).setKeepRatio(false).setColor(Color.hex('#111b28')),
            new Label('3 TIMERS / CUI V15').setSize(280, 14).setAnchor(Anchor.TOP_LEFT).setOffset(14, 12),
            new Label('B pauses 3-6s / title 9.5s').setSize(280, 12).setAnchor(Anchor.TOP_LEFT).setOffset(14, 31),
            new Label('WHITE = clock test / resets on event').setSize(290, 12).setAnchor(Anchor.TOP_LEFT).setOffset(5, 174),
        )
        const end = button().onClick(close).setSize(180, 20).setAnchor(Anchor.BOTTOM_CENTER).setOffset(0, -10)
        end.default.add(new Label('Close demo'))
        end.hover.add(new Label('Close demo').setColor(Color.hex('#fbbf24')))
        root.add(end)
        return root
    },
})
