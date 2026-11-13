/**
 * CUI 演示：用组件写一屏迷你指导书（目录页 / 钻石剑页），在浏览器里按游戏的排版规则预览，
 * 开发面板里改表单正文、按钮文字，看静态检查与编译出的 JSON UI。
 */
import { form, FormButton, FormGate, buttonPayload, signal, type Child, type RGB } from 'cui'
import { mountDevtools, mountPreview, type PreviewTexture } from 'cui/web'

const TITLE: RGB = [0.24, 0.13, 0.03]
const BODY: RGB = [0.27, 0.19, 0.11]
const WHITE: RGB = [1, 1, 1]
const tex = (file: string, size: [number, number], extra: Partial<PreviewTexture> = {}): PreviewTexture => ({ url: `./textures/${file}.png`, size, ...extra })
const textures: Record<string, PreviewTexture> = {
    'textures/guide/book': tex('book', [272, 180]),
    'textures/guide/line': tex('line', [1, 1]),
    'textures/guide/row_hover': tex('row_hover', [1, 1]),
    'textures/guide/arrow_left': tex('arrow_left', [20, 12]),
    'textures/guide/arrow_left_hover': tex('arrow_left_hover', [20, 12]),
    'textures/guide/arrow_right': tex('arrow_right', [20, 12]),
    'textures/guide/arrow_right_hover': tex('arrow_right_hover', [20, 12]),
    'textures/ui/cell_image': tex('cell_image', [10, 10], { nineslice: 1 }),
    'textures/ui/highlight_slot': tex('highlight_slot', [1, 1]),
    'textures/ui/purpleBorder': tex('purpleBorder', [16, 16], { nineslice: 4 }),
    'textures/items/diamond_sword': tex('diamond_sword', [16, 16]),
    'textures/items/diamond': tex('diamond', [16, 16]),
    'textures/items/stick': tex('stick', [16, 16]),
    'textures/items/book_normal': tex('book_normal', [16, 16]),
}

// ───────────── 组件 ─────────────

/** 页标题：居中深棕 + 分隔线（1×1 贴图拉伸 ⇒ 必须 keepRatio={false}） */
function Title(props: { text: string }) {
    return <panel size={['100%', 18]} anchor="top_left">
        <label text={props.text} color={TITLE} anchor="top_middle" offset={[0, 3]} />
        <image texture="textures/guide/line" keepRatio={false} size={['100% - 24px', 1]} anchor="top_middle" offset={[0, 15]} />
    </panel>
}

/** 目录里可点的一行：图标 + 文字，悬停整行高亮 */
function Row(props: { index: number, icon: string, text: string, y: number, wrongKeepRatio?: boolean }) {
    const hover = props.wrongKeepRatio
        ? <image texture="textures/guide/row_hover" size={['100%', '100%']} />
        : <image texture="textures/guide/row_hover" keepRatio={false} size={['100%', '100%']} />
    return <FormButton index={props.index} tag={`l${props.index - 4}|`} size={[116, 18]} anchor="top_left" offset={[0, props.y]} hover={hover}>
        <image texture={props.icon} size={[16, 16]} anchor="left_middle" offset={[3, 0]} layer={3} />
        <label text={props.text} color={BODY} anchor="left_middle" offset={[23, 0]} layer={3} />
    </FormButton>
}

/** 物品格子：原版格子背景；悬停 = 绿光（在图标下面）+ 紫边提示框（名字 + 运行期数据） */
function Slot(props: { index: number, icon: string, name: string, size?: number, x: number, y: number }) {
    const tag = `l${props.index - 4}|`
    const s = props.size ?? 20
    const icon = s >= 32 ? 32 : 16
    const tooltip = <image texture="textures/ui/purpleBorder" size={['100%c + 8px', '100%c + 8px']} anchorFrom="top_right" anchorTo="top_left" offset={[2, -2]} layer={30}>
        <stack size={['100%c', '100%c']}>
            <label text={props.name} color={WHITE} shadow anchor="left_middle" />
            <label text={buttonPayload(tag)} color={[0.67, 0.67, 0.67]} shadow anchor="left_middle" visible={buttonPayload(tag).isEmpty().not()} />
        </stack>
    </image>
    return <FormButton index={props.index} tag={tag} size={[s, s]} anchor="top_left" offset={[props.x, props.y]}
        default={<image texture="textures/ui/cell_image" size={['100%', '100%']} />}
        hover={[<image texture="textures/ui/cell_image" size={['100%', '100%']} />, <image texture="textures/ui/highlight_slot" keepRatio={false} alpha={0.8} size={['100% - 2px', '100% - 2px']} layer={1} />, tooltip]}>
        <image texture={props.icon} size={[icon, icon]} layer={2} />
    </FormButton>
}

function Page(props: { side: 'L' | 'R', children?: Child }) {
    return <panel size={[116, 160]} anchor="top_left" offset={[props.side === 'L' ? 14 : 142, 10]}>{props.children}</panel>
}

function NavButton(props: { index: number, tag: string, dir: 'left' | 'right' }) {
    const art = (hover: boolean) => <image texture={`textures/guide/arrow_${props.dir}${hover ? '_hover' : ''}`} size={[20, 12]} />
    return <FormButton index={props.index} tag={props.tag} size={[28, 18]} anchor="top_left" offset={[props.dir === 'left' ? 10 : 234, 156]} default={art(false)} hover={art(true)} pressed={art(true)} />
}

function Book() {
    return <panel size={[272, 180]}>
        <image texture="textures/guide/book" size={[272, 180]} />
        <FormGate tag="HOME;">
            <Page side="L">
                <Title text="冒险者手册" />
                <label text={'用 CUI 组件写的一页：排版按 JSON UI 规则在浏览器里预览。\n\n右边第 4 行是「错误示范」：高亮贴图没关 keep_ratio，悬停时只亮中间一个方块——与真机一致。'} color={BODY} size={[110, 'default']} anchor="top_left" offset={[3, 22]} />
            </Page>
            <Page side="R">
                <Title text="目录" />
                <Row index={4} y={20} icon="textures/items/book_normal" text="入门" />
                <Row index={5} y={38} icon="textures/items/diamond_sword" text="钻石剑" />
                <Row index={6} y={56} icon="textures/items/diamond" text="钻石" />
                <Row index={7} y={74} icon="textures/items/stick" text="错误示范" wrongKeepRatio />
            </Page>
        </FormGate>
        <FormGate tag="ENT:sword;">
            <Page side="L">
                <Title text="钻石剑" />
                <Slot index={4} icon="textures/items/diamond_sword" name="钻石剑" size={36} x={40} y={24} />
                <label text="把鼠标停在剑上：提示框里的耐久、可附魔来自运行期塞进按钮文字的数据。" color={BODY} size={[110, 'default']} anchor="top_left" offset={[3, 68]} />
            </Page>
            <Page side="R">
                <Title text="合成" />
                <Slot index={5} icon="textures/items/diamond" name="钻石" x={38} y={24} />
                <Slot index={6} icon="textures/items/diamond" name="钻石" x={38} y={44} />
                <Slot index={7} icon="textures/items/stick" name="木棍" x={38} y={64} />
            </Page>
        </FormGate>
        <NavButton index={0} tag="prev|" dir="left" />
        <NavButton index={1} tag="next|" dir="right" />
    </panel>
}

// ───────────── 模拟服务端 ─────────────

const PAGES: Record<string, { text: string, buttons: string[] }> = {
    // 不显示的按钮发空文字：门控是「包含」判断，'no_prev|' 会误中 'prev|'
    home: { text: 'HOME;', buttons: ['', '', '', '', 'l0|', 'l1|', 'l2|', 'l3|'] },
    sword: { text: 'ENT:sword;', buttons: ['prev|', '', '', '', 'l0|§7耐久 1561\n§7可附魔：\n§7  锋利 V\n§7  耐久 III\n§a背包里有 1 个', 'l1|', 'l2|', 'l3|'] },
}
const formText = signal(PAGES.home.text)
const formButtons = signal(PAGES.home.buttons)
const go = (p: keyof typeof PAGES) => { formText.value = PAGES[p].text; formButtons.value = PAGES[p].buttons }

const preview = mountPreview(document.getElementById('app')!, {
    root: () => <Book />, viewport: [300, 190], scale: 3, textures, formText, formButtons,
    onFormButton: (i) => {
        if (formText.peek() === 'HOME;' && i === 5) go('sword')
        else if (i === 0) go('home')
    },
})
mountDevtools(document.getElementById('devtools')!, preview)
;(window as any).__cui = { preview, go }
