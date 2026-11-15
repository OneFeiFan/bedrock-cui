import * as sapdon from '@sapdon/core'
import { Label, Pages, Panel, Size } from 'bedrock-cui'
import { CuiApp } from 'bedrock-cui/node'

// 两页的小书：服务端翻页箭头 + 原地不动
const pages = new Pages('demo').startAt('p1').setSize(Size.full())
pages.page('p1').add(new Label('第 1 页'), pages.serverArrow('p1', 'p2', 'next', (h) => new Label(h ? '§e>' : '>'), 16, 12))
pages.page('p2').add(new Label('第 2 页'), pages.serverArrow('p2', 'p1', 'prev', (h) => new Label(h ? '§e<' : '<'), 16, 12))
const root = new Panel().setSize(200, 120).add(pages, pages.stayButton())

new CuiApp('cui_demo').screen('cui_ui:demo', root).useSapdon(sapdon)

// 提交所有注册
sapdon.registry.submit()
