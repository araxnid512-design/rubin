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
| `cloth` | ткань, снаряжение | — | HaelDB «Footsteps Leather, Cloth, Armor», Fantozzi/qubodup | CC0 |
| `zip` | молния рюкзака | — | AntumDeluge «Zipper», Kenney | CC0 |
| `swoosh`, `swing` | взмах рукой, ногой, мачете | — | artisticdude «Swishes Sound Pack» | CC0 |
| `punch` | удар по телу | — | qubodup «37 hits/punches», Kenney | CC0 |
| `hurt` | стон, усилие | — | qubodup «15 vocal male strain/hurt/pain/jump sounds» | CC0 |
| `body_fall` | падение тела | — | qubodup «12 wet towel …», Kenney | CC0 |
| `breath_run` | дыхание на бегу | — | mikeask «Breathing Tired» | CC0 |
| `block` | блок мачете | — | rubberduck, Kenney | CC0 |
| `rock_rip`, `rock_throw`, `rock_hit` | Рубер вырывает камень, бросок, удар камня | синтез с нуля (шум, низкие тона, щелчки осыпи) | свой: `stand/tools/make_rock_sounds.py` | свой |
- `music_menu.mp3` — музыка главного меню и карты мира: «Dead Sector», прислана пользователем (его композиция).
