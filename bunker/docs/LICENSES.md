# Ассеты и лицензии — BUNKER SURVIVAL

Каждый внешний файл проекта — с источником и лицензией. Коммерческое использование разрешено для всего списка.

## Движок

| Что | Источник | Лицензия |
|---|---|---|
| Godot Engine 4.6.3 (редактор — собран из исходников тега `4.6.3-stable`; в CI — официальная сборка) | github.com/godotengine/godot | MIT |
| Библиотека Godot для Android `org.godotengine:godot:4.6.3.stable` (AAR) | Maven Central | MIT |
| Шрифт интерфейса — встроенный шрифт Godot | Godot Engine | OFL / MIT (в составе движка) |

## Текстуры (PBR: цвет `_c`, AO/шероховатость/металл `_a`, нормали `_n`, 1K)

Все — **Poly Haven, CC0 1.0** (общественное достояние, без указания авторства). Папка `assets/textures/`.

| Файл в проекте | Ассет Poly Haven | Где используется |
|---|---|---|
| concrete_wall_* | concrete_wall_008 | стены бункера |
| concrete_floor_worn_001_* | concrete_floor_worn_001 | полы, ступени |
| cracked_concrete_wall_* | cracked_concrete_wall | потолки, портал входа, бетонные блоки |
| plastered_wall_* | grey_plaster_02 | медпункт, разрушенная постройка |
| floor_tiles_06_* | floor_tiles_06 | пол медпункта |
| metal_plate_* | metal_plate | пол коридора и шлюза, столы |
| rusty_metal_02_* | rusty_metal_02 | бочки, трубы, водонапорная башня |
| corrugated_iron_02_* | corrugated_iron_02 | крыша постройки, навес |
| asphalt_02_* | asphalt_02 | дорога |
| dry_ground_01_* | dry_ground_01 | земля поверхности |
| sparse_grass_* | sparse_grass | сухая трава на земле |
| rocky_gravel_* | rocky_gravel | гравий |
| mud_cracked_dry_03_*, brown_mud_leaves_01_* | mud_cracked_dry_03, brown_mud_leaves_01 | запасные наборы земли |
| rock_face_03_* | rock_face_03 | камни, срез грунта вокруг бункера |
| brown_planks_03_*, weathered_brown_planks_* | brown_planks_03, weathered_brown_planks | ящики, поддоны, верстак |
| red_brick_03_* | red_brick_03 | кирпич постройки |
| bark_brown_02_* | bark_brown_02 | мёртвые деревья |

Часть наборов (13) взята из прошлого проекта пользователя в этом же репозитории (`art3d/pbr/`), они тоже скачаны с Poly Haven
под CC0; 6 наборов скачаны заново через api.polyhaven.com.

## 3D-модели

| Что | Источник | Лицензия / права |
|---|---|---|
| Герой, герой в костюме, инженер, медик, мародёр (со скелетом и движениями) | Tripo AI, аккаунт пользователя (тариф Premium), см. `TRIPO_LOG.md` | права у пользователя по условиям Tripo для платного тарифа (коммерческое использование разрешено) |
| 30 движений по тексту, готовые движения Tripo | Tripo AI, тот же аккаунт | то же |
| Генератор, электрощит, пульт, дозиметрическая установка, вентустановка, верстак, грузовик и др. (`assets/models/*.glb`) | Tripo AI, тот же аккаунт | то же |
| Всё остальное: стены, двери, мебель, оборудование, техника по умолчанию, деревья, забор, трава, рельеф | процедурная геометрия BunkerCore (`core/world/prefabs.gd` и др.) | собственный код проекта |

Перед публикацией в магазине стоит перечитать действующие условия Tripo (tripo3d.ai/terms) — они могут меняться.

## Звук

Папка `assets/audio/` — 88 файлов Ogg Vorbis (≈2.3 МБ), настоящие записи из открытых наборов. Полная таблица по
каждому файлу (страница-источник, исходный файл, автор, лицензия, что изменено) — в `AUDIO_SOURCES.md`.

| Что | Источник | Лицензия |
|---|---|---|
| Большинство звуков: шаги по бетону, удары, колокол заданий, щелчки интерфейса, нож, предметы (Impact Sounds, RPG Audio, UI Audio, Interface Sounds) | Kenney, kenney.nl | CC0 |
| Двери, металл, вентиляция, генератор, вода, монстры, сигналы терминала (наборы «100 CC0 SFX», «30 CC0 SFX loops», «80 CC0 creature SFX #2» и др.) | rubberduck, opengameart.org | CC0 |
| Удары, полотенце (падение тела), голос боли героя, сердцебиение, глотки, капель, лязг запора | qubodup, opengameart.org | CC0 |
| Голоса противника, стоны, рычание мутанта, взмахи, шаги в костюме, молния, двигатель, хруст, замок, ворона и др. | HaelDB, thebardofblasphemy, pauliuw, artisticdude, Fantozzi, AntumDeluge, looneybits, YCbCr, sinny, bart, mikeask, StarNinjas, Cough-E, zeroisnotnull — opengameart.org | CC0 |
| Шаги по бетону (`step_concrete_6`), по металлу (`step_metal_*`), по гравию (`step_dirt_*`) | swuing, Eelke, Ali_6868 (freesound), обработка congusbongus — «Footsteps on different surfaces», opengameart.org | CC-BY 3.0 (гравий — CC0 в исходнике) |
| Ветер поверхности (`amb_wind`) | Jonathan Shaw (InspectorJ), цикл AntumDeluge — «Wind Loop», opengameart.org | CC-BY 3.0 |
| Ночной ветер (`amb_night`) | Tsorthan Grove — «Storm Arwen 2022», opengameart.org | CC-BY 4.0 |

Для CC-BY нужно указать авторов в титрах или на странице игры — готовые строки в `AUDIO_SOURCES.md`, раздел
«Указание авторов». Прежние синтезированные звуки (`tools/gen_audio.py`) удалены, скрипт больше не используется.

## Код

BunkerCore (`core/`), игра (`game/`), инструменты (`tools/`), Android-проект (`android/`) — код проекта.
Шаблон Android-активности основан на шаблоне Godot (MIT).
