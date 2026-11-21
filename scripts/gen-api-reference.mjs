/**
 * 生成手册的 API 参考（docs/guide/reference/api-*.md）：读各入口模块的导出，取源码注释的第一句作说明。
 *   node scripts/gen-api-reference.mjs
 * API 改动后重新运行一次，参考页与源码保持一致。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'docs', 'guide', 'reference')

/**
 * 参考页的条目与说明由人工整理（手册的笔调）；脚本核对：每个名称都必须是该模块的导出；
 * 模块新增的导出既没写进参考、也没列入 INTERNAL 时，报告出来——参考与源码不会脱节。
 */
const PAGES = [
    { file: 'api-core.md', title: 'bedrock-cui', intro: '控件、组件、值类型、表达式、编译与静态检查、文字排版。', modules: [['bedrock-cui', 'src/index.ts', [
        ['控件', [
            ['Element', '所有控件的基类：名称、尺寸、位置、层级、显示条件，以及 add()、remove()、clone()、find()、set()。'],
            ['Panel', '容器，没有外观。子控件按各自的锚点与偏移定位。'],
            ['Image', '图片。支持九宫格、染色、透明度、取样区域与按比例裁剪。'],
            ['Label', '文字。未设置宽度时不折行，设置宽度后由游戏折行。'],
            ['Stack', '子控件沿一个方向依次排列。'],
            ['Grid', '网格。'],
            ['Row', '横向的弹性布局：间距、主轴分布、交叉轴对齐、伸展。'],
            ['Column', '纵向的弹性布局。'],
            ['Scroll', '可滚动的区域，子控件纵向排列。'],
            ['Button', '按钮。外观由 default、hover、pressed 三个状态面板组成。'],
            ['Toggle', '开关。同组互斥；外观由四个状态面板组成。'],

            ['Raw', '原样输出的 JSON UI 元素。'],
        ]],
        ['组件', [
            ['Paragraph', '较长的文字。默认软换行：交给游戏折行，调整汉字与英文、数字交界处的间隔。'],
            ['Text', '可插入行内图标的文字，由 bedrock-cui 排版。'],
        ]],
        ['图标', [
            ['InlineIcon', '行内图标，用于 Text。'],
            ['GlyphSheet', '一张字形图（emoji 页 E2–F8），用于在运行期文字中显示图标。'],
            ['Glyph', 'GlyphSheet 中的一个图标，转换为字符串即其字符。'],
        ]],
        ['值类型', [
            ['Length', '一个方向上的尺寸：像素、百分比、子控件之和、填满等，可加减像素。'],
            ['Size', '宽与高。'],
            ['Vec2', '二维偏移。'],
            ['Anchor', '锚点，共九个。'],
            ['Color', '颜色。'],
            ['Insets', '内边距：左、上、右、下。'],
            ['Texture', '贴图路径，可附带尺寸与九宫格信息。'],
            ['TextStyle', '文字样式：颜色、阴影、字号、对齐。'],
            ['Justify', '弹性布局主轴方向的分布方式。'],
            ['Align', '弹性布局交叉轴方向的对齐方式。'],
        ]],
        ['界面（defineScreen）', [
            ['defineUI', '定义一个界面：id、props、state、computed、methods、生命周期与根页面 page（页面函数）。返回的对象有 open / close / isOpen / on / off。'],
            ['PageFunction', '页面函数：参数是使用者在 props、state、computed、methods 中定义的名字，返回这一页的内容（通常是 Page）。'],
            ['Page', '一页内容；放在页面组中时缺省铺满页面组。'],
            ['Router', '一组子页面，由服务端切换（界面以那一页重新打开，鼠标不动也能连续点击）；startAt(名称)。每个界面最多一个。'],
            ['Tabs', '一组子页面，由客户端切换（表单不关闭）；startAt(名称)。界面重新打开后回到起始的一块。'],
            ['Link', '跳转元素：到某个子页面（new Link(名称) 或 new Link(组名:名称)）；selected 为目标页正在显示时的外观。'],
            ['Back', '跳转元素：返回上一次所在的页（Router）；没有历史时自动隐藏。'],
            ['Prev', '跳转元素：按定义的顺序到上一页；没有上一页时自动隐藏。'],
            ['Next', '跳转元素：按定义的顺序到下一页；没有下一页时自动隐藏。'],
            ['NavButton', 'Link、Back、Prev、Next 的共同父类：按钮的三个状态与 selected。'],
            ['Close', '关闭界面的按钮。'],
            ['PropSpec', 'props 中一项的声明：{ type, default, of, max }（同 Vue 的 props）。'],
            ['Item', 'props 声明中的类型：文字与图标 { text, icon }。'],
            ['MethodRef', '视图中方法的引用（从视图参数中解构得到），用于 button().onClick(方法, …参数)。'],
            ['Screen', 'defineScreen() 返回的界面对象：id；行为包脚本中的 open(玩家, props)、close(玩家)、isOpen(玩家)、on(事件名, 处理函数) / off()；构建时的 build()、previewForm()。'],
        ]],
        ['计时显示', [
            ['Timer', '记录开始时刻与总时长，驱动 ProgressBar 的动画。'],
            ['ProgressBar', '接收计时器或 value、max 数值。setHead() 设置末端竖条。'],
        ]],
        ['动画', [
            ['Anim', '动画（客户端播放）：alpha、offset、size、color、clip（裁剪比例）、wait；then() 串成动画链，loop() 循环，setEasing() 设置缓动。用 setAnims() 加到任何控件上。'],
        ]],
        ['项目配置', [
            ['defineConfig', '定义项目配置（cui.config.mjs）：命名空间、界面、贴图目录、预览数据。bedrock-cui dev 与 useSapdon() 共用。'],
            ['screenOf', '取出配置中一个界面的构建函数与选项。'],
        ]],
        ['表达式与响应式', [
            ['toggleState', '某个开关是否选中的表达式。'],
            ['Expr', '表达式。编译为 JSON UI 的绑定，由游戏在运行时求值。'],
            ['signal', '创建一个信号（可观察的值），用于向浏览器预览提供数据。'],
            ['Signal', '信号。'],
            ['computed', '由其他信号计算得出的信号。'],
            ['effect', '信号变化时执行的回调。'],
        ]],
        ['编译与检查', [
            ['compileNamespace', '将控件树编译为一个 JSON UI 命名空间。'],
            ['lint', '对控件树做静态检查。'],
            ['escapeText', '转义文字中会被游戏特殊处理的开头字符（# 与 $）。'],
        ]],
        ['文字与字宽', [
            ['measureText', '模拟游戏的折行，返回各行、宽度与高度。'],
            ['textWidth', '一段文字的宽度（界面像素）。'],
            ['softWrapText', '软换行：返回交给游戏折行的文字。'],
            ['wrapText', '按当前字宽计算每一行（硬换行）。'],
            ['paginate', '长文本分页，默认按安卓字宽计算。'],
            ['autoSpace', '在汉字与英文、数字之间加空格。'],
            ['setMetricsProfile', '切换全局的字宽档案：pc 或 android。'],
            ['withMetricsProfile', '在回调期间使用指定的字宽档案。'],
            ['getMetricsProfile', '当前的字宽档案。'],
            ['NBSP', '不换行空格（U+00A0）。'],
            ['LINE_HEIGHT', '一行文字的高度：10 像素。'],
        ]],
        ['类型', [
            ['ServerPaging', '一个界面的翻页路由表。'],
            ['ServerArrowRoute', '路由表中的一个翻页箭头。'],
            ['LintIssue', '静态检查的一项结果：rule、level、path、message。'],
            ['TextureInfo', '贴图信息：size、nineslice、baseSize。'],
            ['MetricsProfile', "字宽档案：'pc' 或 'android'。"],
            ['SoftWrapOptions', 'softWrapText() 的选项。'],
            ['WrapOptions', 'wrapText() 的选项。'],
            ['PaginateOptions', 'paginate() 的选项。'],
            ['CuiConfig', '项目配置。'],
            ['CuiPreviewForm', '预览中某个界面的表单数据：title、text、buttons。'],
            ['CuiScreen', '配置中的一个界面：返回根控件的函数，或 { build, routed }。'],
            ['ScreenOptions', 'defineScreen() 的选项。'],
            ['AnimType', '动画的类型。'],
            ['AnimEasing', '动画的缓动方式。'],
            ['ScreenManifest', '界面的清单：props 与按钮的名字及其对应的表单按钮序号。'],
            ['PropItem', '一个 prop 的值：文字，或 { text, icon }。'],
            ['PropSlot', '一个 prop 占用的表单按钮：序号与标记。'],
            ['TextMetrics', 'measureText() 的结果：lines、width、height。'],
            ['LengthLike', '数字（像素）或 Length。'],
            ['ExprLike', '表达式，或字符串、数字、布尔等字面值。'],
            ['TextAlign', "文字对齐：'left'、'center'、'right'。"],
            ['InlineIconSize', '行内图标的尺寸：8 或 16。'],
            ['GlyphIconOptions', 'GlyphSheet.icon() 的选项。'],
            ['LintOptions', '静态检查的选项：贴图信息、屏幕尺寸、字宽档案。'],
        ]],
    ]]] },
    { file: 'api-node.md', title: 'bedrock-cui/node', intro: '构建工具，只在 Node 中使用。', modules: [['bedrock-cui/node', 'src/node/index.ts', [
        ['构建', [
            ['useSapdon', '按项目配置接入 sapdon 的构建（在 sapdon 项目的入口文件中调用）。'],
            ['CuiApp', '挂载界面、导出翻页路由、生成字形图；fromConfig() 由项目配置创建，compile() 只编译，useSapdon() 接入 sapdon 的构建。'],
            ['checkScripts', '对行为包中的脚本做类型检查，返回错误信息。'],
        ]],
        ['资源', [
            ['textureInfoFrom', '从资源包目录读取贴图的尺寸与九宫格信息。'],
            ['renderGlyphSheet', '生成字形图，并核对各图标的墨迹。'],
            ['copyRuntime', '将脚本端运行时复制到指定目录。'],
        ]],
        ['类型', [
            ['CuiCompiled', 'CuiApp.compile() 的结果。'],
            ['SapdonCore', 'useSapdon() 所需的 sapdon 模块成员。'],
        ]],
    ]]] },
    { file: 'api-runtime.md', title: 'bedrock-cui/runtime', intro: '在行为包脚本中使用的运行时。放入行为包的方式见指南「脚本端」。', modules: [
        ['bedrock-cui/runtime', 'src/runtime/index.ts', [
            ['文字', [
                ['softWrap', '软换行：返回交给游戏折行的文字。结果缓存。'],
                ['preWrap', '按 PC 字宽计算每一行，返回以换行符连接的文字。'],
            ['paginate', '长文本分页：按每页可用的高度切分，返回各页的文字；默认按安卓字宽折行。'],
            ['PaginateOptions', 'paginate() 的选项：height（必需）、firstHeight、profile，以及折行的选项。'],
                ['softWrapText', '同 bedrock-cui 的 softWrapText()，不缓存。'],
                ['wrapText', '按当前字宽计算每一行。'],
                ['autoSpace', '在汉字与英文、数字之间加空格。'],
                ['measureText', '模拟游戏的折行。'],
                ['textWidth', '一段文字的宽度。'],
                ['setMetricsProfile', '切换全局的字宽档案。'],
                ['withMetricsProfile', '在回调期间使用指定的字宽档案。'],
            ]],
            ['类型', [['SoftWrapOptions', 'softWrap() 的选项。'], ['WrapOptions', 'preWrap() 的选项。'], ['MetricsProfile', "字宽档案：'pc' 或 'android'。"]]],
        ]],
    ] },
    { file: 'api-web.md', title: 'bedrock-cui/web', intro: '浏览器预览。', modules: [['bedrock-cui/web', 'src/web/index.ts', [
        ['预览', [
            ['mountPreview', '在网页元素中按游戏的规则绘制界面。'],
            ['runScreenInBrowser', '在浏览器中运行界面文件的逻辑（bedrock-cui dev 与手册网站的预览共用）：点击 → 方法 → 重新显示；游戏 API 为模拟对象。'],
            ['ScreenPreviewOptions', 'runScreenInBrowser 的选项：清单、路由表、预览的表单数据、日志。'],
            ['mountDevtools', '预览的调试面板：控件边框、表单数据。'],
            ['loadPixelFonts', '加载预览使用的点阵字体。'],
        ]],
        ['类型', [['PreviewOptions', 'mountPreview() 的选项。'], ['PreviewTexture', '预览使用的贴图：地址与贴图信息。'], ['Preview', 'mountPreview() 的返回值：表单数据的信号、resetToggles() 等。']]],
    ]]] },
    { file: 'api-dom.md', title: 'bedrock-cui/dom', intro: '网页输出：将控件树渲染为 HTML。', modules: [['bedrock-cui/dom', 'src/dom/index.ts', [
        ['渲染', [
            ['renderHtml', '将控件树渲染为 HTML 字符串。'],
            ['cssLength', '将 JSON UI 的尺寸写法转换为 CSS 长度。'],
            ['formatCodesToHtml', '将含 § 格式码的文字转换为 HTML。'],
        ]],
        ['网页专用的元素', [
            ['Link', '链接。'],
            ['Html', '原样插入的 HTML 片段。'],
        ]],
        ['类型', [['RenderHtmlOptions', 'renderHtml() 的选项：assetUrl。']]],
    ]]] },
]

/** 内部实现：不写进参考 */
const INTERNAL = new Set([
    // 底层 API：CUI 内部使用（界面文件的 props 与 button() 代替它们），不出现在手册中
    'sampleAnims', 'AnimSample', 'DataKind','BEDROCK_COLORS', 'Effect', 'Flex', 'GLYPH_HEIGHT', 'GLYPH_TOP', 'NBSP_BREAK_WIDTH', 'NO_LINE_END', 'NO_LINE_START', 'PLAIN', 'SCROLLBAR',
    'activeEffect', 'applyCode', 'asBool', 'batch', 'batchKey', 'boldExtra', 'buttonPayload', 'charWidth', 'compileExpr', 'drawOrder', 'evalExpr', 'evalOffset', 'evalTerms', 'finalize',
    'findBox', 'isAscii', 'isExpr', 'isWide', 'layout', 'layoutInline', 'lineWidth', 'lintLayout', 'lit', 'parseRich', 'parseSize', 'ref', 'registerGlyphWidth', 'richWidth',
    'stripFormat', 'styleCodes', 'unifontWidth', 'unregisterGlyph', 'usesChildren', 'usesSelf', 'usesUnifont', 'variable', 'walk', 'wrapDetailed',
    'buttonTextOf', 'buttonIconOf', 'PropRef', 'propIndices', '_setScreenRuntime', 'SOLID_TEXTURE', 'hasRefs',
    'decodePng', 'downscaleIcon', 'encodePng', 'inkOf', 'pngSize', 'runtimeFiles', 'drawText', 'PixelFonts',
    // 排版、编译与表达式内部的数据结构
    'SizeJson', 'AnchorName', 'Dyn', 'RGB', 'Intrinsic', 'RNode', 'Source', 'Op', 'ExprNode', 'Value', 'CompiledExpr', 'EvalEnv', 'TextureMeta', 'RunStyle', 'Run',
    'Unit', 'Term', 'SizeSpec', 'UnitContext', 'Rect', 'Edges', 'Scope', 'LayoutEnv', 'Box', 'CompileResult', 'ServerFormFiles', 'TextPiece',
    'LayoutOptions',
    'TextOptions'])

const files = PAGES.flatMap((p) => p.modules.map(([, f]) => path.join(root, f)))
const program = ts.createProgram(files, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true })
const checker = program.getTypeChecker()

const KIND = [
    [ts.SymbolFlags.Class, '类'], [ts.SymbolFlags.Function, '函数'], [ts.SymbolFlags.Enum, '枚举'],
    [ts.SymbolFlags.Interface, '接口'], [ts.SymbolFlags.TypeAlias, '类型'], [ts.SymbolFlags.Variable, '常量'],
]

let problems = 0
for (const page of PAGES) {
    let md = `# ${page.title}\n\n${page.intro}\n\n本页由 \`scripts/gen-api-reference.mjs\` 生成并与源码核对。详细用法见指南中的相关章节。\n`
    for (const [name, file, sections] of page.modules) {
        const sf = program.getSourceFile(path.join(root, file))
        const exported = new Map(checker.getExportsOfModule(checker.getSymbolAtLocation(sf)).map((e) => [e.name, e.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(e) : e]))
        if (page.modules.length > 1) md += `\n## ${name}\n`
        const documented = new Set()
        for (const [title, entries] of sections) {
            md += `\n${page.modules.length > 1 ? '###' : '##'} ${title}\n\n| 名称 | 种类 | 说明 |\n|---|---|---|\n`
            for (const [n, text] of entries) {
                const sym = exported.get(n)
                if (!sym) { console.error(`✗ ${name} 没有导出 ${n}`); problems++; continue }
                documented.add(n)
                md += `| \`${n}\` | ${KIND.find(([f]) => sym.flags & f)?.[1] ?? '—'} | ${text.replace(/\|/g, '\\|')} |\n`
            }
        }
        for (const n of exported.keys()) if (!documented.has(n) && !INTERNAL.has(n) && !n.startsWith('_')) {
            const sym = exported.get(n)
            if (sym.getJsDocTags(checker).some((t) => t.name === 'deprecated')) continue
            console.warn(`· ${name} 的导出 ${n} 既不在参考里、也没标为内部`)
        }
    }
    fs.writeFileSync(path.join(out, page.file), md)
    console.log(`${page.file}：${(md.match(/^\| `/gm) ?? []).length} 项`)
}
if (problems) process.exit(1)
