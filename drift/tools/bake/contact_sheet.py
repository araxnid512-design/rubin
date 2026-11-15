#!/usr/bin/env python3
"""Обзорные листы запечённых спрайтов → drift/docs/art/.

  python3 drift/tools/bake/contact_sheet.py            # все персонажи + лист дронов/турелей
  python3 drift/tools/bake/contact_sheet.py hero pirate

Персонаж: все 8 направлений клипов idle / walk / attack (строка — направление, 0 = к зрителю) и столбец
нормалей первого кадра idle. Красный крестик — точка привязки (anchor из json).
"""
import json
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SPR = os.path.join(ROOT, 'assets', 'sprites')
OUT = os.path.join(ROOT, 'docs', 'art')
BG = (78, 84, 92, 255)
GRID = (64, 69, 76, 255)
TXT = (255, 230, 120, 255)
DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']


def load(name):
    d = os.path.join(SPR, name)
    meta = json.load(open(os.path.join(d, name + '.json'), encoding='utf-8'))
    return d, meta


def cross(dr, x, y, c=(255, 40, 40, 255)):
    dr.line([x - 3, y, x + 3, y], fill=c)
    dr.line([x, y - 3, x, y + 3], fill=c)


def character(name, clips=('idle', 'walk', 'attack')):
    d, meta = load(name)
    fw, fh = meta['frame_w'], meta['frame_h']
    ax, ay = meta['anchor']
    dirs = meta.get('dirs', 8)
    blocks = []
    for c in clips:
        if c in meta['clips']:
            blocks.append((c, Image.open(os.path.join(d, c + '.png')).convert('RGBA'), meta['clips'][c]['frames']))
    nrm = Image.open(os.path.join(d, 'idle_n.png')).convert('RGBA') if 'idle' in meta['clips'] else None
    gap, head, left = 10, 34, 28
    W = left + sum(f * fw + gap for _, _, f in blocks) + (fw + gap if nrm else 0)
    H = head + dirs * fh + 4
    sheet = Image.new('RGBA', (W, H), BG)
    dr = ImageDraw.Draw(sheet)
    dr.text((4, 4), f'{name}  ({fw}x{fh}, anchor {ax},{ay}, {meta.get("fps", 12)} fps)', fill=TXT)
    for r in range(dirs):
        dr.text((4, head + r * fh + fh // 2 - 6), DIRS[r] if dirs == 8 else str(r), fill=TXT)
    x = left
    for c, im, frames in blocks:
        dr.text((x, head - 13), f'{c} ({frames} frames)', fill=TXT)
        for r in range(dirs):
            for f in range(frames):
                px, py = x + f * fw, head + r * fh
                dr.rectangle([px, py, px + fw - 1, py + fh - 1], outline=GRID)
                cross(dr, px + ax, py + ay)
        sheet.alpha_composite(im.crop((0, 0, frames * fw, dirs * fh)), (x, head))
        x += frames * fw + gap
    if nrm:
        dr.text((x, head - 13), 'idle normal', fill=TXT)
        sheet.alpha_composite(nrm.crop((0, 0, fw, dirs * fh)), (x, head))
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'sheet_{name}.png')
    sheet.convert('RGB').save(path, optimize=True)
    print('→', path)


def props(names):
    rows = []
    for n in names:
        if not os.path.isdir(os.path.join(SPR, n)):
            continue
        d, meta = load(n)
        for c, info in meta['clips'].items():
            rows.append((n, c, d, meta, info))
    if not rows:
        return
    fw = 128
    W = 28 + 16 * fw * 2 // 2 + 10
    H = 6 + len(rows) * (fw + 16) * 2
    sheet = Image.new('RGBA', (W, H), BG)
    dr = ImageDraw.Draw(sheet)
    y = 6
    for n, c, d, meta, info in rows:
        dr.text((4, y), f'{n}/{c}  ({info.get("dirs", meta["dirs"])} dirs, top: color, bottom: normal)', fill=TXT)
        y += 14
        im = Image.open(os.path.join(d, c + '.png')).convert('RGBA')
        nm = Image.open(os.path.join(d, c + '_n.png')).convert('RGBA')
        k = im.size[1] // meta['frame_h']
        ax, ay = meta['anchor']
        for src, yy in ((im, y), (nm, y + fw)):
            for i in range(k):
                px = 28 + i * fw
                dr.rectangle([px, yy, px + fw - 1, yy + fw - 1], outline=GRID)
                cross(dr, px + ax, yy + ay)
                sheet.alpha_composite(src.crop((0, i * fw, fw, i * fw + fw)), (px, yy))
        y += 2 * fw + 2
    sheet = sheet.crop((0, 0, W, y))
    path = os.path.join(OUT, 'sheet_props.png')
    sheet.convert('RGB').save(path, optimize=True)
    print('→', path)


if __name__ == '__main__':
    names = sys.argv[1:]
    if not names:
        names = sorted(n for n in os.listdir(SPR) if os.path.isfile(os.path.join(SPR, n, n + '.json')))
    chars, other = [], []
    for n in names:
        _, meta = load(n)
        (chars if meta.get('kind') == 'character' else other).append(n)
    for n in chars:
        character(n)
    props(other)
