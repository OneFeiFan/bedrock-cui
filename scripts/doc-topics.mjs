/**
 * 手册的主题归属表：每个接口、概念在指南中由哪一页（哪一节）介绍。
 * scripts/audit-docs.mjs 按它检查「读到之前就提到却没有链接」与「同一主题在多处讲」。新增公开接口或改了章节时同步修改。
 */
export const TOPICS = {
    // 控件（搭建界面）
    Panel: 'elements.md#控件', Image: 'images.md#image', Label: 'text.md#label', Paragraph: 'text.md#paragraph',
    Text: 'text.md#文字中的图标', InlineIcon: 'text.md#文字中的图标', TextStyle: 'text.md#label',
    Stack: 'elements.md#控件', Row: 'layout.md#弹性布局', Column: 'layout.md#弹性布局', Grid: 'elements.md#控件',
    Scroll: 'scroll.md#scroll', Toggle: 'tabs.md#单个开关toggle', Raw: 'components/raw.md',
    // 值类型
    Size: 'layout.md#尺寸', Length: 'layout.md#尺寸', Anchor: 'layout.md#锚点与偏移', Insets: 'layout.md#内边距',
    Justify: 'layout.md#弹性布局', Align: 'layout.md#弹性布局', Color: 'images.md#颜色与透明度', Texture: 'images.md#image',
    // 界面文件
    defineUI: 'screens.md', defineConfig: 'screens.md#登记界面', Page: 'screens.md#页面函数', Item: 'props.md#声明',
    Button: 'logic.md#按钮与方法', Close: 'logic.md#生命周期', Router: 'pages.md#写法', Tabs: 'tabs.md#tabs',
    Link: 'pages.md#跳转', Back: 'pages.md#跳转', Prev: 'pages.md#跳转', Next: 'pages.md#跳转',
    Anim: 'animation.md', Timer: 'timers.md', ProgressBar: 'timers.md', toggleState: 'bindings.md#开关的状态',
    GlyphSheet: 'glyph-icons.md',
    // 脚本与运行期文字
    softWrap: 'text.md#运行期文字', wrapText: 'text.md#运行期文字', preWrap: 'text.md#运行期文字', paginate: 'text.md#运行期文字',
    autoSpace: 'text.md#运行期文字', textWidth: 'text.md#运行期文字', copyRuntime: 'runtime.md#不使用-sapdon-时',
    setMetricsProfile: 'cross-platform.md#字宽档案', withMetricsProfile: 'cross-platform.md#字宽档案',
    // 工具
    useSapdon: 'sapdon.md', CuiApp: 'lint.md#检查时机', checkScripts: 'packaging.md#脚本的类型检查',
    mountPreview: 'preview.md#在网页中嵌入预览', runScreenInBrowser: 'preview.md#在网页中嵌入预览', signal: 'preview.md#在网页中嵌入预览',
    renderHtml: 'web-output.md', Html: 'web-output.md',
}
