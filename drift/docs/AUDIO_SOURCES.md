# Звуки «Дрейфа» — источники и лицензии

Указание авторов не требуется: все записи — **CC0**, остальные звуки синтезированы для игры.

## Синтезированные (свои)

Скрипт `tools/gen_sfx.py` (numpy + ffmpeg, фиксированное зерно случайности) создаёт: `blaster_1..3`, `blaster_enemy_1..2`, `turret_gun_1..3`, `turret_laser`, `bullet_hit_1..2`, `ricochet_1..2`, `alarm`, `jump`, `dock_clamp`, `impact`, `weld`, `tool`, `mine_1..2`, `power_on`, `power_off`, `craft_metal`, `amb_ship`.

- Это собственная работа, чужих записей нет.
- `amb_ship` — бесшовный цикл 11 с, у всех частот целое число периодов на длину цикла; код включает `loop` сам.
- Формат: Ogg Vorbis q4, моно, 44.1 кГц.
- Проверено: пик и средняя громкость (ffmpeg volumedetect), отсутствие тишины и клиппинга, шов цикла. Послушать здесь нельзя — на слух проверить на телефоне.

## Записи CC0 (взяты из BUNKER SURVIVAL, та же обработка)

Полное описание наборов — `bunker/docs/AUDIO_SOURCES.md`, раздел «Наборы».

| Файл | Длит., с | Источник (страница) | Исходный файл | Автор | Лицензия | Что изменено |
|---|---|---|---|---|---|---|
| `door_open.ogg` | 0.70 | [100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx) | `metal_open_01.ogg` | rubberduck | CC0 1.0 | обрезка тишины, фейды, моно, пик −1 dBFS |
| `door_close.ogg` | 0.66 | [100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx) | `metal_close_01.ogg` | rubberduck | CC0 1.0 | обрезка тишины, фейды, моно, пик −1 dBFS |
| `punch_1.ogg` | 0.52 | [37 hits/punches](https://opengameart.org/content/37-hitspunches)<br>[Impact Sounds](https://kenney.nl/assets/impact-sounds) | `hit14.mp3.flac`<br>`impactPunch_heavy_000.ogg` | qubodup (из ljudbank independent.nu)<br>Kenney (kenney.nl) | CC0 1.0<br>CC0 1.0 | монтаж: удар (ФВЧ 60 Гц) + низкий удар кулака по телу (−3 дБ), выровнены по атаке; обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `punch_2.ogg` | 0.55 | [37 hits/punches](https://opengameart.org/content/37-hitspunches)<br>[Impact Sounds](https://kenney.nl/assets/impact-sounds) | `hit17.mp3.flac`<br>`impactPunch_heavy_001.ogg` | qubodup (из ljudbank independent.nu)<br>Kenney (kenney.nl) | CC0 1.0<br>CC0 1.0 | монтаж: удар (ФВЧ 60 Гц) + низкий удар кулака по телу (−3 дБ), выровнены по атаке; обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `punch_3.ogg` | 0.46 | [37 hits/punches](https://opengameart.org/content/37-hitspunches)<br>[Impact Sounds](https://kenney.nl/assets/impact-sounds) | `hit13.mp3.flac`<br>`impactPunch_heavy_002.ogg` | qubodup (из ljudbank independent.nu)<br>Kenney (kenney.nl) | CC0 1.0<br>CC0 1.0 | монтаж: удар (ФВЧ 60 Гц) + низкий удар кулака по телу (−3 дБ), выровнены по атаке; обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `punch_4.ogg` | 0.54 | [37 hits/punches](https://opengameart.org/content/37-hitspunches)<br>[Impact Sounds](https://kenney.nl/assets/impact-sounds) | `hit06.mp3.flac`<br>`impactPunch_heavy_003.ogg` | qubodup (из ljudbank independent.nu)<br>Kenney (kenney.nl) | CC0 1.0<br>CC0 1.0 | монтаж: удар (ФВЧ 60 Гц) + низкий удар кулака по телу (−3 дБ), выровнены по атаке; обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `swoosh_1.ogg` | 0.12 | [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) | `swish-3.wav` | artisticdude | CC0 1.0 | обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `swoosh_2.ogg` | 0.12 | [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) | `swish-4.wav` | artisticdude | CC0 1.0 | обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `swoosh_3.ogg` | 0.12 | [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) | `swish-8.wav` | artisticdude | CC0 1.0 | обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `death_enemy_1.ogg` | 1.52 | [grunts of male death and pain](https://opengameart.org/content/grunts-male-death-and-pain) | `death pain grunts.wav, 35.8–38.4 с` | thebardofblasphemy | CC0 1.0 | вырезан один стон из длинной записи; обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `death_enemy_2.ogg` | 2.25 | [grunts of male death and pain](https://opengameart.org/content/grunts-male-death-and-pain) | `death pain grunts.wav, 20.2–23.2 с` | thebardofblasphemy | CC0 1.0 | вырезан один стон из длинной записи; обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `metal_clang.ogg` | 1.80 | [Metal clang sounds](https://opengameart.org/content/metal-clang-sounds) | `clang - Marker #2.wav` | bart (Bart Kelsey) | CC0 1.0 | укорочено до 1.8 с с плавным затуханием; моно, пик −1 dBFS |
| `ui_click.ogg` | 0.09 | [UI Audio](https://kenney.nl/assets/ui-audio) | `click1.ogg` | Kenney (kenney.nl) | CC0 1.0 | обрезка тишины, фейды, моно, пик −1 dBFS |
| `ui_open.ogg` | 0.15 | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `open_001.ogg` | Kenney (kenney.nl) | CC0 1.0 | обрезка тишины, фейды, моно, пик −1 dBFS |
| `hurt_hero_1.ogg` | 0.43 | [15 vocal male strain/hurt/pain/jump sounds](https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds) | `slightscream-01.flac` | qubodup (Iwan Gabovitch) | CC0 1.0 (с 2024-08-30, по странице автора) | обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `hurt_hero_2.ogg` | 0.55 | [15 vocal male strain/hurt/pain/jump sounds](https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds) | `slightscream-03.flac` | qubodup (Iwan Gabovitch) | CC0 1.0 (с 2024-08-30, по странице автора) | обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `hurt_hero_3.ogg` | 0.54 | [15 vocal male strain/hurt/pain/jump sounds](https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds) | `slightscream-14.flac` | qubodup (Iwan Gabovitch) | CC0 1.0 (с 2024-08-30, по странице автора) | обрезка тишины, фейды, моно, пик −1 dBFS, громкость выровнена с другими вариантами |
| `heal.ogg` (в бункере — `medbay.ogg`) | 1.52 | [50 CC0 Sci-Fi SFX](https://opengameart.org/content/50-cc0-sci-fi-sfx)<br>[Steam release sounds](https://opengameart.org/content/steam-release-sounds) | `beep_01.ogg`<br>`steam hisses - Marker #1.wav` | rubberduck<br>bart (Bart Kelsey) | CC0 1.0<br>CC0 1.0 | монтаж: два сигнала прибора + шипение (ФВЧ 400 Гц); фейды, моно, пик −1 dBFS |
| `crate_open.ogg` (в бункере — `pickup.ogg`) | 0.24 | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `handleSmallLeather.ogg` | Kenney (kenney.nl) | CC0 1.0 | обрезка тишины, фейды, моно, пик −1 dBFS |
| `trade.ogg` (в бункере — `terminal_beep.ogg`) | 0.16 | [50 CC0 Sci-Fi SFX](https://opengameart.org/content/50-cc0-sci-fi-sfx) | `beep_03.ogg` | rubberduck | CC0 1.0 | обрезка тишины, фейды, моно, пик −2 dBFS |
