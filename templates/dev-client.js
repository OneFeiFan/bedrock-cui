// bedrock-cui dev 的预览页面：读取项目配置，按界面逐个预览；右侧编辑表单数据；服务端翻页可直接点击。
import config from 'virtual:cui-config'
import TEXTURES from 'virtual:cui-textures'
import { Pages, compileNamespace, screenOf, setMetricsProfile, signal } from 'bedrock-cui'
import { ServerPagesPreview, mountPreview } from 'bedrock-cui/web'

const ids = Object.keys(config.screens)
const nav = document.querySelector('#screens nav')
const stage = document.getElementById('stage')
const $ = (id) => document.getElementById(id)
const log = (s) => { $('log').textContent = `${s}\n${$('log').textContent}`.slice(0, 2000) }

/** 界面里带服务端翻页的 Pages → 路由表 */
function findPaging(root, panelId) {
    let found
    const walk = (el) => {
        if (!found && el instanceof Pages) { const r = el.serverPaging(panelId); if (r.arrows.length || r.stay !== undefined) found = r }
        el.children.forEach(walk)
    }
    walk(root)
    return found
}

const outlines = signal(false)
let current

function show(id) {
    current = id
    location.hash = encodeURIComponent(id)
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === id))
    stage.innerHTML = ''
    const form = config.preview?.forms?.[id] ?? {}
    const viewport = config.preview?.viewport ?? [400, 240]
    const root = screenOf(config.screens[id]).build()
    const paging = findPaging(root, id)
    // 按钮：每行一个；行末写「 @ 图标路径」表示带图标的按钮
    const parse = () => ($('f-buttons').value ? $('f-buttons').value.split('\n') : []).map((line) => {
        const at = line.lastIndexOf(' @ ')
        return at >= 0 ? { text: line.slice(0, at), icon: line.slice(at + 3).trim() } : line
    })
    const own = () => Object.fromEntries(parse().map((b, i) => [i, b]))
    const texts = () => parse().map((b) => (typeof b === 'string' ? b : b.text))
    const icons = () => parse().map((b) => (typeof b === 'string' ? '' : b.icon ?? ''))

    $('f-title').value = form.title ?? id
    $('f-text').value = form.text ?? ''
    $('f-buttons').value = (form.buttons ?? []).map((b) => (typeof b === 'string' ? b : b.icon ? `${b.text} @ ${b.icon}` : b.text)).join('\n')
    const title = signal($('f-title').value), text = signal($('f-text').value), buttons = signal(texts()), buttonIcons = signal(icons())
    const sim = paging ? new ServerPagesPreview(paging, own) : undefined

    // 静态检查：显示在预览下方
    const issues = compileNamespace(config.namespace, { root: screenOf(config.screens[id]).build() }).issues

    const box = document.createElement('div')
    stage.append(box)
    const scale = Number($('f-scale').value) || Math.max(1, Math.min(4, Math.floor((stage.clientWidth - 48) / viewport[0])))
    const preview = mountPreview(box, {
        root, viewport, scale, textures: TEXTURES, outlines,
        fonts: { unifont: '/@cui/font/unifont.hex.gz', ascii: '/@cui/font/ascii.png' },
        title: sim ? sim.title : title, formText: text, formButtons: sim ? sim.formButtons : buttons, formButtonIcons: sim ? sim.formButtonIcons : buttonIcons,
        onFormButton: (i, t) => {
            const before = sim?.current
            if (sim && sim.press(i, preview)) return log(sim.current === before ? `停留在 ${sim.current}（原地不动）` : `翻到 ${sim.current}`)
            log(`点击了表单按钮 ${i}「${t}」：游戏中表单关闭，脚本收到序号 ${i}`)
        },
    })
    $('f-title').oninput = () => { title.value = $('f-title').value }
    $('f-text').oninput = () => { text.value = $('f-text').value }
    $('f-buttons').oninput = () => { if (!sim) { buttons.value = texts(); buttonIcons.value = icons() } }

    const list = document.createElement('div')
    list.id = 'issues'
    for (const i of issues) {
        const d = document.createElement('div')
        d.textContent = `${i.level === 'error' ? '错误' : '警告'} ${i.rule} ${i.path}：${i.message}`
        list.append(d)
    }
    stage.append(list)
}

// 显示设置：字宽档案切换后重建界面（排版按当前档案计算）
$('f-platform').onchange = () => { setMetricsProfile($('f-platform').value); show(current) }
$('f-scale').onchange = () => show(current)
$('f-outlines').onchange = () => { outlines.value = $('f-outlines').checked }

for (const id of ids) {
    const a = document.createElement('a')
    a.href = '#'; a.textContent = id; a.dataset.id = id
    a.onclick = (e) => { e.preventDefault(); show(id) }
    nav.append(a)
}
show(decodeURIComponent(location.hash.slice(1)) || ids[0])
