#!/usr/bin/env python3
"""Сборка «Линии снабжения» для публикации страницей: index.html без обёртки + список файлов (модули движка и игры, данные JSON).
Использование: python3 tools/build_frontline_artifact.py <папка-вывода>"""
import json, os, re, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist_frontline')
os.makedirs(out, exist_ok=True)
src = open(os.path.join(root, 'frontline', 'index.html'), encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*', '', head); head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head)
head = head.replace(' media="print" onload="this.media=\'all\'"', '').replace('href="style.css"', 'href="frontline/style.css"')
body = body.replace('src="main.js"', 'src="frontline/main.js"')
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(head.strip() + '\n' + body.strip() + '\n')
files = {}
for d in ['engine', 'frontline', 'frontline/sim', 'frontline/world', 'frontline/data']:
    for f in sorted(os.listdir(os.path.join(root, d))):
        if f.endswith(('.js', '.json', '.css')): files[f'{d}/{f}'] = os.path.join(root, d, f)
for f in ['input.js', 'follow_camera.js', 'fx.js', 'rig_human.js', 'weapons.js', 'items.js']:
    files[f'game/{f}'] = os.path.join(root, 'game', f)
json.dump(files, open(os.path.join(out, 'files.json'), 'w'), ensure_ascii=False)
print(len(files), 'files')
