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
            ['CollectionItem', '集合中的一项，例如第 n 个表单按钮。其内部可读取该项的数据。'],
            ['Raw', '原样输出的 JSON UI 元素。'],
        ]],
        ['组件', [
            ['Paragraph', '较长的文字。默认软换行：交给游戏折行，调整汉字与英文、数字交界处的间隔。'],
            ['Text', '可插入行内图标的文字，由 bedrock-cui 排版。'],
            ['Pages', '多页内容：客户端开关切换，以及服务端翻页箭头。'],
            ['FormButton', '对应服务端表单第 n 个按钮的可点击区域，按钮文字包含标记时显示。'],
            ['FormGate', '表单正文包含标记时显示其内容的容器。'],
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
        ['项目配置', [
            ['defineConfig', '定义项目配置（cui.config.mjs）：命名空间、界面、贴图目录、预览数据。bedrock-cui dev 与 useSapdon() 共用。'],
            ['screenOf', '取出配置中一个界面的构建函数与选项。'],
        ]],
        ['表达式与响应式', [
            ['form', '服务端表单的数据：title、text、buttonText。'],
            ['toggleState', '某个开关是否选中的表达式。'],
            ['Expr', '表达式。编译为 JSON UI 的绑定，由游戏在运行时求值。'],
            ['signal', '创建一个信号（可观察的值），用于向浏览器预览提供数据。'],
            ['Signal', '信号。'],
            ['computed', '由其他信号计算得出的信号。'],
            ['effect', '信号变化时执行的回调。'],
        ]],
        ['编译与检查', [
            ['serverForm', '将界面挂载到服务端表单，返回界面文件与静态检查结果。'],
            ['compileNamespace', '将控件树编译为一个 JSON UI 命名空间。'],
            ['lint', '对控件树做静态检查。'],
            ['serverTitle', '路由界面的表单标题。'],
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
        ['混合翻页', [
            ['pageTitle', '某一页的表单标题：<界面 id>|P:<页名>;。'],
            ['pagingButtons', '某一页的全部表单按钮文字。ServerPagesForm 与 ServerPagesPreview 共用。'],
            ['pagingResponse', '点击某个按钮后的结果：翻页、原地不动或界面自己的按钮。'],
            ['arrowTag', '翻页箭头按钮文字的标记。'],
            ['STAY_TAG', '「原地不动」按钮文字的标记。'],
        ]],
        ['类型', [
            ['ServerPaging', '一个界面的翻页路由表。'],
            ['ServerArrowRoute', '路由表中的一个翻页箭头。'],
            ['FormButtonSpec', '一个表单按钮：文字，或 { text, icon }。'],
            ['LintIssue', '静态检查的一项结果：rule、level、path、message。'],
            ['TextureInfo', '贴图信息：size、nineslice、baseSize。'],
            ['MetricsProfile', "字宽档案：'pc' 或 'android'。"],
            ['SoftWrapOptions', 'softWrapText() 的选项。'],
            ['WrapOptions', 'wrapText() 的选项。'],
            ['PaginateOptions', 'paginate() 的选项。'],
            ['CuiConfig', '项目配置。'],
            ['CuiPreviewForm', '预览中某个界面的表单数据：title、text、buttons。'],
            ['CuiScreen', '配置中的一个界面：返回根控件的函数，或 { build, routed }。'],
            ['TextMetrics', 'measureText() 的结果：lines、width、height。'],
            ['LengthLike', '数字（像素）或 Length。'],
            ['ExprLike', '表达式，或字符串、数字、布尔等字面值。'],
            ['TextAlign', "文字对齐：'left'、'center'、'right'。"],
            ['InlineIconSize', '行内图标的尺寸：8 或 16。'],
            ['GlyphIconOptions', 'GlyphSheet.icon() 的选项。'],
            ['ServerFormOptions', 'serverForm() 的选项。'],
            ['ServerFormPanel', 'serverForm() 中的一个界面：panelId、content、routed。'],
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
        ['bedrock-cui/runtime/server-pages', 'src/runtime/serverPages.ts', [
            ['服务端翻页', [
                ['ServerPagesForm', '按路由表打开服务端表单并处理翻页。'],
                ['lockCamera', '锁定或解除玩家的视角。'],
            ]],
            ['类型', [['ServerPaging', '一个界面的翻页路由表。'], ['ServerArrowRoute', '路由表中的一个翻页箭头。'], ['FormButtonSpec', 'setButtons() 中的一个按钮：文字，或 { text, icon }。']]],
        ]],
    ] },
    { file: 'api-web.md', title: 'bedrock-cui/web', intro: '浏览器预览。', modules: [['bedrock-cui/web', 'src/web/index.ts', [
        ['预览', [
            ['mountPreview', '在网页元素中按游戏的规则绘制界面。'],
            ['ServerPagesPreview', '在预览中模拟服务端翻页。'],
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
const INTERNAL = new Set(['BEDROCK_COLORS', 'BOLD_EXTRA', 'Effect', 'Flex', 'GLYPH_HEIGHT', 'GLYPH_TOP', 'NBSP_BREAK_WIDTH', 'NO_LINE_END', 'NO_LINE_START', 'PLAIN', 'SCROLLBAR',
    'activeEffect', 'applyCode', 'asBool', 'batch', 'batchKey', 'boldExtra', 'buttonPayload', 'charWidth', 'compileExpr', 'drawOrder', 'evalExpr', 'evalOffset', 'evalTerms', 'finalize',
    'findBox', 'isAscii', 'isExpr', 'isOptions', 'isWide', 'layout', 'layoutInline', 'lineWidth', 'lintLayout', 'lit', 'parseRich', 'parseSize', 'ref', 'registerGlyphWidth', 'richWidth',
    'stripFormat', 'styleCodes', 'unifontWidth', 'unregisterGlyph', 'usesChildren', 'usesSelf', 'usesUnifont', 'variable', 'walk', 'wrapDetailed',
    'buttonTextOf', 'buttonIconOf',
    'decodePng', 'downscaleIcon', 'encodePng', 'inkOf', 'pngSize', 'runtimeFiles', 'drawText', 'PixelFonts',
    // 排版、编译与表达式内部的数据结构
    'SizeJson', 'AnchorName', 'Dyn', 'RGB', 'Intrinsic', 'RNode', 'Source', 'Op', 'ExprNode', 'Value', 'CompiledExpr', 'EvalEnv', 'TextureMeta', 'RunStyle', 'Run',
    'Unit', 'Term', 'SizeSpec', 'UnitContext', 'Rect', 'Edges', 'Scope', 'LayoutEnv', 'Box', 'CompileResult', 'ServerFormFiles', 'TextPiece',
    // 早期参数对象写法的类型（已弃用，面向对象写法不需要）
    'LayoutOptions', 'StackOptions', 'GridOptions', 'ImageOptions', 'LabelOptions', 'ButtonOptions', 'ToggleOptions', 'CollectionItemOptions', 'RawOptions',
    'FormGateOptions', 'FormButtonOptions', 'PagesOptions', 'ParagraphOptions', 'TextOptions'])

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
