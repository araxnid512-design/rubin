#!/usr/bin/env python3
"""Сборка «Линии снабжения» для публикации страницей: index.html без обёртки + список файлов (модули, данные JSON, модели GLB).
Использование: python3 tools/build_artifact.py <папка-вывода>"""
import json, os, re, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist')
os.makedirs(out, exist_ok=True)
src = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*', '', head); head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head)
head = head.replace(' media="print" onload="this.media=\'all\'"', '')
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(head.strip() + '\n' + body.strip() + '\n')
files = {f: os.path.join(root, f) for f in ['main.js', 'ui.js', 'style.css']}
for d in ['engine', 'sim', 'world', 'data', 'assets', 'assets/models']:
    if not os.path.isdir(os.path.join(root, d)): continue
    for f in sorted(os.listdir(os.path.join(root, d))):
        if f.endswith(('.js', '.json', '.css', '.glb')) and f != 'tripo_state.json': files[f'{d}/{f}'] = os.path.join(root, d, f)
json.dump(files, open(os.path.join(out, 'files.json'), 'w'), ensure_ascii=False)
print(len(files), 'files')
