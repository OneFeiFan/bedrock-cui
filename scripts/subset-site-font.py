#!/usr/bin/env python3
"""
手册网站的像素字体：从 GNU Unifont 中裁出网站用像素字体显示的文字——首页的文字、手册各页的标题、
侧栏（docs/guide/index.md）、网站界面上的固定文字（scripts/build-site.mjs、docs/site/site.js）与 ASCII，
写成 docs/site/fonts/unifont-site.woff2，并把收录的字写进 unifont-site.chars（构建网站时据此检查有没有缺字）。

    pip install fonttools brotli
    python3 scripts/subset-site-font.py [unifont-16.0.04.otf]

没有给字体文件时，从 unifoundry.com 下载 Unifont 16.0.04（SIL OFL 1.1 / GPLv2+ 双许可）。
"""
import glob, os, re, sys, urllib.request
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'docs', 'site')
GUIDE = os.path.join(ROOT, 'docs', 'guide')
URL = 'https://unifoundry.com/pub/unifont/unifont-16.0.04/font-builds/unifont-16.0.04.otf'

def text_of_html(html):
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    html = re.sub(r'<(script|style|pre)[^>]*>.*?</\1>', '', html, flags=re.S)
    return re.sub(r'<[^>]+>', ' ', html)

def site_chars():
    chars = set(text_of_html(open(os.path.join(SITE, 'home', 'index.html'), encoding='utf-8').read()))
    for f in glob.glob(os.path.join(GUIDE, '**', '*.md'), recursive=True):
        for line in open(f, encoding='utf-8'):
            if re.match(r'#{1,3} ', line): chars |= set(line)            # 各页的标题
        if f.endswith('index.md'): chars |= set(open(f, encoding='utf-8').read())   # 侧栏
    for f in [os.path.join(ROOT, 'scripts', 'build-site.mjs'), os.path.join(SITE, 'site.js')]:
        chars |= {c for c in open(f, encoding='utf-8').read() if ord(c) > 0x2e7f}   # 界面上的固定文字（中文）
    return chars | {chr(c) for c in range(0x20, 0x7f)} | set('，。：；、！？（）「」《》…—·')

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SITE, 'fonts', 'unifont.otf')
    if not os.path.exists(src):
        print('下载', URL)
        urllib.request.urlretrieve(URL, src)
    chars = ''.join(sorted(c for c in site_chars() if c.strip() or c == ' '))
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts); sub.populate(text=chars); sub.subset(font)
    out = os.path.join(SITE, 'fonts', 'unifont-site.woff2')
    subset.save_font(font, out, opts)
    open(os.path.join(SITE, 'fonts', 'unifont-site.chars'), 'w', encoding='utf-8').write(chars)
    if os.path.basename(src) == 'unifont.otf' and os.path.dirname(src) == os.path.join(SITE, 'fonts'): os.remove(src)
    print(f'{len(chars)} 个字 → {out}（{os.path.getsize(out)} 字节）')

main()
