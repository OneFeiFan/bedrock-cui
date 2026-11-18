/**
 * bedrock-cui 的底层接口（bedrock-cui/internal）：框架内部、测试包与单元测试使用，不出现在手册中，也不保证稳定——
 * 随时可能改动或删除。界面请用界面文件（defineUI）编写：数据用 props，按钮用 new Button().onClick()，多页用 Router，客户端切换用 Tabs。
 */
export { form, propIndices, hasRefs, _registerFormButtonFactory } from './core/expr.js'
export { CollectionItem, _snapshot } from './core/element.js'
export * from './components/form.js'
export { Pages } from './components/pages.js'
export * from './mc/serverForm.js'
export { buttonTextOf, buttonIconOf, arrowTag, STAY_TAG, pageTitle, pagingButtons, pagingResponse, type FormButtonSpec } from './core/serverPagesShared.js'
export { ServerPagesPreview } from './web/serverPages.js'
export { ScreenButton, type ButtonSlot } from './core/screen.js'
