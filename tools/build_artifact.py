#!/usr/bin/env python3
"""Сборка веб-версии для публикации как страницы: index.html без обёртки документа + список файлов модулей.
Использование: python3 tools/build_artifact.py <папка-вывода>"""
import json, os, re, shutil, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist')
os.makedirs(out, exist_ok=True)
src = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*', '', head)
head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head)
# на странице публикации шрифты Google доступны — обычная ссылка без встроенного обработчика onload
head = head.replace(' media="print" onload="this.media=\'all\'"', '')
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(head.strip() + '\n' + body.strip() + '\n')
files = {}
for d in ['engine', 'game', 'game/ui']:
    for f in sorted(os.listdir(os.path.join(root, d))):
        if f.endswith('.js'):
            files[f'{d}/{f}'] = os.path.join(root, d, f)
for f in ['main.js', 'style.css']:
    files[f] = os.path.join(root, f)
json.dump(files, open(os.path.join(out, 'files.json'), 'w'), ensure_ascii=False, indent=1)
print(len(files), 'files;', out)
