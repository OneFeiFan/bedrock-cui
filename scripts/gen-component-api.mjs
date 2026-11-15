/**
 * 组件页的属性与方法表：把 docs/guide/components/*.md 中 <!-- api: 类名 --> 与 <!-- /api --> 之间的内容替换为从源码生成的表格。
 *   node scripts/gen-component-api.mjs
 * 只列该类及其父类（不含 Element）中声明的公开成员；Element 的通用成员见 components/element.md。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'docs', 'guide', 'components')
const entry = path.join(root, 'src', 'index.ts')
const program = ts.createProgram([entry], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true })
const checker = program.getTypeChecker()
const exportsMap = new Map(checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(entry))).map((e) => [e.name, e.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(e) : e]))

const esc = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const isDeprecated = (node) => ts.getJSDocTags(node).some((t) => t.tagName.text === 'deprecated')
const isPublic = (m) => {
    const mods = ts.getCombinedModifierFlags(m)
    if (mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) return false
    const n = m.name?.getText?.() ?? ''
    return !n.startsWith('_') && !n.startsWith('#')
}
/** 注释的第一句，去掉测试记录 */
const doc = (node) => {
    const sym = node.name ? checker.getSymbolAtLocation(node.name) : undefined
    let t = sym ? ts.displayPartsToString(sym.getDocumentationComment(checker)).split('\n')[0] : ''
    // 第一句：到括号之外的第一个句号或分号为止
    let depth = 0
    for (let i = 0; i < t.length; i++) {
        const c = t[i]
        if (c === '（' || c === '(') depth++
        else if (c === '）' || c === ')') depth = Math.max(0, depth - 1)
        else if ((c === '。' || c === '；') && depth === 0) { t = t.slice(0, i); break }
    }
    return t.replace(/（[^）]*真机[^）]*）/g, '').replace(/\*\*/g, '').trim()
}
const typeText = (node) => checker.typeToString(checker.getTypeAtLocation(node), undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope)

/** 类及其父类（到 Element 为止）的声明 */
function chain(name) {
    const out = []
    let decl = exportsMap.get(name)?.declarations?.find(ts.isClassDeclaration)
    while (decl && (decl.name?.text !== 'Element' || (name === 'Element' && !out.length))) {
        out.push(decl)
        const ext = decl.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]
        const sym = ext && checker.getSymbolAtLocation(ext.expression)
        const target = sym && (sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym)
        decl = target?.declarations?.find(ts.isClassDeclaration)
    }
    return out
}

function tables(name) {
    const decls = chain(name)
    if (!decls.length) throw new Error(`没有导出类 ${name}`)
    // 构造函数：本类没有就沿父类找，都没有就是 new X()
    const owner = decls.find((d) => d.members.some((m) => ts.isConstructorDeclaration(m)))
    const ctors = owner ? owner.members.filter((m) => ts.isConstructorDeclaration(m) && !isDeprecated(m) && isPublic(m)) : []
    const hidden = owner && !ctors.length    // 构造函数不公开：用静态方法创建
    const sigs = ctors.length ? (ctors.length > 1 ? ctors.filter((c) => !c.body) : ctors).map((c) => `new ${name}(${c.parameters.map((p) => p.getText()).join(', ')})`) : hidden ? [] : [`new ${name}()`]
    const props = new Map(), methods = []
    for (const d of decls) for (const m of d.members) {
        const isStatic = !!(ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Static)
        if (!isPublic(m) || isDeprecated(m) || (isStatic && !ts.isMethodDeclaration(m))) continue
        const n = m.name?.getText()
        if (!n || n === 'type' || n === 'direction') continue
        if (ts.isGetAccessorDeclaration(m) || ts.isPropertyDeclaration(m)) {
            if (!props.has(n)) props.set(n, { name: n, type: typeText(m), doc: doc(m), readonly: ts.isPropertyDeclaration(m) && !!(ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Readonly) })
        } else if (ts.isMethodDeclaration(m) && m.body) {
            if (methods.some((x) => x.name === n)) continue
            const overloads = d.members.filter((o) => ts.isMethodDeclaration(o) && o.name.getText() === n && !o.body && !isDeprecated(o))
            const shown = overloads.length ? overloads : [m]
            const prefix = isStatic ? `${d.name.text}.` : ''
            methods.push({ name: n, sigs: shown.map((o) => `${prefix}${n}(${o.parameters.map((p) => p.getText()).join(', ')})`), doc: doc(m) || doc(shown[0]) })
        }
    }
    // 属性与它的 setXxx() 合为一行
    const setterOf = (p) => methods.find((m) => m.name === `set${p[0].toUpperCase()}${p.slice(1)}`)
    let md = name === 'Element' ? '`Element` 是所有控件的基类，不直接创建。\n' : sigs.length ? `**创建**\n\n${sigs.map((s) => `- \`${s}\``).join('\n')}\n` : '**创建**\n\n见下方的静态方法。\n'
    const rows = [...props.values()]
    if (rows.length) {
        md += `\n**属性**\n\n| 属性 | 设置方法 | 类型 | 说明 |\n|---|---|---|---|\n`
        for (const p of rows) {
            const s = setterOf(p.name)
            const how = s ? (s.sigs.length > 1 ? s.sigs.map((x) => `\`${esc(x)}\``).join('<br>') : `\`${s.name}()\``) : p.readonly ? '只读' : '—'
            md += `| \`${p.name}\` | ${how} | \`${esc(p.type)}\` | ${esc(p.doc || s?.doc || '')} |\n`
        }
    }
    const rest = methods.filter((m) => !rows.some((p) => setterOf(p.name) === m))
    if (rest.length) {
        md += `\n**方法**\n\n| 方法 | 说明 |\n|---|---|\n`
        for (const m of rest) md += `| ${m.sigs.map((s) => `\`${esc(s)}\``).join('<br>')} | ${esc(m.doc)} |\n`
    }
    if (name !== 'Element') md += `\n另有所有控件共有的属性与方法，见 [Element](element.md)。\n`
    return md
}

let changed = 0
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : []) {
    const file = path.join(dir, f)
    const src = fs.readFileSync(file, 'utf8')
    const out = src.replace(/<!-- api: (\w+) -->[\s\S]*?<!-- \/api -->/g, (_, name) => `<!-- api: ${name} -->\n${tables(name)}<!-- /api -->`)
    if (out !== src) { fs.writeFileSync(file, out); changed++ }
}
console.log(`组件页的 API 表：更新了 ${changed} 页`)
export { tables }
