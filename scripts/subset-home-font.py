#!/usr/bin/env python3
"""
手册首页的像素字体：从 GNU Unifont 中裁出首页用到的字（docs/site/home/index.html 的文字、ASCII 与数字），
写成 docs/site/home/fonts/unifont-home.woff2，并把收录的字写进 unifont-home.chars（构建网站时据此检查有没有缺字）。

    pip install fonttools brotli
    python3 scripts/subset-home-font.py [unifont-16.0.04.otf]

没有给字体文件时，从 unifoundry.com 下载 Unifont 16.0.04（SIL OFL 1.1 / GPLv2+ 双许可）。
"""
import os, re, sys, urllib.request
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.join(ROOT, 'docs', 'site', 'home')
URL = 'https://unifoundry.com/pub/unifont/unifont-16.0.04/font-builds/unifont-16.0.04.otf'

def home_chars():
    html = open(os.path.join(HOME, 'index.html'), encoding='utf-8').read()
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', html)
    return set(text) | {chr(c) for c in range(0x20, 0x7f)}

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HOME, 'fonts', 'unifont.otf')
    if not os.path.exists(src):
        print('下载', URL)
        urllib.request.urlretrieve(URL, src)
    chars = ''.join(sorted(c for c in home_chars() if c.strip() or c == ' '))
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts); sub.populate(text=chars); sub.subset(font)
    out = os.path.join(HOME, 'fonts', 'unifont-home.woff2')
    subset.save_font(font, out, opts)
    open(os.path.join(HOME, 'fonts', 'unifont-home.chars'), 'w', encoding='utf-8').write(chars)
    if src.endswith(os.path.join('fonts', 'unifont.otf')): os.remove(src)
    print(f'{len(chars)} 个字 → {out}（{os.path.getsize(out)} 字节）')

main()
