#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка звуков оружия «Мёртвый мир: Плацдарм» (game/sfx/*.ogg) из НАСТОЯЩИХ записей:
только CC0 и общественное достояние (public domain). Список источников с адресами и лицензиями — SOURCES ниже,
что из чего собрано — OUT. Авторство пишется в game/sfx/CREDITS.md (--credits).

  python3 tools/sfx/build.py               # скачать исходники в tools/sfx/_cache и собрать всё
  python3 tools/sfx/build.py --only rifle_1,smg_2
  python3 tools/sfx/build.py --credits     # переписать game/sfx/CREDITS.md
  python3 tools/sfx/build.py --levels      # только измерить готовые файлы (пик, RMS)

Нужны: Python ≥ 3.8, ffmpeg с libvorbis; для архивов .7z — модуль py7zr (pip install py7zr) или программа 7z.
Скачанное — только данные: из архивов извлекаются лишь звуковые файлы, ничего из них не запускается.

Обработка (ffmpeg): из записи вырезается одиночный выстрел (с 4 мс до атаки), ближний микрофон смешивается
со средним (тот же ствол, запись «с середины стрельбища» даёт естественный хвост и эхо), моно 48 кГц,
срез НЧ-гула, обрезка хвоста, затухание, выравнивание громкости по RMS первых долей секунды
(у каждого класса — своя цель), лимитер на −1 дБFS, Ogg Vorbis 44,1 кГц.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTDIR = os.path.join(ROOT, 'game', 'sfx')
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_cache')
UA = 'sfx-build/1.0 (game sound credits tool)'
AUDIO_EXT = ('.wav', '.ogg', '.oga', '.flac', '.mp3', '.webm', '.ogv', '.aif', '.aiff')
SR = 48000      # рабочая частота
OUT_SR = 44100  # частота готовых файлов
PRE = 0.004     # запас до атаки, с

# ---------------------------------------------------------------------------------------------------------
# Источники. kind: file — сам звук, zip/7z — архив (member — путь внутри), video — дорожка из видео.
# ---------------------------------------------------------------------------------------------------------
OGA = 'https://opengameart.org/sites/default/files/'
SOURCES = {
    'ffsl': dict(kind='7z', url=OGA + 'Prepared%20SFX%20Library.7z',
                 page='https://opengameart.org/content/the-free-firearm-sound-library',
                 title='The Free Firearm Sound Library (Prepared SFX Library)',
                 author='команда The Free Firearm Sound Library (freefirearmsfx.com, Still North Media; Kickstarter 2013), '
                        'публикация на OpenGameArt — bart',
                 lic='CC0 1.0 («Our team holds CC0 NO RIGHTS RESERVED for this library»)', note='96 кГц, ближний («near») и средний («mid») микрофоны; настоящие АК-47, ППШ, '
                 'винтовка Мосина, SKS, AR-15, Springfield 1917, Tikka T3, 1911, Walther PPQ, Ruger Mark III, '
                 'Carl Gustav M45, Benelli Nova, Charles Daly, Winchester Model 12'),
    'springy': dict(kind='file', url=OGA + 'assaultriflereload1_0.wav',
                    page='https://opengameart.org/content/gun-reload-sounds', title='Gun reload sounds',
                    author='SpringySpringo', lic='CC0 1.0'),
    'springy2': dict(kind='file', url=OGA + 'gunreload1.wav',
                     page='https://opengameart.org/content/gun-reload-sounds', title='Gun reload sounds',
                     author='SpringySpringo', lic='CC0 1.0'),
    'starninjas': dict(kind='zip', url=OGA + 'gun_reload_-_starninjas.zip',
                       page='https://opengameart.org/content/2-gun-reloads', title='2 Gun Reloads',
                       author='StarNinjas', lic='CC0 1.0'),
    'bmac_clip': dict(kind='file', url=OGA + 'clipload1.wav',
                      page='https://opengameart.org/content/gun-reload-sound-effects', title='Gun Reload Sound Effects',
                      author='BMacZero', lic='CC0 1.0'),
    'zer0_sg': dict(kind='zip', url=OGA + 'shotgunsounds.zip',
                    page='https://opengameart.org/content/shotgun-reload-sound-effects',
                    title='Shotgun Reload Sound effects', author='zer0_sol', lic='CC0 1.0'),
    'lfa': dict(kind='file', url=OGA + 'equipment_clicks3.wav',
                page='https://opengameart.org/content/equipment-clicks-iii', title='equipment clicks III',
                author='LFA', lic='CC0 1.0', note='щелчки; по словам автора — затвор настоящей винтовки, степлер и рулетка'),
    'bmac_clink1': dict(kind='file', url=OGA + 'clink1_0.wav',
                        page='https://opengameart.org/content/metal-impact-sounds', title='Metal Impact Sounds',
                        author='BMacZero', lic='CC0 1.0'),
    'bmac_clink2': dict(kind='file', url=OGA + 'clink2.wav',
                        page='https://opengameart.org/content/metal-impact-sounds', title='Metal Impact Sounds',
                        author='BMacZero', lic='CC0 1.0'),
    'bmac_clink3': dict(kind='file', url=OGA + 'clink3.wav',
                        page='https://opengameart.org/content/metal-impact-sounds', title='Metal Impact Sounds',
                        author='BMacZero', lic='CC0 1.0'),
    'bmac_bing': dict(kind='file', url=OGA + 'bing1.wav',
                      page='https://opengameart.org/content/metal-impact-sounds', title='Metal Impact Sounds',
                      author='BMacZero', lic='CC0 1.0'),
    'rd75': dict(kind='zip', url=OGA + 'sfx_breaking_and_falling.zip',
                 page='https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx',
                 title='75 CC0 breaking / falling / hit sfx', author='rubberduck', lic='CC0 1.0'),
    'rd100': dict(kind='zip', url=OGA + '100-CC0-SFX_0.zip',
                  page='https://opengameart.org/content/100-cc0-sfx', title='100 CC0 SFX',
                  author='rubberduck', lic='CC0 1.0'),
    'rd100b': dict(kind='zip', url=OGA + 'sfx_100_v2.zip',
                   page='https://opengameart.org/content/100-cc0-sfx-2', title='100 CC0 SFX #2',
                   author='rubberduck', lic='CC0 1.0'),
    'qimp': dict(kind='7z', url=OGA + 'qubodupImpact.7z',
                 page='https://opengameart.org/content/impact', title='Impact',
                 author='qubodup (Iwan Gabovitch)', lic='CC0 1.0'),
    'qhits': dict(kind='7z', url=OGA + 'independent_nu_ljudbank-hits_and_punches.7z',
                  page='https://opengameart.org/content/37-hitspunches', title='37 hits/punches',
                  author='qubodup (independent.nu ljudbank)', lic='CC0 1.0'),
    'spring_rock': dict(kind='file', url=OGA + 'small_rock_impact.wav',
                        page='https://opengameart.org/content/various-sound-effects-0', title='Various Sound Effects',
                        author='Spring Spring', lic='CC0 1.0'),
    'joth': dict(kind='file', url=OGA + 'Chunky%20Explosion.mp3',
                 page='https://opengameart.org/content/chunky-explosion', title='Chunky Explosion',
                 author='Joth', lic='CC0 1.0'),
    # Видео с Викисклада: берётся перекодированная копия 480p (оригиналы по сотне мегабайт и выше);
    # звук в ней — Opus 48 кГц. Видео — работа военных США, общественное достояние.
    'c_yav': dict(kind='video',
                  url='https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f8/RPG_qual_at_Yavoriv_CTC_BROLL.ogv/'
                      'RPG_qual_at_Yavoriv_CTC_BROLL.ogv.480p.vp9.webm',
                  page='https://commons.wikimedia.org/wiki/File:RPG_qual_at_Yavoriv_CTC_BROLL.ogv',
                  title='RPG qual at Yavoriv CTC BROLL', author='Anthony Jones, U.S. Army (DVIDS 522778)',
                  lic='Public domain (работа федерального правительства США)',
                  note='звуковая дорожка без закадрового текста: стрельба из РПГ-7 (вышибной заряд и запуск двигателя)'),
    'c_cac': dict(kind='video',
                  url='https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7e/%28B-roll%29_CAC_Demo_Range.webm/'
                      '%28B-roll%29_CAC_Demo_Range.webm.480p.vp9.webm',
                  page='https://commons.wikimedia.org/wiki/File:(B-roll)_CAC_Demo_Range.webm',
                  title='(B-roll) CAC Demo Range', author='Cpl. Eric Tso, U.S. Marine Corps (DVIDS 709374)',
                  lic='Public domain (работа федерального правительства США)',
                  note='звуковая дорожка: полёт ракеты APOBS (44,9 с) и подрыв заряда разминирования (55,0 с)'),
    'c_pk': dict(kind='video',
                 url='https://upload.wikimedia.org/wikipedia/commons/transcoded/9/9c/'
                     'Marines_fire_foreign_weapons_as_part_of_pre-deployment_training_%28B-Roll%29.ogv/'
                     'Marines_fire_foreign_weapons_as_part_of_pre-deployment_training_%28B-Roll%29.ogv.480p.vp9.webm',
                 page='https://commons.wikimedia.org/wiki/File:Marines_fire_foreign_weapons_as_part_of_pre-deployment_training_(B-Roll).ogv',
                 title='Marines fire foreign weapons as part of pre-deployment training (B-Roll)',
                 author='U.S. Marine Corps (Lucas Hopkins), DVIDS 506875',
                 lic='Public domain (работа федерального правительства США)',
                 note='звуковая дорожка видео без закадрового текста: пулемёт ПК (7–24 с) и АК-47 (25–45 с)'),
}

# ---------------------------------------------------------------------------------------------------------
# Что собирать. L — слои: s — источник, f — файл (в архиве), t — атака, с; g — усиление, дБ; d — задержка, с;
# r — скорость (r<1 — ниже и длиннее); af — свои фильтры ffmpeg; n — взять от слоя не больше n секунд. len — длина, fade — затухание в конце,
# rms — цель RMS первых win секунд, дБFS; lim — потолок лимитера, дБFS; hp/lp — срезы, Гц.
# ---------------------------------------------------------------------------------------------------------
FF = {'ak': 'AK-47/C_28P.wav', 'akm': 'AK-47/C_31P.wav', 'sks': 'SKS/U_14P.wav', 'sksm': 'SKS/U_19P.wav',
      'ppsh': 'PPSh/P_30P.wav', 'ppshm': 'PPSh/P_16P.wav', 'cg': 'Carl Gustav M45/G_31P.wav', 'cgm': 'Carl Gustav M45/G_20P.wav',
      'ar': 'AR-15/D_32P.wav', 'arm': 'AR-15/D_24P.wav', 'mos': 'Mosin Nagant/M_21P.wav', 'mosm': 'Mosin Nagant/M_26P.wav',
      'spr': '1917/B_24P.wav', 'sprm': '1917/B_16P.wav', 'tik': 'Tikka/W_29P.wav', 'tikm': 'Tikka/W_24P.wav',
      'nova': 'Nova/O_21P.wav', 'novam': 'Nova/O_17P.wav', 'cd': 'CD/H_21P.wav', 'cdm': 'CD/H_16P.wav', 'm12': 'Model 12/K_22P.wav',
      'colt': '1911/A_42P.wav', 'coltm': '1911/A_34P.wav', 'ppq': 'Walther PPQ/X_39P.wav', 'ppqm': 'Walther PPQ/X_31P.wav',
      'rug': 'Ruger Mark III/R_35P.wav', 'rugm': 'Ruger Mark III/R_30P.wav'}


def F(k, t, g=0.0, d=0.0, r=1.0, af='', n=0):
    return dict(s='ffsl', f='Prepared SFX Library/' + FF[k], t=t, g=g, d=d, r=r, af=af, n=n)


def L(s, f, t=0.0, g=0.0, d=0.0, r=1.0, af='', n=0):
    return dict(s=s, f=f, t=t, g=g, d=d, r=r, af=af, n=n)


def shot(near, mid, len_, rms, mg=-5.0, fade=None, **kw):
    """Выстрел: ближний микрофон + средний (хвост и эхо стрельбища)."""
    lay = [near] + ([dict(mid, g=mid['g'] + mg)] if mid else [])
    return dict(L=lay, len=len_, fade=fade or len_ * 0.55, rms=rms, win=0.25, **kw)


def far(mid, len_, rms, **kw):
    """Дальний выстрел — только средний микрофон (для врагов на той стороне поля)."""
    return dict(L=[mid], len=len_, fade=len_ * 0.6, rms=rms, win=0.3, **kw)


SUPP_AF = 'lowpass=f=1500,lowpass=f=2400,equalizer=f=180:t=q:w=1:g=5'
HEAVY_AF = 'equalizer=f=90:t=q:w=1.2:g=5'
OUT = {
    # ППШ (7,62×25 ТТ) — настоящий ППШ. На среднем микрофоне ППШ стрелял короткими очередями —
    # берётся последний выстрел очереди (после него — только хвост и эхо)
    'smg_1': shot(F('ppsh', 0.968), F('ppshm', 5.371), 1.1, -19, mg=-7),
    'smg_2': shot(F('ppsh', 4.386), F('ppshm', 9.211), 1.1, -19, mg=-7),
    'smg_3': shot(F('ppsh', 8.242), F('ppshm', 13.117), 1.1, -19, mg=-7),
    'smg_f1': far(F('ppshm', 13.117), 1.2, -22),
    'smg_f2': far(F('ppshm', 5.371), 1.2, -22),
    # «Витязь» (9×19) — пистолет-пулемёт Carl Gustav M45 под тот же 9-мм патрон
    'smg9_1': shot(F('cg', 0.310), F('cgm', 0.346), 1.0, -19, mg=-1),
    'smg9_2': shot(F('cg', 3.500), F('cgm', 2.258), 1.0, -19, mg=-1),
    'smg9_f1': far(F('cgm', 5.266), 1.1, -23.5),
    # АК (7,62×39) — настоящий АК-47 и SKS под тот же патрон
    'rifle_1': shot(F('ak', 0.610), F('akm', 0.336), 1.25, -16),
    'rifle_2': shot(F('ak', 3.256), F('akm', 4.400), 1.25, -16),
    'rifle_3': shot(F('ak', 6.020), F('sksm', 2.614), 1.25, -16),
    'rifle_f1': far(F('akm', 0.336), 1.3, -21),
    'rifle_f2': far(F('sksm', 8.016), 1.3, -21),
    # АК-74М (5,45×39) — ближайшая настоящая запись того же класса: AR-15 (5,56×45)
    'ak2_1': shot(F('ar', 0.702), F('arm', 0.548), 1.2, -16.5),
    'ak2_2': shot(F('ar', 5.646), F('arm', 3.908), 1.2, -16.5),
    'ak2_f1': far(F('arm', 0.548), 1.3, -21.5),
    # СВД (7,62×54R) — винтовка Мосина под тот же патрон, длинный хвост
    'sniper_1': shot(F('mos', 1.032), F('mosm', 1.136), 2.0, -15, mg=-3, fade=1.2),
    'sniper_2': shot(F('mos', 5.018), F('mosm', 6.104), 2.0, -15, mg=-3, fade=1.2),
    'sniper_f1': far(F('mosm', 10.742), 2.0, -19.5),
    # ПКМ / ПКП — настоящий пулемёт ПК (видео морской пехоты США): последний выстрел очереди с её хвостом
    'lmg_1': dict(L=[L('c_pk', 'video', 18.737)], len=1.0, fade=0.6, rms=-16, win=0.25, hp=40),
    'lmg_2': dict(L=[L('c_pk', 'video', 20.683)], len=0.62, fade=0.4, rms=-16, win=0.25, hp=40),
    'lmg_3': dict(L=[L('c_pk', 'video', 12.748)], len=0.62, fade=0.4, rms=-16, win=0.25, hp=40),
    'lmg_f1': dict(L=[L('c_pk', 'video', 14.177)], len=0.9, fade=0.55, rms=-20.5, win=0.3, hp=40),
    # КСВК (12,7×108) — .30-06 (Springfield 1917), ниже на треть: крупный калибр
    'hsniper_1': shot(F('spr', 1.308, r=0.8, af=HEAVY_AF), F('sprm', 0.606, r=0.8, af=HEAVY_AF), 2.4, -14, mg=-3, fade=1.5),
    'hsniper_2': shot(F('spr', 6.730, r=0.78, af=HEAVY_AF), F('sprm', 5.970, r=0.78, af=HEAVY_AF), 2.4, -14, mg=-3, fade=1.5),
    'hsniper_f1': far(F('sprm', 0.606, r=0.8, af=HEAVY_AF), 2.4, -18.5),
    # «Корд» (12,7×108) — .30-06 (Tikka T3), ниже
    'hlmg_1': shot(F('tik', 0.576, r=0.8, af=HEAVY_AF), F('tikm', 0.754, r=0.8, af=HEAVY_AF), 1.4, -14.5, mg=-6, fade=0.8),
    'hlmg_2': shot(F('tik', 5.664, r=0.78, af=HEAVY_AF), F('tikm', 5.376, r=0.78, af=HEAVY_AF), 1.4, -14.5, mg=-6, fade=0.8),
    'hlmg_f1': far(F('tikm', 0.754, r=0.8, af=HEAVY_AF), 1.5, -19),
    # дробовик, обрез (12 калибр) — Benelli Nova, Charles Daly, Winchester Model 12
    'shotgun_1': shot(F('nova', 0.430), F('novam', 0.692), 1.6, -16, mg=0, fade=1.0),
    'shotgun_2': shot(F('cd', 0.464), F('cdm', 0.606), 1.6, -16, mg=-4, fade=1.0),
    'shotgun_3': shot(F('m12', 0.842), F('novam', 3.708), 1.6, -16, mg=0, fade=1.0),
    'shotgun_f1': far(F('cdm', 4.116), 1.6, -20),
    # ТТ — пистолет 1911 (.45), ГШ-18 (9×19) — Walther PPQ под тот же патрон
    'pistol_1': shot(F('colt', 0.940), F('coltm', 1.542), 1.0, -18),
    'pistol_2': shot(F('colt', 5.000), F('coltm', 6.654), 1.0, -18),
    'pistol_f1': far(F('coltm', 1.542), 1.1, -23),
    'pistol9_1': shot(F('ppq', 1.406), F('ppqm', 1.084), 1.0, -20, mg=0),
    'pistol9_2': shot(F('ppq', 6.444), F('ppqm', 5.242), 1.0, -20, mg=0),
    'pistol9_f1': far(F('ppqm', 5.242), 1.1, -24),
    # АС «Вал», ВСС (9×39, дозвуковой, глушитель) — настоящий выстрел .22 Ruger Mark III: ниже, глуше
    # (срез верхов), плюс лязг затвора настоящей винтовки (LFA). Записи с глушителем под CC0 не нашлось.
    'supp_1': dict(L=[F('rug', 0.480, r=0.82, af=SUPP_AF), L('lfa', 'equipment_clicks3.wav', 7.234, g=-9, d=0.028, af='highpass=f=900', n=0.2)],
                   len=0.7, fade=0.4, rms=-22, win=0.2),
    'supp_2': dict(L=[F('rug', 4.482, r=0.8, af=SUPP_AF), L('lfa', 'equipment_clicks3.wav', 8.618, g=-9, d=0.03, af='highpass=f=900', n=0.2)],
                   len=0.7, fade=0.4, rms=-22, win=0.2),
    # ---- перезарядка (устройство ствола: WT.RK) ----
    'rl_mag': dict(L=[L('springy', 'assaultriflereload1_0.wav', 0.0)], len=1.55, fade=0.15, rms=-24, win=1.5, hp=120),
    'rl_drum': dict(L=[L('springy2', 'gunreload1.wav', 0.0)], len=1.58, fade=0.15, rms=-24, win=1.5, hp=120),
    'rl_box': dict(L=[L('starninjas', 'gun_reload.2.ogg', 0.0)], len=1.35, fade=0.15, rms=-24, win=1.3, hp=150),
    'rl_bolt': dict(L=[L('bmac_clip', 'clipload1.wav', 0.0), L('springy', 'assaultriflereload1_0.wav', 1.02, d=0.45, r=0.88)],
                    len=1.05, fade=0.2, rms=-24, win=1.0, hp=150),
    'rl_pump': dict(L=[L('zer0_sg', 'ShotgunSounds/Shell in Chamber.mp3', 0.46)], len=1.05, fade=0.15, rms=-23, win=1.0, hp=120),
    'rl_click': dict(L=[L('springy', 'assaultriflereload1_0.wav', 1.02)], len=0.5, fade=0.15, rms=-22, win=0.45, hp=150),
    # механика после выстрела: цевьё дробовика, затвор винтовки с продольно-скользящим затвором (КСВК)
    'mech_pump': dict(L=[L('zer0_sg', 'ShotgunSounds/Rack.mp3', 0.6)], len=0.5, fade=0.15, rms=-22, win=0.45, hp=150),
    'mech_bolt': dict(L=[L('springy', 'assaultriflereload1_0.wav', 1.02, r=0.85)], len=0.6, fade=0.15, rms=-22, win=0.55, hp=150),
    # сухой щелчок (осечка, пустой магазин) — щелчок затвора настоящей винтовки
    'dry': dict(L=[L('lfa', 'equipment_clicks3.wav', 0.884)], len=0.18, fade=0.08, rms=-26, win=0.15, hp=300),
    # ---- гильзы о землю ----
    'cas_1': dict(L=[L('bmac_clink1', 'clink1_0.wav', 0.028, r=1.35)], len=0.22, fade=0.12, rms=-30, win=0.15, hp=1500),
    'cas_2': dict(L=[L('bmac_clink2', 'clink2.wav', 0.036, r=1.45)], len=0.2, fade=0.12, rms=-30, win=0.15, hp=1500),
    'cas_3': dict(L=[L('bmac_clink3', 'clink3.wav', 0.024, r=1.3)], len=0.22, fade=0.12, rms=-30, win=0.15, hp=1500),
    'cas_sh': dict(L=[L('rd75', 'bfh1_hit_05.ogg', 0.0, r=1.2)], len=0.12, fade=0.06, rms=-30, win=0.1, hp=400),
    # ---- попадания по материалам ----
    'imp_stone_1': dict(L=[L('qimp', 'qubodupImpact/qubodupImpactStone.flac', 0.0), L('rd100b', 'sfx100v2_stones_01.ogg', 0.0, g=-8, d=0.03)],
                        len=0.45, fade=0.25, rms=-21, win=0.12, hp=150),
    'imp_stone_2': dict(L=[L('rd75', 'bfh1_rock_hit_01.ogg', 0.0), L('spring_rock', 'small_rock_impact.wav', 0.0, g=-6, d=0.015)],
                        len=0.35, fade=0.2, rms=-23, win=0.12, hp=150),
    'imp_metal_1': dict(L=[L('rd75', 'bfh1_metal_hit_01.ogg', 0.0), L('bmac_bing', 'bing1.wav', 0.02, g=-10)],
                        len=0.6, fade=0.4, rms=-21, win=0.12, hp=300),
    'imp_metal_2': dict(L=[L('qimp', 'qubodupImpact/qubodupImpactMetal.flac', 0.0)], len=0.45, fade=0.3, rms=-21, win=0.12, hp=300),
    'imp_wood_1': dict(L=[L('rd75', 'bfh1_wood_hit_01.ogg', 0.018)], len=0.22, fade=0.12, rms=-20, win=0.12, hp=120),
    'imp_wood_2': dict(L=[L('qimp', 'qubodupImpact/qubodupImpactWood.flac', 0.0)], len=0.4, fade=0.25, rms=-20, win=0.12, hp=120),
    'imp_dirt_1': dict(L=[L('rd100', 'hit_03.ogg', 0.012, af='lowpass=f=2600'), L('rd100b', 'sfx100v2_stones_01.ogg', 0.0, g=-14, d=0.02)],
                       len=0.4, fade=0.25, rms=-21, win=0.12, hp=80),
    'imp_dirt_2': dict(L=[L('qhits', 'hits/hit10.mp3.flac', 0.05, af='lowpass=f=2200')], len=0.4, fade=0.25, rms=-21, win=0.12, hp=80),
    'imp_flesh_1': dict(L=[L('qimp', 'qubodupImpact/qubodupImpactMeat01.flac', 0.0)], len=0.4, fade=0.25, rms=-21, win=0.15, hp=100),
    'imp_flesh_2': dict(L=[L('qimp', 'qubodupImpact/qubodupImpactMeat02.flac', 0.0)], len=0.4, fade=0.25, rms=-21, win=0.15, hp=100),
    'imp_glass_1': dict(L=[L('rd75', 'bfh1_glass_breaking_01.ogg', 0.0)], len=0.55, fade=0.3, rms=-22, win=0.15, hp=300),
    'imp_glass_2': dict(L=[L('rd100', 'glass_01.ogg', 0.0)], len=0.38, fade=0.25, rms=-22, win=0.15, hp=300),
    # ---- РПГ-7 и взрывы ----
    # выстрел РПГ-7: вышибной заряд, через ~0,2 с — запуск маршевого двигателя
    'rpg_1': dict(L=[L('c_yav', 'video', 90.723)], len=2.4, fade=1.6, rms=-15, win=0.4, hp=35),
    'rpg_2': dict(L=[L('c_yav', 'video', 72.907)], len=2.4, fade=1.6, rms=-15, win=0.4, hp=35),
    'rpg_3': dict(L=[L('c_yav', 'video', 125.650)], len=1.25, fade=0.8, rms=-15, win=0.4, hp=35),
    # полёт ракеты: работающий двигатель ракеты APOBS (середина записи, с плавным входом)
    'rpg_fly': dict(L=[L('c_cac', 'video', 45.10, af='afade=t=in:d=0.15')], len=1.2, fade=0.45, rms=-20, win=1.0, hp=60),
    # взрывы: настоящий подрыв заряда (APOBS), «Chunky Explosion»; варианты — замедленный (тяжелее) и ускоренный (граната)
    'expl_1': dict(L=[L('c_cac', 'video', 54.962)], len=3.0, fade=2.0, rms=-13, win=0.5, hp=25, lim=-3),
    'expl_2': dict(L=[L('joth', 'Chunky Explosion.mp3', 0.0)], len=3.2, fade=2.0, rms=-13, win=0.5, hp=25, lim=-3),
    'expl_3': dict(L=[L('c_cac', 'video', 54.962, r=0.82, af=HEAVY_AF), L('joth', 'Chunky Explosion.mp3', 0.0, g=-9, d=0.06)],
                   len=3.4, fade=2.2, rms=-13, win=0.5, hp=25, lim=-3),
    'gren_1': dict(L=[L('c_cac', 'video', 54.962, r=1.2)], len=1.8, fade=1.2, rms=-14, win=0.4, hp=40, lim=-3),
    'gren_2': dict(L=[L('joth', 'Chunky Explosion.mp3', 0.0, r=1.25)], len=2.0, fade=1.3, rms=-14, win=0.4, hp=40, lim=-3),
}


# ---------------------------------------------------------------------------------------------------------
def log(*a):
    print(*a, flush=True)


def fetch_url(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wait = 15
    for i in range(12):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
            if data[:15].lower().startswith(b'<!doctype html'):
                raise IOError('вместо файла пришла страница')
            with open(path + '.part', 'wb') as f:
                f.write(data)
            os.replace(path + '.part', path)
            log('  скачано', os.path.basename(path), len(data), 'байт')
            return path
        except Exception as e:  # Wikimedia отвечает 429 при частых запросах — ждём
            code = getattr(e, 'code', None)
            ra = None
            try:
                ra = int(e.headers.get('retry-after'))
            except Exception:
                pass
            w = max(ra or 0, wait) if code in (429, None) else 5
            log('  повтор через', int(w), 'с:', e)
            time.sleep(w)
            wait = min(300, wait * 1.6)
    raise SystemExit('не удалось скачать ' + url)


def safe_join(base, member):
    p = os.path.normpath(os.path.join(base, member))
    if not p.startswith(os.path.normpath(base) + os.sep):
        raise SystemExit('подозрительный путь в архиве: ' + member)
    return p


def extract(src, arc, member):
    """Достать из архива один звуковой файл (без запуска чего-либо)."""
    base = os.path.join(CACHE, src, 'x')
    out = safe_join(base, member)
    if os.path.exists(out):
        return out
    if not member.lower().endswith(AUDIO_EXT):
        raise SystemExit('не звук: ' + member)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if arc.endswith('.zip'):
        with zipfile.ZipFile(arc) as z:
            with z.open(member) as f, open(out, 'wb') as o:
                shutil.copyfileobj(f, o)
    else:
        try:
            import py7zr
            with py7zr.SevenZipFile(arc, 'r') as z:
                z.extract(path=base, targets=[member])
        except ImportError:
            if not shutil.which('7z'):
                raise SystemExit('для .7z нужен py7zr (pip install py7zr) или 7z')
            subprocess.run(['7z', 'x', '-y', '-o' + base, arc, member], check=True, capture_output=True)
    return out


def source_file(s, member):
    S = SOURCES[s]
    name = urllib.parse.unquote(S['url'].rsplit('/', 1)[-1])
    p = fetch_url(S['url'], os.path.join(CACHE, s, name))
    if S['kind'] in ('zip', '7z'):
        return extract(s, p, member)
    return p


def probe_channels(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels',
                        '-of', 'csv=p=0', p], capture_output=True, text=True)
    try:
        return int(r.stdout.strip().split('\n')[0])
    except ValueError:
        return 1


def ff(args):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y'] + args, capture_output=True, text=True)
    if r.returncode:
        log(r.stderr[-2000:])
        raise SystemExit('ffmpeg: ошибка')
    return r.stderr


def stats(p, win=None):
    """Пик всего файла и RMS первых win секунд, дБFS."""
    af = ('atrim=0:%g,' % win if win else '') + 'astats=measure_perchannel=none:measure_overall=Peak_level+RMS_level'
    e = ff(['-i', p, '-af', af, '-f', 'null', '-'])
    rms = float(re.findall(r'RMS level dB: (-?[\d.]+|-inf)', e)[-1].replace('-inf', '-200'))
    e2 = ff(['-i', p, '-af', 'astats=measure_perchannel=none:measure_overall=Peak_level+RMS_level', '-f', 'null', '-'])
    pk = float(re.findall(r'Peak level dB: (-?[\d.]+|-inf)', e2)[-1].replace('-inf', '-200'))
    return pk, rms


def build(name, R, tmp):
    lays = R['L']
    args, fl, labels = [], [], []
    for i, l in enumerate(lays):
        p = source_file(l['s'], l['f'])
        need = (R['len'] + 0.3) * l['r'] + 0.05
        args += ['-ss', '%.4f' % max(0.0, l['t'] - PRE), '-t', '%.4f' % need, '-i', p]
        ch = probe_channels(p)
        c = '[%d:a]aresample=%d' % (i, SR)
        c += ',pan=mono|c0=0.5*c0+0.5*c1' if ch >= 2 else ''
        if abs(l['r'] - 1) > 1e-6:
            c += ',asetrate=%d,aresample=%d' % (round(SR * l['r']), SR)
        c += ',afade=t=in:d=0.003'
        if l['af']:
            c += ',' + l['af']
        if l.get('n'):
            c += ',atrim=0:%g,afade=t=out:st=%g:d=0.02' % (l['n'], max(0.0, l['n'] - 0.02))
        if l['g']:
            c += ',volume=%gdB' % l['g']
        if l['d']:
            c += ',adelay=delays=%d:all=1' % round(l['d'] * 1000)
        fl.append(c + '[a%d]' % i)
        labels.append('[a%d]' % i)
    mix = ''.join(labels) + ('amix=inputs=%d:normalize=0:duration=longest' % len(lays) if len(lays) > 1 else 'anull')
    mix += ',highpass=f=%g' % R.get('hp', 30)
    if R.get('lp'):
        mix += ',lowpass=f=%g' % R['lp']
    mix += ',atrim=0:%g,asetpts=PTS-STARTPTS[m]' % R['len']
    fl.append(mix)
    raw = os.path.join(tmp, name + '.raw.wav')
    ff(args + ['-filter_complex', ';'.join(fl), '-map', '[m]', '-ac', '1', '-c:a', 'pcm_f32le', raw])
    # громкость: RMS первых win секунд к цели, лимитер — потолок; 2–3 прохода, пока не сойдётся
    pk0, rms0 = stats(raw, R['win'])
    g = g0 = R['rms'] - rms0
    push = R.get('push', 8.0)  # больше 8 дБ лимитер не дожимает: атака выстрела не должна сплющиться
    lim = 10 ** (R.get('lim', -2.0) / 20)  # запас на выбросы после сжатия Vorbis
    out = os.path.join(OUTDIR, name + '.ogg')
    for it in range(6):
        post = ('volume=%.2fdB,alimiter=limit=%.4f:attack=1:release=%g:level=0:latency=1,'
                'afade=t=out:st=%g:d=%g,aresample=%d' % (g, lim, R.get('rel', 15), R['len'] - R['fade'], R['fade'], OUT_SR))
        ff(['-i', raw, '-af', post, '-ac', '1', '-c:a', 'libvorbis', '-q:a', str(R.get('q', 4)), out])
        pk, rms = stats(out, R['win'])
        if abs(rms - R['rms']) < 0.4 or g >= g0 + push - 0.01:
            break
        g = min(g + R['rms'] - rms, g0 + push)
    return pk, rms, g - g0  # сколько «съел» лимитер, дБ


def levels():
    rows = []
    for name in sorted(OUT):
        p = os.path.join(OUTDIR, name + '.ogg')
        if os.path.exists(p):
            pk, rms = stats(p, OUT[name]['win'])
            rows.append((name, pk, rms, os.path.getsize(p)))
    for r in rows:
        log('%-14s пик %6.1f дБ  RMS %6.1f дБ  %6d байт' % r)
    log('всего %d файлов, %.0f КБ' % (len(rows), sum(r[3] for r in rows) / 1024))


# Что чем звучит в игре (для CREDITS.md): набор записей → оружие игры → чья запись
FAMILY_NOTES = [
    ('smg', 'ППШ', 'настоящий ППШ (7,62×25 ТТ) — FFSL'),
    ('smg9', '«Витязь»', 'Carl Gustav M45 (9×19, тот же патрон) — FFSL'),
    ('rifle', 'АК, турель', 'настоящий АК-47 и SKS (7,62×39) — FFSL'),
    ('ak2', 'АК-74М, штурмовая винтовка', 'AR-15 (5,56×45 — ближайшая запись того же класса, что 5,45×39) — FFSL'),
    ('sniper', 'СВД', 'винтовка Мосина (7,62×54R, тот же патрон) — FFSL'),
    ('hsniper', 'КСВК', 'Springfield 1917 (.30-06), замедлено до 0,78–0,8 — FFSL'),
    ('lmg', 'ПКМ, ПКП «Печенег»', 'настоящий пулемёт ПК — видео морской пехоты США (общественное достояние)'),
    ('hlmg', '«Корд»', 'Tikka T3 (.30-06), замедлено до 0,78–0,8 — FFSL'),
    ('shotgun', 'дробовик, обрез', 'Benelli Nova, Charles Daly, Winchester Model 12 (12 калибр) — FFSL'),
    ('pistol', 'ТТ', 'Colt 1911 (.45) — FFSL'),
    ('pistol9', 'ГШ-18', 'Walther PPQ (9×19, тот же патрон) — FFSL'),
    ('supp', 'АС «Вал», ВСС, глушитель', 'Ruger Mark III (.22), замедлено и приглушено, + механический щелчок (LFA)'),
    ('rpg', 'РПГ-7 (выстрел)', 'настоящий РПГ-7 — видео армии США (общественное достояние)'),
    ('rpg_fly', 'полёт ракеты', 'двигатель ракеты APOBS — видео морской пехоты США'),
    ('expl, gren', 'взрывы, граната', 'подрыв заряда APOBS (видео морской пехоты США) и «Chunky Explosion» (Joth, CC0)'),
    ('rl_*, mech_*, dry', 'перезарядка, затвор, цевьё, осечка', 'SpringySpringo, StarNinjas, BMacZero, zer0_sol, LFA (CC0)'),
    ('cas_*', 'гильзы', 'BMacZero (металл), rubberduck (CC0)'),
    ('imp_*', 'попадания: камень, металл, дерево, грунт, плоть, стекло', 'rubberduck, qubodup, Spring Spring (CC0)'),
]


def credits():
    used = {}
    for name, R in OUT.items():
        for l in R['L']:
            used.setdefault(l['s'], set()).add(name)
    lines = ['# Звуки оружия: источники и лицензии', '',
             'Все звуки в этой папке собраны из настоящих записей, распространяемых как **CC0 1.0** '
             '(отказ от прав) или находящихся в **общественном достоянии** (public domain). '
             'Указание авторства по этим лицензиям не обязательно — мы указываем его из благодарности.', '',
             'Сборка воспроизводима: `python3 tools/sfx/build.py` (скачивает исходники, режет, смешивает, '
             'выравнивает громкость и кодирует в Ogg Vorbis). Что из чего собрано — таблица `OUT` в `tools/sfx/build.py`.', '',
             '## Что чем звучит', '', '| Файлы | В игре | Запись |', '|---|---|---|']
    for fam, game, rec in FAMILY_NOTES:
        lines.append('| `%s` | %s | %s |' % (fam, game, rec))
    lines += ['', 'FFSL — The Free Firearm Sound Library (CC0). `_f` в имени — дальний дубль (средний микрофон) для выстрелов врагов.', '',
              '## Источники', '']
    # одна страница — один раздел (несколько файлов с неё перечисляются вместе)
    pages = []
    for s in sorted(used, key=lambda k: list(SOURCES).index(k)):
        S = SOURCES[s]
        for P in pages:
            if P['page'] == S['page']:
                P['urls'].append(S['url'])
                P['used'] |= used[s]
                break
        else:
            pages.append(dict(S, urls=[S['url']], used=set(used[s])))
    for P in pages:
        lines.append('### ' + P['title'])
        lines.append('')
        lines.append('- Автор: ' + P['author'])
        lines.append('- Лицензия: ' + P['lic'])
        lines.append('- Страница: ' + P['page'])
        for u in P['urls']:
            lines.append('- Файл: ' + u)
        if P.get('note'):
            lines.append('- Примечание: ' + P['note'])
        lines.append('- Использовано в: ' + ', '.join('`%s.ogg`' % n for n in sorted(P['used'])))
        lines.append('')
    lines += ['## Обработка', '',
              'Одиночный выстрел вырезается с 4 мс до атаки; ближний микрофон смешивается со средним того же ствола '
              '(естественный хвост и эхо стрельбища). Крупный калибр (КСВК, «Корд») — запись .30-06, замедленная до 0,78–0,8 '
              '(ниже и тяжелее). «Вал» и ВСС — настоящий выстрел .22 Ruger Mark III, замедленный и приглушённый, плюс '
              'механический щелчок (записи с глушителем под CC0 не нашлось). Дальние выстрелы врагов — средний '
              'микрофон отдельно. Из видео взята перекодированная копия 480p (звук Opus 48 кГц). Далее: моно, срез гула, '
              'обрезка хвоста и затухание, выравнивание громкости по RMS первых долей секунды (у каждого класса своя цель), '
              'лимитер −2 дБFS, Ogg Vorbis 44,1 кГц, качество 4.', '',
              'Не нашлось записей под CC0 / public domain для свиста пули и визга рикошета: рикошет от металла '
              'досинтезирует игра (audio.js).', '']
    with open(os.path.join(OUTDIR, 'CREDITS.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    log('записан game/sfx/CREDITS.md')


def main():
    ap = argparse.ArgumentParser(description='Сборка звуков оружия из записей CC0 / public domain')
    ap.add_argument('--only', help='через запятую: какие файлы собрать')
    ap.add_argument('--credits', action='store_true', help='только переписать CREDITS.md')
    ap.add_argument('--levels', action='store_true', help='только измерить готовые файлы')
    ap.add_argument('--json', help='записать уровни в JSON')
    a = ap.parse_args()
    if a.credits:
        return credits()
    if a.levels:
        return levels()
    os.makedirs(OUTDIR, exist_ok=True)
    names = a.only.split(',') if a.only else list(OUT)
    res = {}
    with tempfile.TemporaryDirectory() as tmp:
        for name in names:
            pk, rms, gr = build(name, OUT[name], tmp)
            res[name] = dict(peak=round(pk, 2), rms=round(rms, 2), target=OUT[name]['rms'], limiter=round(gr, 1))
            log('%-14s пик %6.1f дБ  RMS %6.1f дБ (цель %g, лимитер +%.1f дБ)' % (name, pk, rms, OUT[name]['rms'], gr))
    if a.json:
        with open(a.json, 'w') as f:
            json.dump(res, f, indent=1)
    if not a.only:
        credits()


if __name__ == '__main__':
    main()
