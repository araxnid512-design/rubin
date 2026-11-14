#!/usr/bin/env python3
"""Правки game/data/anim_clips.json по итогам проверки анимаций (docs/anim_qa/README.md).
Запуск из папки bunker/: python3 tools/anim_config_update.py
Формат файла сохраняется (json, отступ 1, как у прежних правок)."""
import json
from pathlib import Path

P = Path("game/data/anim_clips.json")
d = json.loads(P.read_text())
c = d["clips"]


def clip(name, src, loop=False, blend=0.3, **kw):
    e = {"src": src, "loop": loop, "inplace": False, "blend": blend, "rate": 1.0}
    e.update(kw)
    c[name] = e


# --- передвижение: скорость по подошве (середина опоры), фаза — постановка левой стопы, число двойных шагов ---
c["walk"].update({"speed": 1.16, "phase": 0.867, "strides": 2.0, "root_smooth": 1.167})
c["run"].update({"speed": 4.22, "phase": 0.233, "strides": 2.0, "root_smooth": 0.625})
c["sprint"]["speed"] = 2.43
c["walk_back"]["speed"] = 1.48
c["strafe_left"]["speed"] = 1.68
c["strafe_right"]["speed"] = 1.32
c["sneak"]["speed"] = 1.2
# стойки: тело над капсулой (среднее смещение таза — в ноль)
for n in ["idle", "breathe", "crouch_idle", "combat_idle"]:
    c[n]["center"] = True
# стык цикла присяда на месте (скачок 5.7 см) — сглаживание последних 0.4 с к первому кадру
c["crouch_idle"]["loop_fix"] = 0.4
# клипы «на ногах»: стопы ставятся и фиксируются IK и во время разового клипа
for n in ["start", "stop", "turn_left", "turn_right", "inspect", "terminal", "door_open", "door_close"]:
    c[n]["ik"] = True
# переходы: попадания и потеря равновесия кончаются не в стойке — смешивание дольше
for n in ["hit_front", "hit_back", "hit_left", "hit_right"]:
    c[n]["blend"] = 0.18
c["stagger"]["blend"] = 0.25
c["death"]["blend"] = 0.15
c["punch_light"]["blend"] = 0.15
c["punch_heavy"]["blend"] = 0.15

# старт и остановка: клипы Tripo бракованные (старт — сгорбленный, ноги в воздухе; остановка stop2 — глубокий присед),
# в жанре их обычно и нет: передвижение сразу смешивается со стойкой за 0.2 с. Клипы остаются в библиотеке
# (лаборатория их проверяет), игра их не запускает, пока не придёт исправная замена (stop3, start2)
c["start"]["off"] = True
c["stop"]["off"] = True
# оружие ближнего боя (просьба основной сессии): клипы придут из Tripo; нет файла — клип просто не собирается
c["melee_light"] = {"src": ["{set}/m_melee_light.res"], "loop": False, "inplace": False, "blend": 0.12, "rate": 1.0}
c["melee_heavy"] = {"src": ["{set}/m_melee_heavy.res"], "loop": False, "inplace": False, "blend": 0.15, "rate": 1.0}
c["dodge_back"] = {"src": ["{set}/m_dodge_back.res"], "loop": False, "inplace": False, "blend": 0.12, "rate": 1.0}
# сидя: стопы на полу — IK держит их на полу и не даёт уйти под пол (замер: −4.5 см)
for n in ["sit_down", "stand_up", "sit_idle"]:
    c[n]["ik"] = True

# встать со стула и с кровати: у клипов Tripo начальная поза не совпадает с конечной позой посадки
# (стул — 46 см, кровать — 2.3 м: тело «перелетало» за 0.25 с). Вставание — посадка задом наперёд:
# начинается ровно в позе «сидит/лежит». Прежние клипы — запасные (если нет исходника посадки).
c["stand_up"]["src"] = ["{set}/m_sit_down.res", "{set}/m_stand_up.res"]
c["stand_up"]["reverse"] = True
c["bed_up"]["src"] = ["{set}/m_bed_lie.res", "{set}/m_bed_up.res"]
c["bed_up"]["reverse"] = True
c["punch_light"]["blend"] = 0.2
c["punch_heavy"]["blend"] = 0.2

# --- эмоции (готовые движения Tripo — бесплатно; движения по тексту — 20 кредитов каждое) ---
E = dict(blend=0.3, ik=True)
clip("greet", ["{set}/greet_01.res"], **E)
clip("wave", ["{set}/wave_goodbye_01.res"], **E)
clip("agree", ["{set}/agree.res"], **E)
clip("clap", ["{set}/clap.res"], **E)
clip("cheer", ["{set}/cheer.res"], **E)
clip("afraid", ["{set}/afraid.res"], **E)
clip("scared", ["{set}/scared_01.res"], **E)
clip("angry", ["{set}/angry_01.res"], **E)
clip("frustrated", ["{set}/frustrated_01.res"], **E)
clip("laugh", ["{set}/laugh_01.res"], **E)
clip("cry", ["{set}/cry.res"], **E)
clip("depressed", ["{set}/depressed.res"], **E)
clip("scratch", ["{set}/scratch.res"], **E)
clip("look_around", ["{set}/look_around.res"], **E)
clip("cough", ["{set}/m_cough.res"], **E)
clip("stretch", ["{set}/m_stretch.res"], **E)
clip("nod", ["{set}/m_nod.res"], **E)
clip("talk", ["{set}/m_talk.res"], **E)
clip("check_dosimeter", ["{set}/m_check_dosimeter.res"], **E)

P.write_text(json.dumps(d, ensure_ascii=False, indent=1))
print("клипов:", len(c))
