#!/usr/bin/env python3
"""Забрать готовую модель по номеру задачи Tripo, если генерация прошла, а скачивание оборвалось (кредиты за неё
уже списаны, повторно не тратятся): tripo task get → ссылка на GLB в ответе → out/<имя>.glb.

    python3 tools/tripo/fetch_task.py <номер задачи> <имя>
"""
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path


def find_urls(x, out):
    if isinstance(x, dict):
        for k, v in x.items():
            if isinstance(v, str) and v.startswith("http"):
                out.append((k, v))
            else:
                find_urls(v, out)
    elif isinstance(x, list):
        for v in x:
            find_urls(v, out)


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    tid, name = sys.argv[1], sys.argv[2]
    p = subprocess.run(["tripo", "task", "get", tid, "--output-format", "json"], capture_output=True, text=True, timeout=180)
    txt = p.stdout.strip()
    try:
        d = json.loads(txt)
    except json.JSONDecodeError:
        d = {}
    urls = []
    find_urls(d, urls)
    if not urls:
        urls = [("", u) for u in re.findall(r'https://[^"\s]+', txt)]
    # предпочтение: модель с PBR, потом любая .glb
    pick = None
    for key in ("pbr_model", "model", "base_model"):
        for k, u in urls:
            if k == key:
                pick = u
                break
        if pick:
            break
    if not pick:
        for k, u in urls:
            if ".glb" in u.lower():
                pick = u
                break
    print("ключи ссылок:", [k for k, _ in urls])
    if not pick:
        print("ссылки на модель нет; ответ:", txt[:1500])
        return 1
    out = Path("out") / f"{name}.glb"
    out.parent.mkdir(exist_ok=True)
    with urllib.request.urlopen(pick, timeout=300) as r:
        out.write_bytes(r.read())
    print("скачано:", out, out.stat().st_size, "байт")
    return 0


if __name__ == "__main__":
    sys.exit(main())
