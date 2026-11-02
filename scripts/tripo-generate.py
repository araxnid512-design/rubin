#!/usr/bin/env python3
"""Генерация 3D-моделей в Tripo по списку tripo/models.json (запускает CI: .github/workflows/tripo-models.yml).

Ключ — из переменной окружения TRIPO_API_KEY (секрет репозитория; в код и логи не попадает).
Уже готовые модели (есть godot/assets/tripo/<id>.glb) не генерируются повторно — кредиты не тратятся.
За один запуск — не больше TRIPO_MAX_NEW новых моделей (по умолчанию 3), чтобы случайно не истратить кредиты.

Результат: godot/assets/tripo/<id>.glb (модель для игры), tripo/previews/<id>.<ext> (картинка от Tripo — чтобы
посмотреть модель без запуска игры), tripo/log.md (что сделано, сколько кредитов ушло, баланс до и после).
Нужен пакет tripo3d>=1.0 (официальный клиент Tripo, API v3).
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST = ROOT / "tripo" / "models.json"
OUT = ROOT / "godot" / "assets" / "tripo"
PREV = ROOT / "tripo" / "previews"
LOG = ROOT / "tripo" / "log.md"


def ext_of(url: str, default: str) -> str:
    name = url.split("?")[0].rsplit("/", 1)[-1]
    return os.path.splitext(name)[1] or default


async def main() -> int:
    key = os.environ.get("TRIPO_API_KEY", "").strip()
    if not key:
        print("TRIPO: нет ключа TRIPO_API_KEY в секретах репозитория — пропускаю")
        return 0
    from tripo3d import TripoClient, TaskStatus  # официальный клиент Tripo

    spec = json.loads(LIST.read_text(encoding="utf-8"))
    defaults = spec.get("defaults", {})
    max_new = int(os.environ.get("TRIPO_MAX_NEW", "3"))
    OUT.mkdir(parents=True, exist_ok=True)
    PREV.mkdir(parents=True, exist_ok=True)
    lines = [f"# Tripo: генерация {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}", ""]
    made = failed = 0
    async with TripoClient(api_key=key) as client:
        try:
            bal = await client.get_balance()
            lines.append(f"Баланс до: {bal.balance:g} (заморожено {bal.frozen:g})")
            print(f"TRIPO: баланс {bal.balance:g}")
        except Exception as e:  # ключ неверный или нет доступа
            lines.append(f"Баланс не получен: {e}")
            print(f"TRIPO: баланс не получен: {e}")
        lines.append("")
        for m in spec.get("models", []):
            mid = m["id"]
            target = OUT / f"{mid}.glb"
            if target.exists():
                lines.append(f"- {mid}: уже есть — пропущено")
                continue
            if made + failed >= max_new:
                lines.append(f"- {mid}: отложено (за запуск не больше {max_new})")
                continue
            params = {**defaults, **{k: v for k, v in m.items() if k not in ("id", "prompt")}}
            t0 = time.time()
            try:
                task_id = await client.text_to_model(prompt=m["prompt"], **params)
                print(f"TRIPO: {mid} → задача {task_id}")
                task = await client.wait_for_task(task_id, timeout=1200)
                if task.status != TaskStatus.SUCCESS:
                    raise RuntimeError(f"статус {task.status.value}: {task.error_code} {task.error_msg}")
                out = task.output
                url = out.model_url or out.model or out.pbr_model or out.base_model
                if not url:
                    raise RuntimeError("в ответе нет ссылки на модель")
                await client.download_file(url, target)
                if out.rendered_image:
                    await client.download_file(out.rendered_image, PREV / f"{mid}{ext_of(out.rendered_image, '.webp')}")
                size = target.stat().st_size / 1048576
                lines.append(f"- {mid}: готово за {time.time() - t0:.0f} с, {size:.1f} МБ, кредитов {task.credits_consumed}, задача {task_id}")
                print(f"TRIPO: {mid} готово ({size:.1f} МБ, кредитов {task.credits_consumed})")
                made += 1
            except Exception as e:
                failed += 1
                lines.append(f"- {mid}: ошибка — {e}")
                print(f"TRIPO: {mid} ошибка — {e}")
        try:
            bal = await client.get_balance()
            lines += ["", f"Баланс после: {bal.balance:g} (заморожено {bal.frozen:g})"]
        except Exception:
            pass
    lines += ["", f"Итого: готово {made}, ошибок {failed}", ""]
    old = LOG.read_text(encoding="utf-8") if LOG.exists() else ""
    LOG.write_text("\n".join(lines) + "\n" + old, encoding="utf-8")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
