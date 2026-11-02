#!/usr/bin/env python3
"""Исполнитель заданий Tripo через официальную программу tripo (вход по аккаунту — кредиты сайта Studio).

Запускает CI .github/workflows/tripo-cli.yml после входа (tripo auth login). Задания берутся из ветки
tripo-control, файл jobs.json:
    {"jobs": [{"id": "hero", "args": ["generate", "text", "...", "--wait", "-o", "out/hero.glb"]}, ...],
     "stop": false}
Каждое задание — аргументы программы tripo (без оболочки), выполняется один раз. Файлы из out/ и журнал
выкладываются в ветку tripo-status (status/results.md, status/files/). Предел трат — TRIPO_BUDGET кредитов
от баланса на старте (по умолчанию 1000): дальше задания не выполняются.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

STATUS = Path("status")
FILES = STATUS / "files"
OUT = Path("out")
BUDGET = float(os.environ.get("TRIPO_BUDGET", "1000"))
MINUTES = float(os.environ.get("TRIPO_MINUTES", "90"))


def tripo(args, timeout=1800):
    try:
        p = subprocess.run(["tripo", *args], capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout + ("\n" + p.stderr if p.stderr.strip() else "")).strip()
    except subprocess.TimeoutExpired:
        return -1, f"превышено время ({timeout} с)"


def balance():
    code, out = tripo(["account", "balance"], timeout=120)
    nums = [float(x) for x in re.findall(r"(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])", out)]
    return (nums[0] if nums else None), out


def publish():
    subprocess.run(["bash", "scripts/tripo-publish.sh"], check=False)


def log(line):
    email = os.environ.get("TRIPO_EMAIL", "")
    if email:
        line = line.replace(email, "<почта>")
    with open(STATUS / "results.md", "a", encoding="utf-8") as f:
        f.write(line + "\n")
    print(line, flush=True)


_warned = set()
CTL = Path("/tmp/tripo-ctl")


def control():
    # отдельная копия только с веткой tripo-control: в клоне actions/checkout бывают битые ссылки на служебные
    # ветки (bad object refs/remotes/origin/tripo-code) — тогда любой fetch там падал и задания не читались
    token = os.environ.get("GH_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if not (CTL / ".git").exists():
        subprocess.run(["git", "init", "-q", str(CTL)], capture_output=True)
    url = f"https://x-access-token:{token}@github.com/{repo}.git"
    f = subprocess.run(["git", "-C", str(CTL), "fetch", "-q", "--depth=1", url, "tripo-control"], capture_output=True, text=True)
    p = subprocess.run(["git", "-C", str(CTL), "show", "FETCH_HEAD:jobs.json"], capture_output=True, text=True)
    if f.returncode != 0 or p.returncode != 0:
        msg = (f.stderr + p.stderr).strip()[:300]
        if token:
            msg = msg.replace(token, "***")
        if msg not in _warned:
            _warned.add(msg)
            log(f"jobs.json не прочитан: {msg}")
            publish()
        return {}
    try:
        return json.loads(p.stdout)
    except json.JSONDecodeError as e:
        log(f"jobs.json не разобран: {e}")
        return {}


def main():
    FILES.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(exist_ok=True)
    start, raw = balance()
    log(f"## Баланс на старте: {start}\n```\n{raw[:1500]}\n```")
    publish()
    done = set()
    deadline = time.time() + MINUTES * 60
    while time.time() < deadline:
        spec = control()
        # «стоп» — раньше заданий: иначе устаревший список (с прошлого запуска) выполнился бы заново и потратил кредиты
        if spec.get("stop"):
            log("\nСтоп по jobs.json — задания не выполняются")
            break
        for job in spec.get("jobs", []):
            jid = str(job.get("id"))
            if jid in done:
                continue
            done.add(jid)
            now, _ = balance()
            if start is not None and now is not None and start - now >= BUDGET:
                log(f"- {jid}: не выполнено — потрачено {start - now:g} из {BUDGET:g} кредитов")
                continue
            args = [str(a) for a in job.get("args", [])]
            t0 = time.time()
            log(f"\n### {jid}: tripo {' '.join(args)[:300]}")
            code, out = tripo(args, timeout=int(job.get("timeout", 1800)))
            after, _ = balance()
            spent = (now - after) if (now is not None and after is not None) else None
            log(f"код {code}, {time.time() - t0:.0f} с, кредитов {spent}\n```\n{out[-4000:]}\n```")
            for f in OUT.iterdir():
                if f.is_file():
                    shutil.copy2(f, FILES / f.name)
            publish()
        time.sleep(20)
    end, _ = balance()
    log(f"\n## Баланс в конце: {end} (потрачено {None if start is None or end is None else start - end})")
    publish()
    return 0


if __name__ == "__main__":
    sys.exit(main())
