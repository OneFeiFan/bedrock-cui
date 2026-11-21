/**
 * 项目图标（像素画）：一块基岩上的游戏界面面板——bedrock-cui = 建在基岩版上的自定义界面。
 * 一个字符一个像素，PALETTE 是各字符的颜色（「.」透明）。全部是自己画的，没有使用原版贴图。
 *
 * - ICON_32：主图标（网站的大图标、README），放大时按整数倍放大，保持像素清晰；
 * - ICON_16：浏览器标签页用，手工简化（32 的缩小版在 16 像素下糊成一片）。
 *
 * 改了之后运行 node scripts/build-icon.mjs，更新 README 使用的 docs/icon.png（测试会核对两者一致）；网站的图标在构建时生成。
 */
export const PALETTE = {
    '#': [26, 26, 26],                                                           // 外框
    '1': [43, 43, 43], '2': [61, 61, 61], '3': [87, 87, 87], '4': [122, 122, 122],   // 基岩
    P: [198, 198, 198], H: [255, 255, 255], S: [85, 85, 85],                     // 面板：底色、亮边、暗边
    T: [139, 139, 139], t: [55, 55, 55], W: [255, 255, 255],                     // 文字栏、凹陷的暗边、字
    G: [91, 140, 58], h: [163, 224, 124], g: [47, 90, 30],                       // 绿色按钮
}

export const ICON_32 = [
    '################################',
    '#112122121211231124224131111312#',
    '#222111221221321223314123121232#',
    '#312222342212243122121113112312#',
    '#233312234111122112224222213333#',
    '#2212######################1111#',
    '#3114#HHHHHHHHHHHHHHHHHHHS#1221#',
    '#1112#HPPPPPPPPPPPPPPPPPPS#1313#',
    '#4224#HPtttttttttttttttHPS#1112#',
    '#1213#HPtTTTTTTTTTTTTTTHPS#1211#',
    '#3223#HPtTWTWTWTWTWTWTTHPS#1233#',
    '#1221#HPtTTTTTTTTTTTTTTHPS#1434#',
    '#1113#HPtHHHHHHHHHHHHHHHPS#2123#',
    '#1121#HPPPPPPPPPPPPPPPPPPS#2322#',
    '#2413#HPPPPPPPPPPPPPPPPPPS#4214#',
    '#1212#HPPPPPPPPPPPPPPPPPPS#3213#',
    '#3233#HPPPPPPPPPPPPPPPPPPS#3322#',
    '#2131#HPPPPPPP##########PS#2221#',
    '#2221#HPPPPPPP#hhhhhhhg#PS#1321#',
    '#1221#HPPPPPPP#hGGGGGGg#PS#1411#',
    '#2124#HPPPPPPP#hGGGGGGg#PS#2122#',
    '#1113#HPPPPPPP#hGGGGGGg#PS#4122#',
    '#3111#HPPPPPPP#hggggggg#PS#4323#',
    '#2213#HPPPPPPP##########PS#1142#',
    '#1122#HPPPPPPPPPPPPPPPPPPS#2112#',
    '#2412#HSSSSSSSSSSSSSSSSSSS#1241#',
    '#4123######################4212#',
    '#111332411244212231333321123113#',
    '#111214341112221222332131223111#',
    '#132124213241233311114242321341#',
    '#221211122111211132112221122114#',
    '################################',
]

export const ICON_16 = [
    '################',
    '#12222113114232#',
    '#21232321321132#',
    '#23##########42#',
    '#21#HHHHHHHS#21#',
    '#34#HSSSSSPS#13#',
    '#21#HPPPPPPS#24#',
    '#11#HPPPPPPS#32#',
    '#22#HPPhhhgS#42#',
    '#21#HPPhGGgS#23#',
    '#11#HPPhgggS#12#',
    '#31#HSSSSSSS#11#',
    '#32##########33#',
    '#11323111311222#',
    '#31143424313322#',
    '################',
]

/**
 * 按整数倍放大成 RGBA 像素：返回 { width, height, pixel(x, y) }。pad 为四周留白的像素数，padColor 为留白的颜色（缺省透明）
 */
export function iconImage(grid, scale = 1, pad = 0, padColor = null) {
    const n = grid.length, size = n * scale + pad * 2
    const pixel = (x, y) => {
        const gx = Math.floor((x - pad) / scale), gy = Math.floor((y - pad) / scale)
        if (gx < 0 || gy < 0 || gx >= n || gy >= n) return padColor ? [...padColor, 255] : null
        const c = PALETTE[grid[gy][gx]]
        return c ? [...c, 255] : (padColor ? [...padColor, 255] : null)
    }
    return { width: size, height: size, pixel }
}
