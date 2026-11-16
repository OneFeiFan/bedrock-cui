import { defineConfig } from 'bedrock-cui'
import { buildBook, FORM, GLYPHS } from './ui/toggle-book.mjs'
import { buildResponsiveDemo, RESPONSIVE_FORM } from './ui/responsive-demo.mjs'
import propsDemo from './ui/props-demo.screen.mjs'
import animLab from './ui/anim-lab.screen.mjs'
import progressLab from './ui/progress-lab.screen.mjs'
import measureLab from './ui/measure-lab.screen.mjs'

export default defineConfig({
    namespace: 'cui_toggle_test',
    screens: {
        [FORM.title]: () => buildBook(),                       // 测试书（静态界面、混合翻页）
        [RESPONSIVE_FORM.title]: () => buildResponsiveDemo(),  // 响应式演示
        [propsDemo.id]: propsDemo,                             // defineScreen：props 与按钮（阶段 A）
        [animLab.id]: animLab,                                 // 动画实验（客户端自己播放）
        [progressLab.id]: progressLab,                         // 进度实验（数值绑定）
        [measureLab.id]: measureLab,                           // 测量实验（绑定的单位与运算）
    },
    // res：测试书自己的贴图（进资源包）；vanilla：原版贴图（预览与字形图用，不进资源包，fetch-vanilla-textures 下载）
    textures: ['res', 'vanilla'],
    glyphs: [GLYPHS],
    preview: { viewport: [320, 220] },
})
