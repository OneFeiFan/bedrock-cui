import { defineConfig } from 'bedrock-cui'
import { buildBook, FORM, GLYPHS } from './ui/toggle-book.mjs'
import { buildResponsiveDemo, RESPONSIVE_FORM } from './ui/responsive-demo.mjs'
import propsDemo from './ui/props-demo.screen.mjs'
import animLab from './ui/anim-lab.screen.mjs'
import progressLab from './ui/progress-lab.screen.mjs'
import measureLab from './ui/measure-lab.screen.mjs'
import compareLab from './ui/compare-lab.screen.mjs'
import timerLab from './ui/timer-lab.screen.mjs'
import pagesLab from './ui/pages-lab.screen.mjs'

export default defineConfig({
    namespace: 'cui_toggle_test',
    screens: {
        [FORM.title]: () => buildBook(),                       // 测试书（静态界面、混合翻页）
        [RESPONSIVE_FORM.title]: () => buildResponsiveDemo(),  // 响应式演示
        [propsDemo.id]: propsDemo,                             // 界面文件：props 与按钮
        [animLab.id]: animLab,                                 // 动画实验（客户端自己播放）
        [progressLab.id]: progressLab,                         // 进度实验（数值绑定）
        [measureLab.id]: measureLab,                           // 测量实验（绑定的单位与运算）
        [compareLab.id]: compareLab,                           // 比较运算实验
        [timerLab.id]: timerLab,                               // 计时实验（ProgressBar、Countdown）
        [pagesLab.id]: pagesLab,                               // 页面实验（link / next / prev / back）
    },
    // res：测试书自己的贴图（进资源包）；vanilla：原版贴图（预览与字形图用，不进资源包，fetch-vanilla-textures 下载）
    textures: ['res', 'vanilla'],
    glyphs: [GLYPHS],
    preview: { viewport: [320, 220] },
})
