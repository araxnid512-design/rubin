# План Tripo: окружение для наших локаций (1000 кредитов)

Статус: **выполнен** — 37 моделей (925 кредитов), запас 75 не тратился. В игре: `godot/assets/tripo/e_*.glb`, `EnvProps` (godot/scripts/env_props.gd), метки — `game/geom.js` beginProp/endProp. Цена — 25 кредитов за модель (по тексту, без скелета).
Потрачено до плана: 1140. План: 37 моделей × 25 = 925 + запас 75 на переделку неудачных (только после «ок» на
каждую переделку). Лимит этапа: 1140 + 1000 = **2140**.

По правилам (TRIPO_RULES, п. 6): **целые дома в Tripo не генерируются** — стены, полы, крыши, окна делаются в
Godot кодом (модульный набор по сетке 2 × 3 м), здесь только мебель, машины и предметы улиц.
Порядок: сначала 1 тестовая модель (ВАЗ-2107) → одобрение стиля → остальные группами, после каждой группы —
снимки в игре, треугольники, вес, FPS (фотосъёмка CI), коммит.

Ко всем промптам добавляется STYLE из `PROMPT_TEMPLATES.md`:
`realistic post-apocalyptic style, worn, dirty, muted colors, game asset, low poly optimized, clean topology, single object, centered, full object visible, neutral background`

## Как встанут в игру
- Модели заменяют процедурные предметы браузерной игры **только в выгрузке для Godot** (как уже сделано с
  фонарями и деревьями — `OPTIONS` в `game/props.js`): флаг выгрузки — предмет не идёт в общую пачку, а пишется
  меткой {вид, место, поворот} в meta; коллизии и порядок случайных чисел — прежние (иначе сдвинутся лут и
  бочки). Godot ставит модель Tripo в габарит старого предмета (как оружие — `Gear._fit`) и не сливает её
  со статикой. Тайники — те же записи (порядок, имена, места), меняется только вид мебели.
- Цвет машин — оттенок материала в Godot (одна модель → разные цвета), сгоревшая — отдельная модель.
- Повторяющиеся предметы — MultiMesh / общий материал (одна текстура на модель) — вызовов отрисовки не больше,
  чем сейчас; дальние — отсечение по участкам и `visibility_range`.
- Коллизии — простые коробки (как сейчас), не по сетке модели. Тайники (шкафы, холодильники) и бочки
  сохраняют поведение.

## 1. Машины (9) — до 3000 треуг. (автобус, БТР, «Урал» — до 4000), текстура 1024
Седанов на локациях 18 (Заречный 10, Дачи 3, Химмаш 4, стаб 1): обычные — по очереди ВАЗ-2107, «Нива», «Волга»,
УАЗ; разбитые и сгоревшие — свои модели. Цвет — оттенок материала в Godot.
| # | Модель | Промпт (+ STYLE) | Сколько в игре |
|---|---|---|---|
| 1 | **ВАЗ-2107 (тест)** | `Soviet VAZ-2107 Lada sedan car, rusty faded paint, flat tires, dirty windows, boxy 1980s shape, 3/4 front view, real-world proportions` | из 10 обычных |
| 2 | ВАЗ-2107 разбитый | `crashed Soviet Lada sedan car, crumpled front hood, broken windshield, rusty, flat tires, 3/4 front view, real-world proportions` | 3 |
| 3 | ВАЗ-2107 сгоревший | `burned-out Soviet Lada sedan car wreck, charred black and rust, no glass, no tires, sitting on rims, 3/4 front view, real-world proportions` | 5 |
| 4 | «Нива» | `Soviet Lada Niva small 4x4 SUV, rusty, mud-covered, 3/4 front view, real-world proportions` | из 10 обычных |
| 5 | «Волга» ГАЗ-24 | `Soviet GAZ-24 Volga sedan, faded paint, rusty chrome, flat tires, 3/4 front view, real-world proportions` | из 10 обычных |
| 6 | УАЗ-469 | `Soviet UAZ-469 military jeep, olive green, canvas roof, rusty, 3/4 front view, real-world proportions` | из 10 обычных |
| 7 | Автобус ПАЗ | `Soviet PAZ-672 small city bus, faded yellow paint, rusty, broken windows, flat tires, 3/4 front view, real-world proportions` | 3 |
| 8 | БТР-80 | `Soviet BTR-80 eight-wheeled armored personnel carrier, abandoned, rusty olive green, 3/4 front view, real-world proportions` | 4 |
| 9 | «Урал» | `Soviet Ural-375 military truck with canvas covered cargo bed, olive green, rusty, 3/4 front view, real-world proportions` | 8 |

## 2. Мебель в домах (15) — до 2000 треуг., текстура 512–1024
| # | Модель | Промпт (+ STYLE) | Сколько |
|---|---|---|---|
| 10 | Холодильник (тайник) | `old Soviet refrigerator ZIL, rounded corners, yellowed white enamel, rust stains, 3/4 front view, standing on the floor, real-world proportions` | 5 |
| 11 | Русская печь | `old whitewashed Russian brick stove with cast iron oven doors and a small stove top, soot stains, 3/4 front view, standing on the floor, real-world proportions` | 6 |
| 12 | Буржуйка | `small rusty cast iron wood-burning stove with a metal chimney pipe going up, 3/4 front view, standing on the floor, real-world proportions` | 15 |
| 13 | Диван | `old worn Soviet sofa, faded brown fabric, torn cushions, wooden legs, 3/4 front view, standing on the floor, real-world proportions` | 5 |
| 14 | Кровать | `old single bed with metal frame and dirty striped mattress, 3/4 front view, standing on the floor, real-world proportions` | 20 |
| 15 | Платяной шкаф (тайник) | `old Soviet wooden wardrobe with two doors, polished veneer worn and scratched, 3/4 front view, standing on the floor, real-world proportions` | 20 |
| 16 | Буфет (тайник) | `old Soviet wooden kitchen sideboard cabinet with glass doors on top and drawers below, dusty, 3/4 front view, standing on the floor, real-world proportions` | 20 |
| 17 | Комод (тайник) | `old wooden chest of drawers, one drawer half open, worn, 3/4 front view, standing on the floor, real-world proportions` | 5 |
| 18 | Тумбочка (тайник) | `old wooden bedside nightstand with one drawer and a small door, worn, 3/4 front view, standing on the floor, real-world proportions` | 13 |
| 19 | Сундук (тайник) | `old wooden trunk chest with metal bands and a latch, worn, 3/4 front view, standing on the floor, real-world proportions` | 20 |
| 20 | Кухонный стол | `old wooden kitchen table with worn oilcloth top, 3/4 front view, standing on the floor, real-world proportions` | ~35 |
| 21 | Стул | `old wooden Soviet chair, scratched paint, 3/4 front view, standing on the floor, real-world proportions` | ~40 |
| 22 | Телевизор | `old Soviet CRT television on short legs, wooden case, cracked screen, 3/4 front view, standing on the floor, real-world proportions` | 5 |
| 23 | Двухъярусная койка | `military metal bunk bed with thin dirty mattresses and grey blankets, 3/4 front view, standing on the floor, real-world proportions` | 24 |
| 24 | Токарный станок | `old Soviet industrial metal lathe machine, green paint chipped, oily, 3/4 front view, standing on the floor, real-world proportions` | 12 |

## 3. Улица и дворы (10) — до 1500 треуг. (мелочь — до 500), текстура 512
| # | Модель | Промпт (+ STYLE) | Сколько |
|---|---|---|---|
| 25 | Ржавая бочка | `old rusty 200 liter steel drum barrel, dented, faded paint, 3/4 front view, real-world proportions` | ~50 |
| 26 | Лежащая покрышка | `single old worn car tire lying flat on the ground, dirty, 3/4 top view, real-world proportions` | ~50 |
| 27 | Мешки с мусором | `small pile of black plastic garbage bags, torn, dirty, 3/4 front view, real-world proportions` | ~45 |
| 28 | Деревянный ящик | `old wooden supply crate, weathered planks, 3/4 front view, real-world proportions` | ~40 (штабели) |
| 29 | Скамейка | `old Soviet park bench, wooden slats on concrete legs, peeling paint, 3/4 front view, real-world proportions` | 12 |
| 30 | Мусорный контейнер | `rusty green metal garbage container dumpster, dented, overflowing with trash bags, 3/4 front view, real-world proportions` | 3 |
| 31 | Бетонный блок | `cracked concrete road barrier block, stained, 3/4 front view, real-world proportions` | 14 |
| 32 | Мешки с песком | `low wall of stacked military sandbags, dirty burlap, 3/4 front view, real-world proportions` | 12 |
| 33 | Поленница | `stack of chopped firewood logs under a small slanted plank roof, 3/4 front view, real-world proportions` | 13 |
| 34 | Колодец | `old village well with wooden roof and bucket on a chain, weathered, 3/4 front view, real-world proportions` | 4 |

## 4. Промзона и военная часть (3) — до 2000 треуг., текстура 512–1024
| # | Модель | Промпт (+ STYLE) | Сколько |
|---|---|---|---|
| 35 | Штабель труб | `pile of large rusty steel pipes stacked on wooden beams, 3/4 front view, real-world proportions` | 4 |
| 36 | Химическая бочка | `single dented yellow chemical drum barrel with faded hazard stripes, rusty, 3/4 front view, real-world proportions` | 39 |
| 37 | Ящики со снарядами | `stack of olive green military ammunition crates, worn stencils without text, 3/4 front view, real-world proportions` | 8 |

## Запас — 75 кредитов (3 переделки)
Только для неудачных моделей и только после «ок» на исправленный промпт.

## Что делается кодом, без кредитов
Стены, полы, окна, двери, крыши, заборы, бетонные ограждения, рельсы, вагоны, вышки, водонапорные башни,
резервуары, теплицы, сараи, туалеты, качели и горки, рекламные щиты, костры, бочки-взрывалки «ОГНЕОПАСНО»
(поведение — `features/barrels.gd`).
