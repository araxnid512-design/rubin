#!/usr/bin/env python3
"""Очередь движений врага для Tripo: стандартный набор (tools/tripo/enemy_motions.json) — в задания jobs.json.

    python3 tools/tripo/queue_motions.py [--file=ruber_motions.json] имя:project-id[,имя:project-id…] [метка метка …]

«имя» — имя модели в игре (stand/assets/models/<имя>.glb), project-id — номер проекта Tripo модели со скелетом
(поле pid в status/files/<задание>.json ветки tripo-status). Без меток ставится весь набор, с метками — только они
(повтор неудачного движения). Движение генерируется один раз и переносится на все перечисленные модели.
Скрипт только пишет задания и снимает stop — запуск по-прежнему отдельным шагом (правка start.txt и push), трата
записывается в budget.md вручную. Готовые файлы m_<имя>_<метка>.glb превращает в клипы
stand/tools/extract_anims.gd (→ stand/assets/anim/<имя>/<метка>.res).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    args = sys.argv[1:]
    src = "enemy_motions.json"
    if args[0].startswith("--file="):
        src = args.pop(0)[7:]            # другой набор движений (например ruber_motions.json)
    targets, tags = args[0], set(args[1:])
    motions = json.loads((HERE / src).read_text(encoding="utf-8"))["motions"]
    jobs_path = HERE / "jobs.json"
    j = json.loads(jobs_path.read_text(encoding="utf-8"))
    picked = [m for m in motions if not tags or m["tag"] in tags]
    j["jobs"] = [{"id": "ulm_" + targets.split(":")[0] + "_" + m["tag"], "py": "tools/tripo/motion.py",
                  "args": [targets, m["tag"], str(m["seconds"]), m["prompt"]], "timeout": 2400} for m in picked]
    j["stop"] = False
    jobs_path.write_text(json.dumps(j, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"заданий: {len(picked)}, кредитов примерно {len(picked) * 20}; моделей: {len(targets.split(','))}")


if __name__ == "__main__":
    main()
