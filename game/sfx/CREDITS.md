# Звуки оружия: источники и лицензии

Все звуки в этой папке собраны из настоящих записей, распространяемых как **CC0 1.0** (отказ от прав) или находящихся в **общественном достоянии** (public domain). Указание авторства по этим лицензиям не обязательно — мы указываем его из благодарности.

Сборка воспроизводима: `python3 tools/sfx/build.py` (скачивает исходники, режет, смешивает, выравнивает громкость и кодирует в Ogg Vorbis). Что из чего собрано — таблица `OUT` в `tools/sfx/build.py`.

## Что чем звучит

| Файлы | В игре | Запись |
|---|---|---|
| `smg` | ППШ | настоящий ППШ (7,62×25 ТТ) — FFSL |
| `smg9` | «Витязь» | Carl Gustav M45 (9×19, тот же патрон) — FFSL |
| `rifle` | АК, турель | настоящий АК-47 и SKS (7,62×39) — FFSL |
| `ak2` | АК-74М, штурмовая винтовка | AR-15 (5,56×45 — ближайшая запись того же класса, что 5,45×39) — FFSL |
| `sniper` | СВД | винтовка Мосина (7,62×54R, тот же патрон) — FFSL |
| `hsniper` | КСВК | Springfield 1917 (.30-06), замедлено до 0,78–0,8 — FFSL |
| `lmg` | ПКМ, ПКП «Печенег» | настоящий пулемёт ПК — видео морской пехоты США (общественное достояние) |
| `hlmg` | «Корд» | Tikka T3 (.30-06), замедлено до 0,78–0,8 — FFSL |
| `shotgun` | дробовик, обрез | Benelli Nova, Charles Daly, Winchester Model 12 (12 калибр) — FFSL |
| `pistol` | ТТ | Colt 1911 (.45) — FFSL |
| `pistol9` | ГШ-18 | Walther PPQ (9×19, тот же патрон) — FFSL |
| `supp` | АС «Вал», ВСС, глушитель | Ruger Mark III (.22), замедлено и приглушено, + механический щелчок (LFA) |
| `rpg` | РПГ-7 (выстрел) | настоящий РПГ-7 — видео армии США (общественное достояние) |
| `rpg_fly` | полёт ракеты | двигатель ракеты APOBS — видео морской пехоты США |
| `expl, gren` | взрывы, граната | подрыв заряда APOBS (видео морской пехоты США) и «Chunky Explosion» (Joth, CC0) |
| `rl_*, mech_*, dry` | перезарядка, затвор, цевьё, осечка | SpringySpringo, StarNinjas, BMacZero, zer0_sol, LFA (CC0) |
| `cas_*` | гильзы | BMacZero (металл), rubberduck (CC0) |
| `imp_*` | попадания: камень, металл, дерево, грунт, плоть, стекло | rubberduck, qubodup, Spring Spring (CC0) |

FFSL — The Free Firearm Sound Library (CC0). `_f` в имени — дальний дубль (средний микрофон) для выстрелов врагов.

## Источники

### The Free Firearm Sound Library (Prepared SFX Library)

- Автор: команда The Free Firearm Sound Library (freefirearmsfx.com, Still North Media; Kickstarter 2013), публикация на OpenGameArt — bart
- Лицензия: CC0 1.0 («Our team holds CC0 NO RIGHTS RESERVED for this library»)
- Страница: https://opengameart.org/content/the-free-firearm-sound-library
- Файл: https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z
- Примечание: 96 кГц, ближний («near») и средний («mid») микрофоны; настоящие АК-47, ППШ, винтовка Мосина, SKS, AR-15, Springfield 1917, Tikka T3, 1911, Walther PPQ, Ruger Mark III, Carl Gustav M45, Benelli Nova, Charles Daly, Winchester Model 12
- Использовано в: `ak2_1.ogg`, `ak2_2.ogg`, `ak2_f1.ogg`, `hlmg_1.ogg`, `hlmg_2.ogg`, `hlmg_f1.ogg`, `hsniper_1.ogg`, `hsniper_2.ogg`, `hsniper_f1.ogg`, `pistol9_1.ogg`, `pistol9_2.ogg`, `pistol9_f1.ogg`, `pistol_1.ogg`, `pistol_2.ogg`, `pistol_f1.ogg`, `rifle_1.ogg`, `rifle_2.ogg`, `rifle_3.ogg`, `rifle_f1.ogg`, `rifle_f2.ogg`, `shotgun_1.ogg`, `shotgun_2.ogg`, `shotgun_3.ogg`, `shotgun_f1.ogg`, `smg9_1.ogg`, `smg9_2.ogg`, `smg9_f1.ogg`, `smg_1.ogg`, `smg_2.ogg`, `smg_3.ogg`, `smg_f1.ogg`, `smg_f2.ogg`, `sniper_1.ogg`, `sniper_2.ogg`, `sniper_f1.ogg`, `supp_1.ogg`, `supp_2.ogg`

### Gun reload sounds

- Автор: SpringySpringo
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/gun-reload-sounds
- Файл: https://opengameart.org/sites/default/files/assaultriflereload1_0.wav
- Файл: https://opengameart.org/sites/default/files/gunreload1.wav
- Использовано в: `mech_bolt.ogg`, `rl_bolt.ogg`, `rl_click.ogg`, `rl_drum.ogg`, `rl_mag.ogg`

### 2 Gun Reloads

- Автор: StarNinjas
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/2-gun-reloads
- Файл: https://opengameart.org/sites/default/files/gun_reload_-_starninjas.zip
- Использовано в: `rl_box.ogg`

### Gun Reload Sound Effects

- Автор: BMacZero
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/gun-reload-sound-effects
- Файл: https://opengameart.org/sites/default/files/clipload1.wav
- Использовано в: `rl_bolt.ogg`

### Shotgun Reload Sound effects

- Автор: zer0_sol
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/shotgun-reload-sound-effects
- Файл: https://opengameart.org/sites/default/files/shotgunsounds.zip
- Использовано в: `mech_pump.ogg`, `rl_pump.ogg`

### equipment clicks III

- Автор: LFA
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/equipment-clicks-iii
- Файл: https://opengameart.org/sites/default/files/equipment_clicks3.wav
- Примечание: щелчки; по словам автора — затвор настоящей винтовки, степлер и рулетка
- Использовано в: `dry.ogg`, `supp_1.ogg`, `supp_2.ogg`

### Metal Impact Sounds

- Автор: BMacZero
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/metal-impact-sounds
- Файл: https://opengameart.org/sites/default/files/clink1_0.wav
- Файл: https://opengameart.org/sites/default/files/clink2.wav
- Файл: https://opengameart.org/sites/default/files/clink3.wav
- Файл: https://opengameart.org/sites/default/files/bing1.wav
- Использовано в: `cas_1.ogg`, `cas_2.ogg`, `cas_3.ogg`, `imp_metal_1.ogg`

### 75 CC0 breaking / falling / hit sfx

- Автор: rubberduck
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx
- Файл: https://opengameart.org/sites/default/files/sfx_breaking_and_falling.zip
- Использовано в: `cas_sh.ogg`, `imp_glass_1.ogg`, `imp_metal_1.ogg`, `imp_stone_2.ogg`, `imp_wood_1.ogg`

### 100 CC0 SFX

- Автор: rubberduck
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/100-cc0-sfx
- Файл: https://opengameart.org/sites/default/files/100-CC0-SFX_0.zip
- Использовано в: `imp_dirt_1.ogg`, `imp_glass_2.ogg`

### 100 CC0 SFX #2

- Автор: rubberduck
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/100-cc0-sfx-2
- Файл: https://opengameart.org/sites/default/files/sfx_100_v2.zip
- Использовано в: `imp_dirt_1.ogg`, `imp_stone_1.ogg`

### Impact

- Автор: qubodup (Iwan Gabovitch)
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/impact
- Файл: https://opengameart.org/sites/default/files/qubodupImpact.7z
- Использовано в: `imp_flesh_1.ogg`, `imp_flesh_2.ogg`, `imp_metal_2.ogg`, `imp_stone_1.ogg`, `imp_wood_2.ogg`

### 37 hits/punches

- Автор: qubodup (independent.nu ljudbank)
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/37-hitspunches
- Файл: https://opengameart.org/sites/default/files/independent_nu_ljudbank-hits_and_punches.7z
- Использовано в: `imp_dirt_2.ogg`

### Various Sound Effects

- Автор: Spring Spring
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/various-sound-effects-0
- Файл: https://opengameart.org/sites/default/files/small_rock_impact.wav
- Использовано в: `imp_stone_2.ogg`

### Chunky Explosion

- Автор: Joth
- Лицензия: CC0 1.0
- Страница: https://opengameart.org/content/chunky-explosion
- Файл: https://opengameart.org/sites/default/files/Chunky%20Explosion.mp3
- Использовано в: `expl_2.ogg`, `expl_3.ogg`, `gren_2.ogg`

### RPG qual at Yavoriv CTC BROLL

- Автор: Anthony Jones, U.S. Army (DVIDS 522778)
- Лицензия: Public domain (работа федерального правительства США)
- Страница: https://commons.wikimedia.org/wiki/File:RPG_qual_at_Yavoriv_CTC_BROLL.ogv
- Файл: https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f8/RPG_qual_at_Yavoriv_CTC_BROLL.ogv/RPG_qual_at_Yavoriv_CTC_BROLL.ogv.480p.vp9.webm
- Примечание: звуковая дорожка без закадрового текста: стрельба из РПГ-7 (вышибной заряд и запуск двигателя)
- Использовано в: `rpg_1.ogg`, `rpg_2.ogg`, `rpg_3.ogg`

### (B-roll) CAC Demo Range

- Автор: Cpl. Eric Tso, U.S. Marine Corps (DVIDS 709374)
- Лицензия: Public domain (работа федерального правительства США)
- Страница: https://commons.wikimedia.org/wiki/File:(B-roll)_CAC_Demo_Range.webm
- Файл: https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7e/%28B-roll%29_CAC_Demo_Range.webm/%28B-roll%29_CAC_Demo_Range.webm.480p.vp9.webm
- Примечание: звуковая дорожка: полёт ракеты APOBS (44,9 с) и подрыв заряда разминирования (55,0 с)
- Использовано в: `expl_1.ogg`, `expl_3.ogg`, `gren_1.ogg`, `rpg_fly.ogg`

### Marines fire foreign weapons as part of pre-deployment training (B-Roll)

- Автор: U.S. Marine Corps (Lucas Hopkins), DVIDS 506875
- Лицензия: Public domain (работа федерального правительства США)
- Страница: https://commons.wikimedia.org/wiki/File:Marines_fire_foreign_weapons_as_part_of_pre-deployment_training_(B-Roll).ogv
- Файл: https://upload.wikimedia.org/wikipedia/commons/transcoded/9/9c/Marines_fire_foreign_weapons_as_part_of_pre-deployment_training_%28B-Roll%29.ogv/Marines_fire_foreign_weapons_as_part_of_pre-deployment_training_%28B-Roll%29.ogv.480p.vp9.webm
- Примечание: звуковая дорожка видео без закадрового текста: пулемёт ПК (7–24 с) и АК-47 (25–45 с)
- Использовано в: `lmg_1.ogg`, `lmg_2.ogg`, `lmg_3.ogg`, `lmg_f1.ogg`

## Обработка

Одиночный выстрел вырезается с 4 мс до атаки; ближний микрофон смешивается со средним того же ствола (естественный хвост и эхо стрельбища). Крупный калибр (КСВК, «Корд») — запись .30-06, замедленная до 0,78–0,8 (ниже и тяжелее). «Вал» и ВСС — настоящий выстрел .22 Ruger Mark III, замедленный и приглушённый, плюс механический щелчок (записи с глушителем под CC0 не нашлось). Дальние выстрелы врагов — средний микрофон отдельно. Из видео взята перекодированная копия 480p (звук Opus 48 кГц). Далее: моно, срез гула, обрезка хвоста и затухание, выравнивание громкости по RMS первых долей секунды (у каждого класса своя цель), лимитер −2 дБFS, Ogg Vorbis 44,1 кГц, качество 4.

Не нашлось записей под CC0 / public domain для свиста пули и визга рикошета: рикошет от металла досинтезирует игра (audio.js).
