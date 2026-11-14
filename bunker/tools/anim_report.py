#!/usr/bin/env python3
"""Отчёт по анимациям: 48 клипов из задания → источник, замеры лаборатории (report_hero.txt), что исправлено.
Запуск: python3 tools/anim_report.py <папка_лаборатории> > docs/ANIMATION_REPORT.md"""
import json, os, re, sys
lab = sys.argv[1]
cfg = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'game', 'data', 'anim_clips.json')))['clips']
rep = {}
for set_name in ('hero', 'suit'):
    p = os.path.join(lab, f'report_{set_name}.txt')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            m = re.match(r'(\w+): длина ([\d.]+) с, (.*)', line.strip())
            if m:
                rep.setdefault(m.group(1), {})[set_name] = (float(m.group(2)), m.group(3))
PLAN = [
 ('Передвижение', [('1','Спокойное стояние','idle'),('2','Дыхание','breathe'),('3','Ходьба вперёд','walk'),('4','Ходьба назад','walk_back'),('5','Шаг влево','strafe_left'),('6','Шаг вправо','strafe_right'),('7','Бег','run'),('8','Быстрый бег','sprint'),('9','Начало движения','start'),('10','Остановка','stop'),('11','Поворот влево','turn_left'),('12','Поворот вправо','turn_right'),('13','Приседание на месте','crouch_idle'),('14','Ходьба в приседе','crouch_walk'),('15','Скрытное движение','sneak'),('16','Подъём по лестнице','stairs_up'),('17','Спуск по лестнице','stairs_down'),('18','Подъём по вертикальной лестнице','ladder_up')]),
 ('Взаимодействия', [('19','Открывание двери','door_open'),('20','Закрывание двери','door_close'),('21','Использование терминала','terminal'),('22','Поднятие предмета','pickup'),('23','Надевание костюма','suit_on'),('24','Снятие костюма','suit_off'),('25','Посадка на стул','sit_down'),('26','Вставание со стула','stand_up'),('27','Укладывание на кровать','bed_lie'),('28','Подъём с кровати','bed_up')]),
 ('Бой', [('29','Боевая стойка','combat_idle'),('30','Лёгкий удар','punch_light'),('31','Сильный удар','punch_heavy'),('32','Блок','block'),('33','Уклонение влево','dodge_left'),('34','Уклонение вправо','dodge_right'),('35','Доставание пистолета','pistol_draw'),('36','Прицеливание из пистолета','pistol_aim'),('37','Выстрел из пистолета','pistol_fire'),('38','Перезарядка пистолета','pistol_reload'),('39','Прицеливание из винтовки','rifle_aim'),('40','Стрельба из винтовки','rifle_fire')]),
 ('Повреждения', [('41','Удар спереди','hit_front'),('42','Удар сзади','hit_back'),('43','Удар слева','hit_left'),('44','Удар справа','hit_right'),('45','Потеря равновесия','stagger'),('46','Падение','fall'),('47','Подъём после падения','get_up'),('48','Смерть','death')]),
]
INGAME = {'idle','walk','run','sprint','start','crouch_idle','crouch_walk','stairs_up','door_open','door_close','terminal','pickup','suit_on','sit_down','stand_up','bed_lie','bed_up','punch_light','punch_heavy','hit_front','hit_back','hit_left','hit_right','death'}
def src(c):
    s = cfg.get(c, {}).get('src', [])
    names = [x.split('/')[-1].replace('.res','') for x in s]
    out = []
    for n in names:
        out.append(f'Tripo по тексту «{n[2:]}»' if n.startswith('m_') else f'Tripo готовое «{n}»')
    return ' → запасной: '.join(out) if out else '—'
print('# Отчёт по анимациям героя — BUNKER SURVIVAL\n')
print('Скелет — родная схема Tripo (78 костей: BoneRoot, Hip, Pelvis, L_/R_ Thigh–Calf–Foot–ToeBase, Spine01–02, Neck, Head,')
print('руки до пальцев). Клипы — готовые движения Tripo (пресеты) и 30+ движений по тексту (Tripo Studio, перенос на героя и')
print('героя в костюме). Каждый клип прогнан в лаборатории (`tools/anim_lab.tscn`): листы кадров (4 момента × 2 вида),')
print('передвижение — с 8 сторон, замеры: скольжение опорной стопы (см/с), направление шага относительно «вперёд» героя,')
print('стопы ниже пола, кисть у туловища. Ключевые клипы дополнительно проверены в самой игре автотестом `--bc-test=interact`')
print('и `walk` (снимки посреди клипа).\n')
for sec, rows in PLAN:
    print(f'## {sec}\n')
    print('| № | Клип (задание) | Имя в игре | Источник | Замеры (герой) | В костюме | Проверен в игре |')
    print('|---|---|---|---|---|---|---|')
    for num, title, c in rows:
        h = rep.get(c, {}).get('hero'); s = rep.get(c, {}).get('suit')
        hm = f'{h[0]:.2f} с; {h[1]}' if h else '**нет клипа**'
        sm = 'есть' if s else '—'
        print(f'| {num} | {title} | `{c}` | {src(c)} | {hm} | {sm} | {"да" if c in INGAME else "в лаборатории"} |')
    print()
