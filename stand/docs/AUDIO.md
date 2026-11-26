# Звуки стенда — что откуда и под какой лицензией

Все звуки — настоящие записи из открытых наборов под **CC0 1.0** (общественное достояние, коммерческое
использование разрешено, указание автора не требуется — авторы перечислены из благодарности). Записей под
CC-BY, NC, с неясной лицензией и вырезанных из чужих игр и фильмов нет. Наборы уже проверены и описаны в
репозитории: оружие — `game/sfx/CREDITS.md`, тело и снаряжение — `bunker/docs/AUDIO_SOURCES.md`.

Сборка: `python3 stand/tools/build_audio.py` (из корня репозитория) — копирует нужные файлы и режет длинные
записи перезарядки на отдельные щелчки (ffmpeg, моно, Ogg Vorbis q4, короткие фейды на срезах).

| Звук в стенде | Что это | Запись | Набор / автор | Лицензия |
|---|---|---|---|---|
| `shot_tt` | выстрел ТТ | Colt 1911 | The Free Firearm Sound Library (FFSL), opengameart.org/content/the-free-firearm-sound-library | CC0 |
| `shot_beretta` | Beretta 92FS | Walther PPQ (9×19, тот же патрон) | FFSL | CC0 |
| `shot_ak` | АК-74М | AR-15 (5,56 — тот же класс, что 5,45) | FFSL | CC0 |
| `shot_mp5` | MP5 | Carl Gustav M45 (9×19) | FFSL | CC0 |
| `shot_fal` | FN FAL | АК-47 и SKS | FFSL | CC0 |
| `shot_svd` | СВД | винтовка Мосина (7,62×54R — патрон СВД) | FFSL | CC0 |
| `shot_vss` | ВСС | Ruger Mark III, приглушено, + щелчок затвора (LFA «equipment clicks III») | FFSL, LFA | CC0 |
| `shot_pkp` | ПКП | пулемёт ПК (видео морской пехоты США) | общественное достояние | PD |
| `shot_spas` | SPAS-12 | Benelli Nova, Charles Daly, Winchester M12 | FFSL | CC0 |
| `casing`, `shell` | гильза, гильза дробовика | — | BMacZero «Metal Impact Sounds», rubberduck | CC0 |
| `mag_out`, `mag_in` | магазин вынут / вставлен | нарезка `assaultriflereload1` | SpringySpringo «Gun reload sounds» | CC0 |
| `bolt_back`, `bolt_fwd` | затвор назад / вперёд | нарезка | SpringySpringo, BMacZero «Gun Reload Sound Effects» | CC0 |
| `slide_back`, `slide_fwd` | кожух-затвор пистолета | нарезка | SpringySpringo | CC0 |
| `cover_open`, `box_in`, `cover_close` | крышка и короб пулемёта | нарезка | StarNinjas «2 Gun Reloads» | CC0 |
| `shell_in`, `pump` | патрон в дробовик, цевьё | — | zer0_sol «Shotgun Reload Sound effects» | CC0 |
| `click`, `dry` | защёлка, осечка | — | SpringySpringo, LFA | CC0 |
| `mag_drop` | магазин упал | — | BMacZero / rubberduck | CC0 |
| `hit_wood` | попадание в мишень | — | rubberduck «75 CC0 breaking / falling / hit sfx» | CC0 |
| `step` | шаги по бетону | `footstep_concrete_000…004` | Kenney «Impact Sounds» | CC0 |
| `step_concrete` | шаги по бетону | те же записи, что `step` | Kenney «Impact Sounds» | CC0 |
| `step_wood` | шаги по дереву | `sfx100v2_footstep_wood_01…04` | rubberduck «100 CC0 SFX #2», opengameart.org/content/100-cc0-sfx-2 | CC0 |
| `step_metal` | шаги по металлу | `bfh1_metal_hit_01, 04, 05, 06` (начало удара, приглушено) | rubberduck «75 CC0 breaking / falling / hit sfx» | CC0 |
| `door_creak` | дверь | `qubodup-DoorOpen01`, `DoorOpen04` | qubodup «Door Open / Door Close Set», opengameart.org/content/door-open-door-close-set | CC0 |
| `gate_open` | ворота гаража | начало `blast_door` (см. `bunker/docs/AUDIO_SOURCES.md`: «Metal Interactions», «old elevator door», rubberduck) | — | CC0 |
| `cloth` | ткань, снаряжение | — | HaelDB «Footsteps Leather, Cloth, Armor», Fantozzi/qubodup | CC0 |
| `zip` | молния рюкзака | — | AntumDeluge «Zipper», Kenney | CC0 |
| `swoosh`, `swing` | взмах рукой, ногой, мачете | — | artisticdude «Swishes Sound Pack» | CC0 |
| `punch` | удар по телу | — | qubodup «37 hits/punches», Kenney | CC0 |
| `hurt` | стон, усилие | — | qubodup «15 vocal male strain/hurt/pain/jump sounds» | CC0 |
| `body_fall` | падение тела | — | qubodup «12 wet towel …», Kenney | CC0 |
| `breath_run` | дыхание на бегу | — | mikeask «Breathing Tired» | CC0 |
| `block` | блок мачете | — | rubberduck, Kenney | CC0 |
| `rock_rip`, `rock_hit` | Рубер вырывает камень, удар камня | `bfh1_rock_breaking_01, 02`, `bfh1_rock_falling_01, 03`, замедлено до 0,8 (крупнее) | rubberduck «75 CC0 breaking / falling / hit sfx» | CC0 |
| `rock_throw` | бросок камня | взмах `swoosh`, замедлен до 0,6 | artisticdude «Swishes Sound Pack» | CC0 |
| `growl`, `roar`, `zdeath` | голоса заражённых: стон, крик при броске, предсмертный хрип | `zombie-17, 18, 21, 15` / `zombie-10, 12, 8` / `zombie-2, 22, 13` — человеческий голос | artisticdude «Zombies Sound Pack», opengameart.org/content/zombies-sound-pack | CC0 |
| `chew` | заражённый ест | `crunch.2, 4, 6`, замедлено до 0,88 | StarNinjas «7 Eating Crunches», opengameart.org/content/7-eating-crunches | CC0 |
| `grenade_boom` | разрыв гранаты, ракеты, снаряда | `gren_1`, `gren_2`, `expl_2` из `game/sfx` (подрыв заряда — видео морской пехоты США; «Chunky Explosion», Joth) | см. `game/sfx/CREDITS.md` | PD / CC0 |
| `grenade_tink` | граната стукнула о пол | `clink1` | BMacZero «Metal Impact Sounds» | CC0 |
| `shot_deagle` | Desert Eagle главаря | карабин Marlin 336 (.30-30) | FFSL | CC0 |
| `shot_rpg`, `rocket_fly` | выстрел РПГ-7Д и гул уходящей гранаты | настоящий РПГ-7 и двигатель ракеты (`rpg_1…3`, `rpg_fly` из `game/sfx`) — видео армии и морской пехоты США | общественное достояние | PD |
| `thump_light`, `thump_mid`, `thump_heavy` | «вес» выстрела — низ настоящего выстрела (всё выше ~200 Гц срезано) | Colt 1911, АК-47, винтовка Мосина | FFSL | CC0 |
| `tail_open`, `tail_room` | раскат выстрела на улице, короткий отзвук в помещении | дальний микрофон тех же записей (`rifle_f1`, `sniper_f1`, `pistol_f1`, `smg_f1` из `game/sfx`) | FFSL | CC0 |
| `engine_loop` | двигатель УАЗа | `car_engine_loop_1` | GGBotNet «Car Sound Effects Pack», opengameart.org/content/car-sound-effects-pack-low-quality | CC0 |
| `rain_loop` | дождь | `2.ogg`, 12 с, шов цикла сглажен | «Rain (loopable)», opengameart.org/content/rain-loopable | CC0 |
- `music_menu.mp3` — музыка главного меню и карты мира: «Dead Sector», прислана пользователем (его композиция).

## 26.11: синтезированных звуков больше нет

Пользователь: «Звуки мух убрать и звуки нормальные сделать, а не мультяшные». Раньше часть звуков считалась
программой (синус, шум): шаги по дереву, металлу и бетону, скрип двери, ворота, взрыв гранаты, Desert Eagle, камни
Рубера, чавканье, двигатель УАЗа, дождь, слои «веса» и «хвоста» выстрела, жужжание мух; а голоса заражённых были
рыками «существ» из наборов для RPG. Теперь всё перечисленное — настоящие записи (таблица выше), собирается
`tools/real_sounds.py` (обрезка тишины, фейды, моно, громкость — как у прежнего файла). Жужжание мух убрано совсем
(мухи над телами только видны). Высота тона у новых стволов больше не уводится далеко от записи (не больше ±7 %,
M16A4 звучит записью AR-15 как есть; M32 — дробовик, замедленный до 0,82; РПГ-7Д — настоящий РПГ-7).
Прежние генераторы (`tools/make_sfx.py`, `make_rock_sounds.py`, `make_chew_sounds.py`, `make_boss_sounds.py`,
звуковая часть `make_weather_assets.py` и `make_car_assets.py`) в игре больше не используются.
Не менялись два служебных сигнала интерфейса: `beep` (писк таймера) и `alarm` (сирена перед перезагрузкой
кластера) — электронные сигналы; откуда эти два файла, в описании не записано (добавлены со сборкой 36).
У крупных мутантов голос по-прежнему ниже (поле `voice` в `data/enemies.json`: запись проигрывается медленнее).

