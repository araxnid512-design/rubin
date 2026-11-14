#!/usr/bin/env python3
"""Журнал трат Tripo для BUNKER SURVIVAL: из протокола сборки (ветка tripo-status, results.md) — таблица
операций: что делали, сколько стоило, результат, файлы, остаток. Запуск:
  git show origin/tripo-status:results.md > /tmp/r.md && python3 tools/tripo_log.py /tmp/r.md > docs/TRIPO_LOG.md"""
import re, sys
text = open(sys.argv[1], encoding='utf-8').read()
start = None
m = re.search(r'Баланс на старте: ([\d.]+)', text)
if m:
    start = float(m.group(1))
rows = []
cur = None
for line in text.splitlines():
    h = re.match(r'### (bs\w+): (.*)', line)
    if h:
        cur = {'id': h.group(1), 'cmd': h.group(2)}
        continue
    r = re.match(r'код (-?\d+), (\d+) с, кредитов ([\d.]+|None)', line)
    if r and cur:
        cur['code'] = int(r.group(1)); cur['sec'] = int(r.group(2))
        cur['cost'] = float(r.group(3)) if r.group(3) != 'None' else 0.0
        rows.append(cur); cur = None
KIND = {'bs_': 'персонаж: модель + скелет + готовые движения', 'bsm': 'движение по тексту (перенос на героя и героя в костюме)', 'bsp': 'модель предмета'}
NAMES = {'bs_hero': 'Главный герой', 'bs_hero_suit': 'Герой в защитном костюме', 'bs_npc_eng': 'NPC: инженер', 'bs_npc_med': 'NPC: медик', 'bs_raider': 'Противник: мародёр'}
print('# Журнал Tripo — BUNKER SURVIVAL\n')
print('Кошелёк: Tripo Studio (аккаунт пользователя, тариф Premium), программа `tripo` 0.8.1 в GitHub Actions')
print('(`.github/workflows/tripo-dw.yml`, задания — `tools/tripo/jobs.json`). Кошелёк API (openapi.tripo3d.ai) — 0 кредитов,')
print('не использовался. Предел проекта — 3000 кредитов. Файлы результатов — ветка `tripo-status`, `status/files/`.\n')
print(f'Баланс на старте: **{start:g}**\n' if start else '')
print('| № | Операция | Что | Стоимость | Итог | Файлы | Остаток |')
print('|---|---|---|---|---|---|---|')
bal = start or 0
total = 0
for i, r in enumerate(rows, 1):
    bal -= r['cost']; total += r['cost']
    kind = KIND.get(r['id'][:3], '')
    name = NAMES.get(r['id'], r['id'].replace('bsm_', 'движение «').replace('bsp_', 'предмет «') + ('»' if r['id'][:3] in ('bsm', 'bsp') else ''))
    files = {'bs_': f"{r['id']}.glb, {r['id']}_a…d.glb", 'bsm': f"m_hero_{r['id'][4:]}.glb, m_suit_{r['id'][4:]}.glb", 'bsp': f"{r['id']}.glb"}[r['id'][:3]]
    ok = 'готово' if r['code'] == 0 else f"ошибка (код {r['code']})"
    print(f"| {i} | {kind} | {name} | {r['cost']:g} | {ok} | {files} | {bal:g} |")
print(f'\n**Итого потрачено: {total:g} кредитов** из разрешённых 3000 (остаток предела: {3000 - total:g}).')
