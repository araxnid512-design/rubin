# Каталог бесплатных ассетов — «Улей. Кластер-17» (Godot)

Ориентир по картинке — концепт «STIKS_location_concept_v1» и мобильная Dawn of Zombies: Survival: осенний
посёлок 1990-х, мокрый растрескавшийся асфальт с лужами, бурьян вдоль дорог, дома с белёными стенами и
замшелым шифером, ржавые «жигули», штакетник и рабица, ящики, бочки, покрышки, столбы с проводами, берёзы и
сосны; реалистичный выживший (куртка, карго, рюкзак), клипы стрельбы, топора, бега.
Платформа — телефон (Godot 4.4.1, `gl_compatibility`, камера сверху ~58°), поэтому **FPS важнее красоты**.

Скачивание первого набора в CI — `scripts/fetch-assets.mjs` → `godot/assets/external/<категория>/<ассет>/`,
авторы и лицензии — `godot/assets/external/LICENSES.md` (пишет скрипт). Папка в git не хранится.

Сверено в ноябре 2026 по страницам источников (поиск и копии на GitHub); сами сайты ассетов из облачной среды
закрыты, поэтому размеры файлов помечены «≈», где их не удалось увидеть, а ID на ambientCG и Poly Haven взяты
со страниц ассетов. Что проверить глазами после первой выгрузки — помечено **(проверить)**.

## Правила

- **Можно:** CC0 (лучше всего), CC BY 3.0/4.0 (автор — в `LICENSES.md` и в титрах игры), код шейдеров —
  CC0 или MIT (с текстом лицензии в шапке файла).
- **Нельзя:** платное, «рипы» из коммерческих игр (в том числе из Dawn of Zombies), NC/«только личное
  использование», ND, файлы без понятной лицензии (aitextured, бесплатные модели CGTrader/TurboSquid/Free3D
  с «royalty free», Poliigon), наборы, которые запрещено выкладывать в открытый репозиторий (Sonniss GDC
  Bundle — royalty-free, но не CC; файлы Mixamo — см. ниже).
- CC BY-SA — не брать без отдельного решения (требует той же лицензии для изменённых файлов).

## Бюджет под телефон

| Что | Предел | Как |
|---|---|---|
| Текстуры земли и стен | 1K (1024²), на «Низком» — 512 | сжатие ETC2/ASTC уже включено (`import_etc2_astc`); на профиле «Низкое» — `process/size_limit=512` в импорте |
| Мелкие предметы | 512² | одна текстура-атлас на пачку предметов |
| Карты материала | цвет + нормаль + ORM | у Poly Haven карта `arm` = AO/шероховатость/металл → сразу `ORMMaterial3D` (3 текстуры на материал) |
| Уникальных материалов на локацию | 10–12 | земля — один шейдер-смесь 3–4 слоёв по цвету вершин, без triplanar |
| Предметы (бочка, покрышка, ящик) | ≤ 3–5K треугольников | дальше — `visibility_range` и пачки MultiMesh |
| Машина | ≤ 13K, 1–2 на локацию | сливать в статику, как в браузерной версии |
| Дерево | ≤ 2–4K + LOD | крест из двух карточек вдали; листья — alpha scissor, не blend |
| Трава | MultiMesh карточек | alpha scissor; плотность — по профилю качества |
| Персонаж | ≤ 10–15K, 1 материал кожи+одежды | 1K атлас |
| Вызовов отрисовки | ~100–150 в кадре | тест браузерной версии печатает «нагрузку в кадре» — ориентир тот же |
| Звук | OGG Vorbis, эффекты моно | фоновые петли — стерео |

Экспорт APK сейчас с `export_filter="all_resources"`: **в APK попадает всё из `res://`**. Когда клипы из
больших библиотек анимаций будут перенесены (см. «Анимации»), сохранить их в `.res` и добавить в
`godot/export_presets.cfg` `exclude_filter="assets/external/animations/*"` — иначе APK вырастет на ~40 МБ.

## Брать первым (это и качает `scripts/fetch-assets.mjs`)

| # | Что | Откуда | Лицензия | Зачем первым |
|---|---|---|---|---|
| 1 | 18 PBR-текстур 1K: асфальт с выбоинами и мокрый, обочина, листва, бурьян, шифер, мох, ржавый профнастил, серые и крашеные доски, белёная штукатурка, бетон, кирпич, синяя ржавая жесть, сосновая кора, рабица, атлас травы, опавшие листья | Poly Haven, ambientCG | CC0 | главное отличие картинки «как на концепте» почти бесплатно для FPS: геометрия та же, меняются только материалы |
| 2 | Бочка, покрышка (~3K), машина под тентом (~13K) | Poly Haven | CC0 | реалистичные и лёгкие; остальные предметы Poly Haven тяжелее 10K — во второй набор |
| 3 | Universal Animation Library 1 и 2 (250+ клипов на одном скелете) | Quaternius (копия на GitHub, закреплена коммитом) | CC0 | бег, ходьба, присед, пистолет, удары, рубка, походка зомби, смерти — одним скелетом, переносятся на героя через `SkeletonProfileHumanoid` |
| 4 | Частицы: вспышки, дым, огонь, искры, пыль, гарь; взрывы; брызги крови | Kenney, OpenGameArt | CC0 | дешёвые спрайты 512² вместо процедурных эффектов |
| 5 | Звуки: осенний ветер, ясный день, дождь, морось, гром, ночь, взмах топора, дверь; 24 звука заражённых; выстрелы СКС/Мосина/CZ-52/дробовика; удары и фоли | CC-Sounds (GitHub), OpenGameArt, Kenney | CC0 и CC BY 3.0 | в Godot-версии звуков ещё нет; плюс можно сразу взять уже лицензированные `assets/sounds/*.mp3` браузерной версии (`assets/sounds/CREDITS.md`) |

Оценка: скачивание ≈ 150–200 МБ (архивы ambientCG и звуковые наборы), на диске после отбора ≈ 120 МБ,
в APK — только то, что реально используется.

---

## 1. PBR-текстуры

Прямые ссылки:
- **Poly Haven:** список файлов с md5 — `https://api.polyhaven.com/files/<id>` (ключи `Diffuse`, `nor_gl`,
  `Rough`, `arm`, `AO`, `Displacement` → `1k` → `jpg` → `url`); шаблон адреса —
  `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/<id>/<id>_<карта>_1k.jpg`, карты `diff`, `nor_gl`, `arm`.
  Нормали — OpenGL (как ждёт Godot). Автор каждого ассета — `https://api.polyhaven.com/info/<id>` (скрипт берёт сам).
- **ambientCG:** `https://ambientcg.com/get?file=<id>_1K-JPG.zip` (перенаправляет на файл; в архиве `_Color`,
  `_NormalGL`, `_NormalDX`, `_Roughness`, `_Displacement`, иногда `_AmbientOcclusion`, `_Opacity`, `_Metalness`;
  скрипт оставляет нужные). Архив 1K ≈ 2–8 МБ. Запасной путь — API
  `https://ambientcg.com/api/v2/full_json?id=<id>&include=downloadData`. Автор — ambientCG (Lennart Demes).

Обозначения: **★** — в первом наборе. Размер 1K-карты Poly Haven ≈ 0,3–1,5 МБ (JPG).

| ★ | Ассет (ID) | Источник | Что заменит в игре | Ссылка |
|---|---|---|---|---|
| ★ | `road_damaged` — асфальт с трещинами, выбоинами, заплатками | Poly Haven, CC0 | асфальт улиц | https://polyhaven.com/a/road_damaged |
|   | `road_damaged_2` — сильно изношенный, со следами ям | Poly Haven, CC0 | второй вариант дороги, развилки | https://polyhaven.com/a/road_damaged_2 |
|   | `asphalt_02` — мелкие трещины, крупный щебень | Poly Haven, CC0 | целые участки, площадка стаба | https://polyhaven.com/a/asphalt_02 |
|   | `worn_asphalt` — гравий, трещины, листва, ветки | Poly Haven, CC0 | дворы, края дорог | https://polyhaven.com/a/worn_asphalt |
| ★ | `Asphalt024C` — «Asphalt Cracked Wet» | ambientCG, CC0 | мокрый асфальт, слой луж (маска в шейдере) | https://ambientcg.com/view?id=Asphalt024C |
|   | `Asphalt025C` (тёмный мокрый после дождя), `Asphalt026B` (трещины, разрушения), `Road009C`, `RoadLines031C` (разметка) | ambientCG, CC0 | варианты дороги и разметка | https://ambientcg.com/view?id=Asphalt026B |
| ★ | `brown_mud_leaves_01` — грязь, трава, мох, камешки (Rob Tuytel) | Poly Haven, CC0 | обочины, тропинки | https://polyhaven.com/a/brown_mud_leaves_01 |
| ★ | `leaves_forest_ground` — опавшая листва, ветки (Dimitrios Savva) | Poly Haven, CC0 | под берёзами, сады | https://polyhaven.com/a/leaves_forest_ground |
|   | `dirt_floor`, `forest_ground_04` | Poly Haven, CC0 | голый грунт, лес | https://polyhaven.com/a/dirt_floor |
| ★ | `Grass007` — трава с сорняками | ambientCG, CC0 | пустыри, бурьян **(проверить)** | https://ambientcg.com/view?id=Grass007 |
|   | `Ground070` (осенний лес: листья, корни), `Ground020` (грунт, трава, листья), `Ground038` (ветки) | ambientCG, CC0 | запасные слои земли | https://ambientcg.com/view?id=Ground070 |
| ★ | `asbestos_sheet` — волнистый асбестоцемент, царапины, отверстия болтов | Poly Haven, CC0 | **шифер** крыш | https://polyhaven.com/a/asbestos_sheet |
| ★ | `Moss001` | ambientCG, CC0 | мох поверх шифера, бетона, земли у стен (второй слой по маске) | https://ambientcg.com/view?id=Moss001 |
| ★ | `rusty_corrugated_iron` — оранжево-бурая ржавчина, отслоения | Poly Haven, CC0 | ржавый профнастил: гаражи, сараи, заборы | https://polyhaven.com/a/rusty_corrugated_iron |
|   | `corrugated_iron_03/04` (крашеный зелёный с потёками), `rusty_metal_03`, `rust_coarse_01` | Poly Haven, CC0 | варианты кровли, ржавые листы | https://polyhaven.com/a/corrugated_iron_03 |
|   | `CorrugatedSteel007A/B/C` (синий крашеный с ржавчиной), `CorrugatedSteel006A/B`, `008A/C` | ambientCG, CC0 | крашеный профнастил | https://ambientcg.com/view?id=CorrugatedSteel007B |
| ★ | `raw_plank_wall` — выветренные доски со сколами | Poly Haven, CC0 | штакетник, сараи, ящики | https://polyhaven.com/a/raw_plank_wall |
| ★ | `wood_peeling_paint_weathered` — крашеные доски, краска облезла | Poly Haven, CC0 | дома, ставни, наличники (оттенок — в шейдере) | https://polyhaven.com/a/wood_peeling_paint_weathered |
|   | `WoodSiding001–007` (тёмные, грязные, замшелые доски обшивки), `weathered_brown_planks` | ambientCG / Poly Haven, CC0 | обшивка домов, бани | https://ambientcg.com/view?id=WoodSiding005 |
| ★ | `concrete_wall_001` — белёная штукатурка, сколы, трещины | Poly Haven, CC0 | стены домов как на концепте | https://polyhaven.com/a/concrete_wall_001 |
|   | `painted_plaster_wall`, `white_rough_plaster`, `PaintedPlaster006` (облезлый фасад) | Poly Haven / ambientCG, CC0 | варианты стен | https://polyhaven.com/a/painted_plaster_wall |
| ★ | `concrete_wall_008` — бетон с подтёками и трещинами | Poly Haven, CC0 | плиты, столбы, фундаменты, «Карьер» | https://polyhaven.com/a/concrete_wall_008 |
|   | `precast_concrete_wall`, `Concrete036` | Poly Haven / ambientCG, CC0 | бетонные заборы-плиты | https://polyhaven.com/a/precast_concrete_wall |
| ★ | `mixed_brick_wall` — старый кирпич | Poly Haven, CC0 | трубы, руины, стаб | https://polyhaven.com/a/mixed_brick_wall |
|   | `brick_wall_001`, `red_bricks_04`, `white_bricks` (белый с облезлой краской) | Poly Haven, CC0 | варианты кирпича | https://polyhaven.com/a/white_bricks |
| ★ | `PaintedMetal007` — «Blue Metal Painted Rust» | ambientCG, CC0 | кузов синих «жигулей», ворота | https://ambientcg.com/view?id=PaintedMetal007 |
|   | `PaintedMetal008/009/012/013/014` (серый, оранжевый, белый, жёлтый с ржавчиной), `Rust006`, `Metal026` | ambientCG, CC0 | другие машины, бочки, ворота | https://ambientcg.com/view?id=PaintedMetal013 |
| ★ | `pine_bark` | Poly Haven, CC0 | стволы сосен | https://polyhaven.com/a/pine_bark |
|   | `knotted_pine_bark`, `bark_brown_01/02`, `Bark002/006/011` | Poly Haven / ambientCG, CC0 | прочие стволы, пни | https://polyhaven.com/a/knotted_pine_bark |
|   | береста | — | CC0 не нашлось: рисовать процедурно (белое с чёрными чёрточками) или по фото с CC0 | — |
| ★ | `Fence006` — проволочная сетка с прозрачностью | ambientCG, CC0 | **рабица** **(проверить узор; запасные `Fence001/003/005`)** | https://ambientcg.com/view?id=Fence006 |
| ★ | `LeafSet026` — атлас травинок с прозрачностью | ambientCG, CC0 | трава-карточки (MultiMesh), бурьян | https://ambientcg.com/view?id=LeafSet026 |
|   | `LeafSet030` (сухие осенние листья), `Foliage008` (газон), атлас хвои «Leaf Needles Set» | ambientCG, CC0 | кусты, хвоя, лиственные карточки | https://ambientcg.com/view?id=LeafSet030 |
| ★ | `ScatteredLeaves001` — опавшие листья | ambientCG, CC0 | наклейки листвы на асфальт и крыльца | https://ambientcg.com/view?id=ScatteredLeaves001 |
|   | ткань и кожа для одежды выжившего: `Fabric0xx` (канва, брезент), `Leather0xx` | ambientCG, CC0 | куртка, рюкзак, ремни **(подобрать по виду)** | https://ambientcg.com |

## 2. Модели

Poly Haven отдаёт glTF 1K: `https://api.polyhaven.com/files/<id>` → `gltf` → `1k` → `gltf` (`url` и `include`
с буфером и текстурами); шаблон — `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/<id>/<id>_1k.gltf`.
Большинство моделей Poly Haven рассчитаны на рендер, а не на телефон: брать только лёгкие, тяжёлые — как образец.

| ★ | Модель | Источник, автор | Треугольники | Что заменит | Ссылка |
|---|---|---|---|---|---|
| ★ | `Barrel_01` — ржавая красная бочка | Poly Haven, Jorge Camacho, CC0 | ~3K | бочки (и взрывающиеся) | https://polyhaven.com/a/Barrel_01 |
| ★ | `old_tyre` — грязная покрышка | Poly Haven, CC0 | ~3K | покрышки у сараев и в бурьяне | https://polyhaven.com/a/old_tyre |
| ★ | `covered_car` — машина под пыльным тентом | Poly Haven, CC0 | ~13K | 1–2 на локацию, рядом с гаражами | https://polyhaven.com/a/covered_car |
|   | `barrel_03` (синяя), `barrel_stove` (бочка-печка), `oil_tin`, `metal_trash_can`, `rusted_wheel_rim_02` | Poly Haven, CC0 | (проверить) | костры, мусор, тайники | https://polyhaven.com/a/barrel_stove |
|   | `metal_jerrycan_green` (20 л) | Poly Haven, CC0 | ~10K | канистра-тайник (с упрощением) | https://polyhaven.com/a/metal_jerrycan_green |
|   | `small_lpg_tank` (газовый баллон) | Poly Haven, CC0 | ~15K | баллоны (нужно упростить) | https://polyhaven.com/a/small_lpg_tank |
|   | `cardboard_box_01` | Poly Haven, Rahul Chaudhary, CC0 | ~17K | тяжёл — только как образец | https://polyhaven.com/a/cardboard_box_01 |
|   | `wooden_crate_01/02` | Poly Haven, CC0 | ~7K / ~5K | это сундуки, не советские ящики — лучше свои ящики с `raw_plank_wall` | https://polyhaven.com/a/wooden_crate_02 |
|   | `modular_electricity_poles` — деревянные столбы с трансформатором, изоляторами, кабелями | Poly Haven, James Ray Cock, CC0 | ~201K | только как образец; столбы оставить свои, с `raw_plank_wall`/`pine_bark` | https://polyhaven.com/a/modular_electricity_poles |
|   | `modular_chainlink_fence` — рабица с ржавыми столбами и калиткой | Poly Haven, James Ray Cock, CC0 | ~89K | только текстура; забор — свои плоскости с `Fence006` | https://polyhaven.com/a/modular_chainlink_fence |
|   | `dead_tree_trunk`, `dead_tree_trunk_02`, `tree_stump_01/02` | Poly Haven, CC0 | 8K-текстуры, тяжёлые (проверить) | поваленные стволы, пни — после упрощения | https://polyhaven.com/a/tree_stump_01 |
|   | `pine_tree_01`, `fir_tree_01`, `pine_sapling_small`, `fir_sapling` | Poly Haven, CC0 | сотни тысяч – ~2M | **не для телефона**: образец или запекание импостора | https://polyhaven.com/a/pine_tree_01 |
|   | `shrub_02/03/04`, `grass_medium_01/02` | Poly Haven, CC0 | высокие (проверить) | источник для запекания атласов кустов и травы | https://polyhaven.com/a/shrub_04 |
|   | Lada-2107 (Zhiguli) Low-Poly | Sketchfab, AnonimProdaction228, **CC BY** | ~1,5K | старые седаны — лучше всего по стилю; **вручную** (вход на Sketchfab) | https://sketchfab.com/3d-models/lada-2107-zhiguli-low-poly-2496c57dce2e47d59fe6f5a2adf516c9 |
|   | Zhiguli Soviet Cars (набор) | Sketchfab, spacelynxcanfly, **CC BY** | низкие | вручную | https://sketchfab.com/3d-models/zhiguli-soviet-cars-7c3f4bee5d37401d853d2206dc7859fc |
|   | Low-poly Brick House with Veranda – 1990s Rural Style | Sketchfab, **CC BY** (проверить, что лицензия не сменилась после переезда на Fab) | низкие | кирпичный дом 1990-х; вручную | https://sketchfab.com/3d-models/low-poly-brick-house-ea82ea891829493aadeea889cd473e89 |
|   | Car Kit (45+ машин, обломки) | Kenney, CC0 | очень низкие | стилизовано — запасной вариант | https://kenney.nl/assets/car-kit |
|   | LowPoly Cars, Zombie Apocalypse Kit (машины, окружение) | Quaternius, CC0 | очень низкие | стилизовано — запасной вариант | https://quaternius.com/packs/zombieapocalypsekit.html |

**Дома, заборы, столбы, ящики** — бесплатных реалистичных и при этом лёгких моделей деревенских домов 1990-х
под CC0 нет (на Sketchfab — CC BY, единично; на маркетплейсах — платно). Выгоднее всего оставить геометрию,
которую строит код браузерной игры (`game/buildings.js`, `game/props.js` → `scripts/export-godot.mjs`): она
уже слита в пачки и лёгкая, — и надеть на неё текстуры из раздела 1 (шифер+мох, белёная штукатурка, крашеные
доски, `raw_plank_wall` для штакетника, `Fence006` для рабицы, `PaintedMetal007` для машин).

**Деревья (берёза, сосна)** — CC0 лёгких реалистичных берёз не нашлось. Предлагаемый путь:
[EZ-Tree](https://github.com/dgreenheck/ez-tree) (MIT, генератор на three.js, npm `@dgreenheck/ez-tree`,
выгрузка в GLB с LOD; пресеты `aspen_*` — осина, близко к берёзе, `pine_*`, `oak_*`, `ash_*`, `bush_1..3`;
у `aspen_medium` ветки ≈ 3,3K треугольников + карточки листьев — уменьшить уровни/сегменты до ≈ 1,5–2K).
Генерировать в нашей странице выгрузки (`tools/godot-export.html`, three 0.170) с берестой своей текстурой.
Запасные варианты: Low poly birch tree (Sketchfab, OmegaModels, **CC BY**, вручную) и Quaternius Stylized
Nature MegaKit (CC0, стилизованный, есть копия на GitHub — см. ниже).

## 3. Персонажи и анимации

Скелеты: герой (`models/game/player.glb`) — стандартный скелет Mixamo (65 костей); Quaternius UAL — свой
«универсальный» скелет в стиле манекена Unreal (`pelvis`, `spine_01`, `thigh_l`…). Оба переводятся на
`SkeletonProfileHumanoid` (импорт → Skeleton3D → Retarget → Bone Map, автоподбор костей) — после этого клипы
UAL играют на герое. Имена клипов в `player.gd` (`Idle`, `Walk`, `Run`, `Melee`, `IdlePistol`…) — задать
переименованием при импорте или таблицей соответствия. Точные имена клипов UAL смотреть в импорте
**(проверить)**: в UAL1 есть ходьба/бег в 8 направлениях, присед, ползком, пистолет, удары, рубка и добыча,
броски, попадания, смерти; в UAL2 — комбо ближнего боя (раздельные удары с возвратом), стрейфы, паркур,
переноска, походка зомби. Готовых клипов **автомата** (прицел, очередь, перезарядка) в UAL не подтверждено —
для автомата оставить свои клипы героя (`src/hero-animations.js`) с IK левой руки или взять Mixamo (вручную).

| ★ | Что | Источник, лицензия | Формат, размер | Как скачать |
|---|---|---|---|---|
| ★ | Universal Animation Library (полная, 120+ клипов, без корневого движения и `_RM` с ним) — **используется**: шаг и бег героя (Walk_Loop, Jog_Fwd_Loop → `src/gait-ual.js`, `scripts/ual-gait.py`) | Quaternius, CC0 | GLB, 20,4 МБ (`UAL1.glb`) | GitHub (копия набора «как скачано»): https://raw.githubusercontent.com/tilakpatell/tilakverse-assets/3fc5b474cacffc5b3958aca4f8a652d3d9f75524/quaternius/universal-animation-library/Unreal-Godot/UAL1.glb ; оригинал — https://quaternius.com/packs/universalanimationlibrary.html , бесплатная Standard (45 клипов, zip ≈ 14,5 МБ) — https://opengameart.org/content/universal-animation-library |
| ★ | Universal Animation Library 2 (130+ клипов) | Quaternius, CC0 | GLB, 19,8 МБ (`UAL2.glb`) | https://raw.githubusercontent.com/tilakpatell/tilakverse-assets/b88b0c642f0f04c031f20b4304ff95878f79528e/quaternius/universal-animation-library-2/Unreal-Godot/UAL2.glb ; оригинал — https://quaternius.com/packs/universalanimationlibrary2.html , Standard (zip ≈ 10,3 МБ) — https://opengameart.org/content/universal-animation-library-2 |
|   | Universal Base Characters (6 тел, скелет Humanoid, совместим с UAL) | Quaternius, CC0 | FBX/glTF, ~13K треуг., стилизованы | вручную: https://quaternius.itch.io/universal-base-characters |
|   | Zombie Apocalypse Kit (4 выживших × 20 клипов, 4 зомби, 2 собаки, окружение, машины) | Quaternius, CC0 | FBX/OBJ/glTF/Blend, стилизовано | вручную: https://quaternius.com/packs/zombieapocalypsekit.html |
|   | Ultimate Animated Character Pack (50+ персонажей, в том числе зомби и солдаты) | Quaternius, CC0 | zip на OpenGameArt | https://opengameart.org/content/animated-characters-pack |
|   | Zombie (5 клипов) | Quaternius, CC0 | GLB ≈ 0,7 МБ, ~2,1K треуг. | https://poly.pizza/m/VlXjG0N8Eg |
|   | Animated Characters 1/2 (скины, в том числе выживший и зомби; 3 клипа) | Kenney, CC0 | FBX/glTF, очень простые | https://opengameart.org/content/animated-characters-1 |
|   | **Реалистичный выживший** | MakeHuman, CC0 (база уже в `third_party/makehuman/`, из неё собран `models/zombie.glb`) | своя сборка | тот же путь, что у зомби: тело MakeHuman + своя одежда (куртка, карго, ботинки, рюкзак) с тканями ambientCG, 1K атлас, ≤ 15K треуг. |
|   | Mixamo (персонажи и клипы: Rifle Aiming Idle, Firing Rifle, Rifle Run/Walk, Reloading, Pistol Idle, Shooting, Standing Melee Attack Downward — удар топором сверху, Zombie Walk/Running/Attack/Biting/Dying, Hit Reaction, Dying) | Adobe Mixamo — бесплатно, вход Adobe; в играх можно, **сами файлы распространять нельзя** | FBX | **вручную**: FBX Binary, 30 к/с, клипы «Without Skin»; не класть в открытый репозиторий — держать в приватном хранилище и подключать в CI отдельно (или перенести только итоговые клипы внутрь сборки) |

## 4. Эффекты

| ★ | Что | Источник, лицензия | Формат | Ссылка |
|---|---|---|---|---|
| ★ | Particle Pack: `muzzle_01–05` (вспышки), `smoke_*`, `fire_*`, `flame_*`, `spark_*`, `dirt_*`, `scorch_*`, `trace_*`, `light_*` | Kenney, CC0 | 80 PNG 512² (прозрачные и на чёрном), zip ≈ 10 МБ | https://kenney.nl/assets/particle-pack (копия: https://opengameart.org/content/particle-pack-80-sprites — `kenney_particlePack.zip`, 9,8 МБ) |
| ★ | Smoke Particles: взрывы, клубы дыма, вспышки (кадры) | Kenney, CC0 | 70 PNG | https://kenney.nl/assets/smoke-particles |
| ★ | Blood Splatter (крупные брызги) | ExileGL, OpenGameArt, CC0 | PNG высокого разрешения | https://opengameart.org/content/blood-splatter |
|   | miscBloodDecalParticles (капли крови) | OpenGameArt, CC0 | PNG 256² | https://opengameart.org/content/miscblooddecalparticles-bloodparticle01png |
|   | Health Overlay Images (кровь по краям экрана при ранении) | GreyFrogGames, CC0 | PNG 1920×1080 | https://opengameart.org/content/health-overlay-images |
|   | Light Masks (световые пятна фонарей и костров) | Kenney, CC0 | 150 PNG | https://kenney.nl/assets/light-masks |
|   | Splat Pack (кляксы — перекрасить в кровь/грязь) | Kenney, CC0 | PNG | https://kenney.nl/assets/splat-pack |
|   | Brackeys VFX Bundle | Brackeys, CC0 | itch.io, вручную | https://brackeysgames.itch.io/brackeys-vfx-bundle |

## 5. Звуки

Сначала — **уже лицензированные** записи браузерной версии: `assets/sounds/*.mp3` (выстрелы ПМ, АК, ПКМ, СВД,
дробовика, перезарядки, гильзы, стоны и смерть заражённых, удары, шаги по асфальту/траве/грунту/полу, ветер,
гром; авторы — `assets/sounds/CREDITS.md`, CC0/CC BY). Godot читает MP3 — их достаточно скопировать.
Новое из первого набора дополняет окружение и удары.

Набор **CC-Sounds** ([Fris0uman/cdda-soundpacks](https://github.com/Fris0uman/cdda-soundpacks), у каждого файла
свой автор, `credits.md` в папке) — на GitHub, файлы доступны по `raw.githubusercontent.com`.

| ★ | Что | Автор, лицензия | Ссылка (файл / первоисточник) |
|---|---|---|---|
| ★ | осенний ветер, пасмурно | Apostolinkyyti, CC0 | `…/environment/weather/weather_cloudy/weather_cloudy_autumn.ogg` / https://freesound.org/people/Apostolinkyyti/sounds/128940/ |
| ★ | осенний ясный день | klankbeeld, CC BY 3.0 | `…/environment/weather/weather_clear/weather_clear_autumn.ogg` / https://freesound.org/people/klankbeeld/sounds/324409/ |
| ★ | сильный дождь | Ali@k, CC0 | `…/environment/weather/heavyrain.ogg` / https://freesound.org/people/Ali@k/sounds/128907/ |
| ★ | морось | klankbeeld, CC BY 3.0 | `…/environment/weather/drizzle.ogg` / https://freesound.org/people/klankbeeld/sounds/325442/ |
| ★ | дальний гром | chromakei, CC0 | `…/environment/weather/thunder_far.ogg` / https://freesound.org/people/chromakei/sounds/398287/ |
| ★ | ночь, пасмурно | beambot, CC0 | `…/environment/weather/night/cloudy_night.ogg` / https://freesound.org/people/beambot/sounds/259987/ |
| ★ | взмах топора | qubodup, CC0 | `…/melee_swing/big_cutting/big_cutting_swing_1.ogg` / https://freesound.org/people/qubodup/sounds/59992/ |
| ★ | деревянная дверь | Peter Havran (Raven2236), CC BY 3.0 | `…/open_door/door_wood/open_door.ogg` / https://freesound.org/people/MaxDemianAGL/sounds/183603/ |
|   | ещё в наборе: `thunderstorm.ogg` (bruno.auzet, CC0), `WEATHER_RAINSTORM.ogg` (Iam_calderon, CC0), `thunder_near.ogg` (mrsorbias, CC BY 3.0), двери металл/забор/окно, удары, взрывы, огонь | см. `credits.md` в папках | https://github.com/Fris0uman/cdda-soundpacks/tree/master/sound/CC-Sounds |
| ★ | Zombies Sound Pack — 24 WAV (стоны, рык, атака, смерть) | artisticdude, CC0 | https://opengameart.org/content/zombies-sound-pack |
| ★ | Gunshot Sounds — пистолет CZ-52, винтовка Мосина, СКС, дробовик (стрельбище) | Tabasco, CC0 | https://opengameart.org/content/gunshot-sounds |
| ★ | Impact Sounds — 130 OGG: удары по металлу, дереву, доскам, стеклу (шаги — проверить) | Kenney, CC0 | https://kenney.nl/assets/impact-sounds |
| ★ | RPG Audio — 50 OGG: фоли одежды и ремней, двери, металл, оружие, шаги | Kenney, CC0 | https://kenney.nl/assets/rpg-audio |
|   | The Free Firearm Sound Library — пистолеты, винтовки, дробовики, автоматы | Jaszczak, Nelson, Heras, Nanney, CC0 | 7z ≈ 194 МБ — слишком велик для CI, отобрать вручную: https://opengameart.org/content/the-free-firearm-sound-library |
|   | Gun reload sounds (пистолет, винтовка, дробовик), Shotgun Reload Sound effects | OpenGameArt, CC0 | https://opengameart.org/content/gun-reload-sounds |
|   | Fantozzi's Footsteps (трава/песок, камень); Different steps on wood, stone, leaves, gravel and mud | OpenGameArt, CC0 | https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud |
|   | Footsteps on different surfaces (бетон, гравий, трава, дерево) | OpenGameArt, **CC BY 3.0** | https://opengameart.org/content/footsteps-on-different-surfaces |
|   | Forest Ambience (петля), Dark Rainy Night (дождь и гром) | OpenGameArt, CC0 | https://opengameart.org/content/forest-ambience |
|   | Zomby sfx pack (голосовые стоны, MP3) | saturn91, CC0 | https://opengameart.org/content/zomby-sfx-pack |
|   | JC Sounds — Nature Ambient Pack Vol 1 (лес, дождь — петли) | OpenGameArt, **CC BY 4.0** | https://opengameart.org/content/jc-sounds-nature-ambient-pack-vol-1 |
|   | Freesound — любые записи с фильтром «Creative Commons 0» | разные | https://freesound.org (оригиналы — после входа; предпросмотр `cdn.freesound.org` — низкое качество) |

Не брать: DEATH SOUNDS (Male) — CC BY-SA 4.0; Sonniss GDC Bundle — не CC (нельзя в открытый репозиторий).

## 6. Шейдеры Godot 4

В `gl_compatibility` нет экранных отражений (SSR) и дорогих экранных эффектов, поэтому готовые «лужи с
отражениями» с godotshaders.com — только как образец. Шейдеры — это код, скрипт их не качает: писать свои
короткие (по образцам с лицензией CC0/MIT, с указанием в шапке файла).

| Шейдер | Автор, лицензия | Что взять | Ссылка |
|---|---|---|---|
| Rain puddles with ripples and reflections | shadecore_dev, CC0 (в шапке; внутри части SSR от marcelb и ряби Zavie с Shadertoy — их лицензии не указаны) | только идею ряби (нормаль от капель); SSR — не для телефона | https://godotshaders.com/shader/rain-puddles-with-ripples-and-reflection/ |
| Rain Puddles V3 | MIT (нужно указать автора) | маска луж от шума | https://godotshaders.com/shader/rain-puddles-v1/ |
| Downhill Water Flow | лицензию проверить | мокрая поверхность: смесь нормалей, шероховатость по «мокроте» | https://godotshaders.com/shader/downhill-water-flow/ |
| Foliage Wind Shader | CC0 | качание листвы и кустов в вершинном шейдере | https://godotshaders.com/shader/foliage-wind-shader/ |
| Stylized grass with wind and deformation | GDQuest, MIT | ветер по шуму + приминание травы героем | https://godotshaders.com/shader/stylized-grass-with-wind-and-deformation/ |
| Stylized Multimesh Grass Shader | @_Malido, лицензию проверить (встречается CC0) | трава MultiMesh с ветром и приминанием | https://godotshaders.com/shader/stylized-multimesh-grass-shader/ |
| Pixel Art Wind Sway (MeshInstance3D) | CC0 | простое качание меша | https://godotshaders.com/shader/pixel-art-wind-sway-meshinstance3d-godot-4-0/ |
| Godot rain shader (мокрые материалы, лужи по шуму) | Lexpartizan, лицензию проверить | приёмы мокрого альбедо | https://github.com/Lexpartizan/Godot_rain_shader |

Свой дешёвый вариант для телефона: (1) **мокрый асфальт и лужи** — маска луж (канал текстуры или цвет вершин) →
альбедо ×0,5–0,6, шероховатость → 0,05–0,1, нормаль сглажена, отражение — цвет неба/окружения по Френелю, рябь
от дождя — прокрутка маленькой карты нормалей; (2) **ветер** — смещение вершин травы и листвы по `TIME` и
высоте (UV.y или цвет вершины), одна синусоида + шум из маленькой текстуры; (3) **мох на шифере** — смесь
двух текстур по нормали «вверх» и маске.

## 7. Что лежит на GitHub (файлы доступны по raw.githubusercontent.com)

| Репозиторий | Что | Лицензия |
|---|---|---|
| [tilakpatell/tilakverse-assets](https://github.com/tilakpatell/tilakverse-assets) | паки Quaternius «как скачаны»: UAL1, UAL2 (полные, с .blend), Downtown City MegaKit, Street Pack, Furniture Pack, Stylized Nature Pack/MegaKit (+ проект Godot в релизе) | CC0 (Quaternius); в папке `sketchfab/` — CC BY/CC BY-NC-SA, **не брать** |
| [Fris0uman/cdda-soundpacks](https://github.com/Fris0uman/cdda-soundpacks) | набор CC-Sounds: окружение, погода, выстрелы, перезарядка, двери, удары, голоса монстров | у каждого файла своя (CC0 / CC BY), см. `credits.md` |
| [dgreenheck/ez-tree](https://github.com/dgreenheck/ez-tree) | генератор деревьев на three.js, выгрузка GLB с LOD | MIT |
| [agustindiazcano/zombie-horde-survivors](https://github.com/agustindiazcano/zombie-horde-survivors) | модели Quaternius (Soldier, Zombie и др.) в GLB, список в `assets.toml` | заявлено CC0 (проверить по оригиналам) |
| [Poly-Haven/Public-API](https://github.com/Poly-Haven/Public-API) | описание API Poly Haven | API бесплатный; при показе ассетов «вживую» из API просят подпись «Powered by Poly Haven» |

## 8. Что сделать вручную (пользователь)

1. **Mixamo** (по желанию, для автомата и топора сверху): войти в Adobe, скачать клипы (список в разделе 3),
   FBX Binary, 30 к/с, «Without Skin»; хранить не в открытом репозитории.
2. **Sketchfab CC BY** (по желанию): Lada-2107 low-poly, Zhiguli Soviet Cars, берёза OmegaModels — скачать
   после входа, автора — в `LICENSES.md`.
3. **Quaternius** с сайта или itch.io (по желанию): Zombie Apocalypse Kit, Universal Base Characters.
4. Разрешить домены в сетевых настройках облачной среды (если нужно скачивать и смотреть ассеты прямо здесь),
   см. раздел 10.

## 9. Подключение в CI

Скрипт рассчитан на GitHub Actions (там интернет открыт). Шаг перед «Импорт ресурсов» в
`.github/workflows/godot-release.yml` (и `scripts/fetch-assets.mjs` в `paths`):

```yaml
      - uses: actions/cache@v4
        with:
          path: godot/assets/external
          key: ext-assets-${{ hashFiles('scripts/fetch-assets.mjs') }}
      - name: Бесплатные ассеты (первый набор)
        run: node scripts/fetch-assets.mjs
```

Скрипт не падает, если источник недоступен (предупреждение и строка в разделе «Не скачано» в `LICENSES.md`);
`--strict` — для ручной проверки. Проверяет размер (предел на ассет и общий бюджет), md5 у Poly Haven, что вместо
файла не пришла HTML-страница, что glTF — это JSON. Уже скачанное не качает повторно (`--force` — заново).

## 10. Домены для сетевых настроек облачной среды

Сейчас из среды закрыты все сайты ассетов (polyhaven.com, ambientcg.com, kenney.nl, quaternius.com,
opengameart.org, freesound.org, sketchfab.com, itch.io, mixamo.com, godotshaders.com); открыт
raw.githubusercontent.com (и страницы github.com для чтения).

Нужны, чтобы скачивать первый набор и смотреть страницы прямо здесь:

- `polyhaven.com`, `api.polyhaven.com`, `dl.polyhaven.org`, `cdn.polyhaven.com` (превью)
- `ambientcg.com`, `docs.ambientcg.com` и CDN ambientCG, на который перенаправляет `get?file=` —
  `*.struffelproductions.com` (имя CDN по памяти; точное — в ошибке прокси при первой попытке)
- `kenney.nl`
- `opengameart.org`
- `godotshaders.com`
- `github.com`, `raw.githubusercontent.com`, `objects.githubusercontent.com`, `codeload.github.com`,
  `media.githubusercontent.com` (файлы Git LFS)

По желанию (второй набор и ручные ассеты):

- `quaternius.com`, `quaternius.itch.io`, `itch.io`, `*.itch.zone` (файлы itch.io), `drive.google.com`,
  `drive.usercontent.google.com` (если ссылки Quaternius ведут на Google Drive)
- `poly.pizza`, `static.poly.pizza`
- `freesound.org`, `cdn.freesound.org`
- `sketchfab.com`, `media.sketchfab.com` (скачивание всё равно требует входа)
- `store.godotengine.org`, `godotengine.org` (каталог ассетов Godot)
