// 手册网站的页面脚本：代码块的复制、在线示例的标签页、修改并运行、参数滑块
// 复制代码
const copyText = (text, btn) => {
    const done = () => { btn.textContent = '已复制'; setTimeout(() => { btn.textContent = '复制' }, 1200) }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => fallback())
    else fallback()
    function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); done() }
}
document.querySelectorAll('.codebox .copy').forEach((btn) => btn.addEventListener('click', () => {
    const ex = btn.closest('.example')
    const editor = ex?.querySelector('.ex-editor')
    copyText(editor ? editor.value : ex ? ex.querySelector('.ex-src').textContent : btn.nextElementSibling.textContent, btn)
}))

// 在线示例：标签页、修改并运行、参数滑块
const runExample = (ex, code) => {
    const err = ex.querySelector('.ex-error')
    err.hidden = true
    try {
        const body = code.replace(/^import\s*\{([^}]*)\}\s*from\s*'bedrock-cui'\s*;?\s*$/gm, (_, names) => `const {${names}} = CUI`)
            .replace(/^export\s+default\s+\w+\s*;?\s*$/gm, '').replace(/^export\s+(?=const|let|function|class)/gm, '')
        if (/^\s*import\s/m.test(body)) throw new Error('示例只能从 bedrock-cui 导入')
        const d = ex.dataset
        const result = new Function('CUI', `${body}\n;return [${d.name}, ${d.form ?? 'undefined'}]`)(window.CUI)
        CUI_PREVIEW(d.id, result[0], { w: Number(d.w), h: Number(d.h), base: d.base, form: result[1] })
    } catch (e) {
        err.textContent = `运行出错：${e.message}`
        err.hidden = false
    }
}
const currentCode = (ex) => ex.querySelector('.ex-editor')?.value ?? ex.querySelector('.ex-src').textContent
document.querySelectorAll('.example').forEach((ex) => {
    const show = (tab) => {
        ex.querySelectorAll('.ex-bar [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab))
        ex.querySelector('.ex-code').hidden = tab !== 'code' && !ex.classList.contains('editing')
        ex.querySelector('.ex-preview').hidden = tab !== 'preview' && !ex.classList.contains('editing')
    }
    ex.querySelectorAll('.ex-bar [data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)))
    ex.querySelector('.ex-edit').addEventListener('click', () => {
        if (ex.classList.contains('editing')) return
        ex.classList.add('editing')
        const pane = ex.querySelector('.ex-code')
        const box = document.createElement('div')
        box.className = 'ex-editbox'
        box.innerHTML = '<textarea class="ex-editor" spellcheck="false"></textarea><div class="ex-actions"><button type="button" class="ex-run">运行</button><button type="button" class="ex-reset">还原</button></div>'
        const editor = box.querySelector('textarea')
        editor.value = ex.querySelector('.ex-src').textContent
        editor.rows = Math.min(30, editor.value.split('\n').length + 1)
        pane.querySelector('.codebox pre').hidden = true
        pane.querySelector('.codebox').append(box)
        box.querySelector('.ex-run').addEventListener('click', () => runExample(ex, editor.value))
        box.querySelector('.ex-reset').addEventListener('click', () => { editor.value = ex.querySelector('.ex-src').textContent; runExample(ex, editor.value) })
        show('code')
        editor.focus()
    })
    const slider = ex.querySelector('.ex-vary input')
    if (slider) slider.addEventListener('input', () => {
        slider.previousElementSibling.textContent = slider.value
        const re = new RegExp(`((?:const|let)\\s+${slider.dataset.var}\\s*=\\s*)-?\\d+`)
        const code = currentCode(ex).replace(re, `$1${slider.value}`)
        const editor = ex.querySelector('.ex-editor')
        if (editor) editor.value = code
        runExample(ex, code)
    })
})
