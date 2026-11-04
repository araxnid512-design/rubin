#!/usr/bin/env python3
"""Движение по тексту в Tripo Studio и перенос его на модель со скелетом (CI «Tripo (аккаунт)», задания вида
{"id": "...", "py": "scripts/tripo-motion.py", "args": ["<project-id>", "<описание движения>", "<секунд>", "out/<файл>.glb"]}).

Программа tripo (CLI 0.8.1) умеет только готовые движения (preset:biped:*). Движение по тексту делает сам Studio:
POST /motion/generate {segments: [{duration_seconds, prompt}]} → task_id, опрос /motion/get_task → asset_id;
перенос на модель — /operation/retarget_model {project_id, model_version: 'default', rig_type: 'biped',
motion_asset_id}; выгрузка — /operation/export {project_id, format: 'GLB', animations: [<id переноса>]} и
/operation/download_with_name. Вход — тот же, что у программы tripo после входа по аккаунту: её токен (JWT) из
файлов в домашней папке, заголовки как у неё (Authorization: Bearer …, Origin studio.tripo3d.ai). Токен в журнал
не пишется.
"""
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = "https://api.tripo3d.ai/v2/studio"


def token():
    home = Path.home()
    best = None
    for p in home.rglob("*"):
        s = str(p)
        if not p.is_file() or "tripo" not in s.lower() or "/node_modules/" in s or "/.npm/" in s or p.stat().st_size > 2_000_000:
            continue
        try:
            text = p.read_text(errors="ignore")
        except OSError:
            continue
        for m in re.finditer(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+", text):
            t = m.group(0)
            if best is None or len(t) > len(best):
                best = t
    if not best:
        raise SystemExit("нет токена программы tripo — вход не выполнен")
    return best


TOKEN = None


def api(method, path, body=None, raw_url=None):
    url = raw_url or BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {TOKEN}", "Origin": "https://studio.tripo3d.ai", "Referer": "https://studio.tripo3d.ai/",
        "Content-Type": "application/json", "User-Agent": "tripo-cli/0.8.1",
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = r.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} → HTTP {e.code}: {e.read()[:400].decode(errors='ignore')}")
    if raw_url:
        return out
    j = json.loads(out)
    if isinstance(j, dict) and j.get("code") not in (0, None):
        raise SystemExit(f"{method} {path} → {j.get('code')}: {j.get('message')} {j.get('suggestion', '')}")
    return j


def progress(task_id, timeout=1500):
    t0 = time.time()
    while time.time() - t0 < timeout:
        j = api("GET", f"/progress/{task_id}")
        d = j.get("data") or {}
        st = d.get("status") or (d[0].get("status") if isinstance(d, list) and d else None)
        print(f"  {task_id[:8]}: {st} {d.get('progress', '') if isinstance(d, dict) else ''}", flush=True)
        if st in ("success", "completed", "done"):
            return d
        if st in ("failed", "cancelled", "banned", "expired"):
            raise SystemExit(f"задача {task_id} — {st}: {json.dumps(d)[:400]}")
        time.sleep(5)
    raise SystemExit(f"задача {task_id} не закончилась за {timeout} с")


def first_id(d, *keys):
    if isinstance(d, dict):
        for k in keys:
            if d.get(k):
                return d[k]
        for v in d.values():
            r = first_id(v, *keys)
            if r:
                return r
    if isinstance(d, list):
        for v in d:
            r = first_id(v, *keys)
            if r:
                return r
    return None


def main():
    global TOKEN
    project, prompt, seconds, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    TOKEN = token()
    print(f"движение: «{prompt}», {seconds} с → проект {project}", flush=True)
    gen = api("POST", "/motion/generate", {"segments": [{"duration_seconds": seconds, "prompt": prompt}]})
    print("motion/generate:", json.dumps(gen.get("data"))[:300], flush=True)
    task = first_id(gen.get("data"), "task_id")
    asset = first_id(gen.get("data"), "asset_id")
    t0 = time.time()
    while not asset:
        if time.time() - t0 > 900:
            raise SystemExit("движение не сгенерировалось за 15 минут")
        time.sleep(6)
        t = api("POST", "/motion/get_task", {"task_id": task})
        d = t.get("data") or {}
        print(f"  движение: {d.get('status')} {d.get('progress', '')}", flush=True)
        if d.get("status") == "failed":
            raise SystemExit("генерация движения не удалась: " + json.dumps(d)[:300])
        asset = d.get("asset_id")
    print("asset_id:", asset, flush=True)
    rt = api("POST", "/operation/retarget_model", {"project_id": project, "model_version": "default", "rig_type": "biped", "motion_asset_id": asset})
    rid = first_id(rt.get("data"), "task_id", "operator_id", "id")
    print("retarget:", rid, flush=True)
    progress(rid)
    ex = api("POST", "/operation/export", {"model_version": "v3.1-20260211", "project_id": project, "format": "GLB", "name": Path(out).name, "animations": [rid]})
    eid = first_id(ex.get("data"), "task_id", "operator_id", "id")
    progress(eid, 600)
    dl = api("POST", "/operation/download_with_name", {"operator_id": eid, "file_name": Path(out).name})
    url = first_id(dl.get("data"), "url", "download_url", "model_url")
    if not url:
        raise SystemExit("нет ссылки на файл: " + json.dumps(dl.get("data"))[:300])
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_bytes(api("GET", "", raw_url=url))
    print(f"готово: {out} ({Path(out).stat().st_size / 1e6:.1f} МБ)", flush=True)


if __name__ == "__main__":
    main()
