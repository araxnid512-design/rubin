#!/usr/bin/env python3
"""Цепочка Tripo для «Мёртвого мира»: модель по тексту → (скелет → готовые движения) → файлы в out/.

Запускает исполнитель tools/tripo/runner.py (задание с полем "py"). Работает через программу tripo,
вошедшую по аккаунту Studio (кредиты сайта). Цены по замерам прошлого раза: модель — 25, скелет — 20,
готовые движения preset:* — 0 (тариф Premium), выгрузка — 0.

    python3 tools/tripo/chain.py --id kr --faces 10000 --rig biped \
        --anims "preset:biped:idle,preset:biped:walk" --anims "preset:biped:fall" --prompt "..."
    python3 tools/tripo/chain.py --id kr --pid <project-id> --rig biped --anims "..."   # без новой модели

Файлы: out/<id>.glb — модель (или выгрузка со скелетом), out/<id>_rig.glb, out/<id>_a.glb, _b.glb … —
движения, out/<id>.json — номер проекта и что сделано.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

OUT = Path("out")
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


def tripo(args, timeout=1800):
    print("$ tripo " + " ".join(a if len(a) < 80 else a[:77] + "..." for a in args), flush=True)
    try:
        p = subprocess.run(["tripo", *args], capture_output=True, text=True, timeout=timeout)
        out = (p.stdout + ("\n" + p.stderr if p.stderr.strip() else "")).strip()
        print(out[-1500:], flush=True)
        return p.returncode, out
    except subprocess.TimeoutExpired:
        print(f"превышено время ({timeout} с)", flush=True)
        return -1, ""


def project_id(out):
    # сначала — явное поле в ответе программы, затем — самый новый проект аккаунта
    for key in ("project_id", "projectId", "project"):
        m = re.search(r'"?' + key + r'"?\s*[:=]\s*"?(' + UUID + ')', out)
        if m:
            return m.group(1)
    code, lst = tripo(["project", "list", "--size", "1", "--output-format", "json"], timeout=120)
    try:
        return json.loads(lst)["projects"][0]["project_id"]
    except Exception:
        m = re.search(UUID, lst)
        return m.group(0) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--prompt")
    ap.add_argument("--pid")
    ap.add_argument("--faces", default="10000")
    ap.add_argument("--rig", default="")
    ap.add_argument("--anims", action="append", default=[])
    ap.add_argument("--texture-size", default="1024")
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    info = {"id": a.id, "steps": []}
    pid = a.pid
    if not pid:
        if not a.prompt:
            print("нет --prompt и --pid"); return 2
        code, out = tripo(["generate", "text", a.prompt, "--face-limit", a.faces, "--visibility", "private",
                           "--timeout", "25m", "--output-format", "json", "-o", str(OUT / f"{a.id}.glb")], timeout=1700)
        info["steps"].append(["generate", code])
        if code != 0:
            print("генерация не удалась"); Path(OUT / f"{a.id}.json").write_text(json.dumps(info, ensure_ascii=False)); return 1
        pid = project_id(out)
    info["pid"] = pid
    print(f"ПРОЕКТ {a.id}: {pid}", flush=True)
    if a.rig and pid:
        code, out = tripo(["process", "rig", pid, "--check", "--timeout", "10m"], timeout=900)
        info["steps"].append(["rigcheck", code])
        code, out = tripo(["process", "rig", pid, "--rig-type", a.rig, "--format", "glb", "--timeout", "20m",
                           "-o", str(OUT / f"{a.id}_rig.glb")], timeout=1500)
        info["steps"].append(["rig", code])
        if code == 0:
            # файл rig -o приходит без костей — скелет отдаёт только выгрузка с движением (готовые движения бесплатны)
            if not a.anims:
                a.anims = ["preset:biped:idle,preset:biped:walk"] if a.rig == "biped" else []
            for i, an in enumerate(a.anims):
                suf = "abcdefgh"[i]
                code, out = tripo(["process", "animate", pid, "--animations", an, "--rig-type", a.rig, "--timeout", "25m",
                                   "-o", str(OUT / f"{a.id}_{suf}.glb")], timeout=1700)
                info["steps"].append(["animate_" + suf, code, an])
    Path(OUT / f"{a.id}.json").write_text(json.dumps(info, ensure_ascii=False, indent=1))
    print(json.dumps(info, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
