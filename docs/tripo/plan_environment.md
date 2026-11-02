# План Tripo: окружение для наших локаций (1000 кредитов)

Статус: **ждёт «ок» пользователя**. Цена — 25 кредитов за модель (по тексту, без скелета).
Потрачено до плана: 1140. План: 36 моделей × 25 = 900 + запас 100 на переделку неудачных (только после «ок» на
каждую переделку). Лимит этапа: 1140 + 1000 = **2140**.

По правилам (TRIPO_RULES, п. 6): **целые дома в Tripo не генерируются** — стены, полы, крыши, окна делаются в
Godot кодом (модульный набор по сетке 2 × 3 м), здесь только мебель, машины и предметы улиц.
Порядок: сначала 1 тестовая модель (ВАЗ-2107) → одобрение стиля → остальные группами, после каждой группы —
снимки в игре, треугольники, вес, FPS (фотосъёмка CI), коммит.

Ко всем промптам добавляется STYLE из `PROMPT_TEMPLATES.md`:
`realistic post-apocalyptic style, worn, dirty, muted colors, game asset, low poly optimized, clean topology, single object, centered, full object visible, neutral background`

## Как встанут в игру
- Модели заменяют процедурные предметы браузерной игры **только в выгрузке для Godot** (как уже сделано с
  фонарями и деревьями — `OPTIONS` в `game/props.js`): место и поворот — прежние, модель вписывается в габарит
  старого предмета (как оружие — `Gear._fit`).
- Цвет машин — оттенок материала в Godot (одна модель → разные цвета), сгоревшая — отдельная модель.
- Повторяющиеся предметы — MultiMesh / общий материал (одна текстура на модель) — вызовов отрисовки не больше,
  чем сейчас; дальние — отсечение по участкам и `visibility_range`.
- Коллизии — простые коробки (как сейчас), не по сетке модели. Тайники (шкафы, холодильники) и бочки
  сохраняют поведение.

## 1. Машины (9) — до 3000 треуг. (автобус, БТР, грузовик — до 4000), текстура 1024
| # | Модель | Промпт (+ STYLE) | Где |
|---|---|---|---|
| 1 | **ВАЗ-2107 (тест)** | `Soviet VAZ-2107 Lada sedan car, rusty faded paint, flat tires, dirty windows, boxy 1980s shape, 3/4 front view, real-world proportions` | все кластеры |
| 2 | ВАЗ-2107 сгоревший | `burned-out Soviet Lada sedan car wreck, charred black and rust, no glass, no tires, sitting on rims, 3/4 front view, real-world proportions` | все |
| 3 | «Нива» | `Soviet Lada Niva small 4x4 SUV, rusty, mud-covered, 3/4 front view, real-world proportions` | Дачи |
| 4 | УАЗ-469 | `Soviet UAZ-469 military jeep, olive green, canvas roof, rusty, 3/4 front view, real-world proportions` | В/ч, стаб |
| 5 | «Волга» ГАЗ-24 | `Soviet GAZ-24 Volga sedan, faded paint, rusty chrome, flat tires, 3/4 front view, real-world proportions` | Заречный |
| 6 | «Газель» | `Russian GAZelle light commercial van, dirty white, rusty, broken windows, 3/4 front view, real-world proportions` | Заречный, Химмаш |
| 7 | Автобус ПАЗ | `Soviet PAZ-672 small city bus, faded yellow paint, rusty, broken windows, flat tires, 3/4 front view, real-world proportions` | Заречный |
| 8 | БТР-80 | `Soviet BTR-80 eight-wheeled armored personnel carrier, abandoned, rusty olive green, 3/4 front view, real-world proportions` | В/ч |
| 9 | Армейский грузовик | `Soviet Ural-375 military truck with canvas covered cargo bed, olive green, rusty, 3/4 front view, real-world proportions` | В/ч, «Карьер» |

## 2. Мебель в домах (12) — до 2000 треуг., текстура 512–1024
| # | Модель | Промпт (+ STYLE) |
|---|---|---|
| 10 | Холодильник | `old Soviet refrigerator ZIL, rounded corners, yellowed white enamel, rust stains, 3/4 front view, standing on the floor, real-world proportions` |
| 11 | Газовая плита | `old Soviet four-burner gas stove with oven, white enamel chipped, greasy, 3/4 front view, standing on the floor, real-world proportions` |
| 12 | Диван | `old worn Soviet sofa, faded brown fabric, torn cushions, wooden legs, 3/4 front view, standing on the floor, real-world proportions` |
| 13 | Кровать | `old single bed with metal frame and dirty striped mattress, 3/4 front view, standing on the floor, real-world proportions` |
| 14 | Платяной шкаф | `old Soviet wooden wardrobe with two doors, polished veneer worn and scratched, 3/4 front view, standing on the floor, real-world proportions` |
| 15 | Кухонный стол | `old wooden kitchen table with worn oilcloth top, 3/4 front view, standing on the floor, real-world proportions` |
| 16 | Стул | `old wooden Soviet chair, scratched paint, 3/4 front view, standing on the floor, real-world proportions` |
| 17 | Телевизор | `old Soviet CRT television on short legs, wooden case, cracked screen, 3/4 front view, standing on the floor, real-world proportions` |
| 18 | Комод | `old wooden chest of drawers, one drawer half open, worn, 3/4 front view, standing on the floor, real-world proportions` |
| 19 | Книжный шкаф | `old wooden bookshelf with a few dusty books and clutter, 3/4 front view, standing on the floor, real-world proportions` |
| 20 | Двухъярусная койка | `military metal bunk bed with thin dirty mattresses and grey blankets, 3/4 front view, standing on the floor, real-world proportions` |
| 21 | Токарный станок | `old Soviet industrial metal lathe machine, green paint chipped, oily, 3/4 front view, standing on the floor, real-world proportions` |

## 3. Улица и дворы (9) — до 1500 треуг. (мелочь — до 500), текстура 512
| # | Модель | Промпт (+ STYLE) |
|---|---|---|
| 22 | Скамейка | `old Soviet park bench, wooden slats on concrete legs, peeling paint, 3/4 front view, real-world proportions` |
| 23 | Мусорный контейнер | `rusty metal garbage container dumpster, dented, overflowing with trash bags, 3/4 front view, real-world proportions` |
| 24 | Деревянный ящик | `old wooden supply crate, weathered planks, 3/4 front view, real-world proportions` |
| 25 | Стопка покрышек | `stack of four old worn car tires, dirty, 3/4 front view, real-world proportions` |
| 26 | Бетонный блок | `cracked concrete road barrier block, stained, 3/4 front view, real-world proportions` |
| 27 | Мешки с песком | `low wall of stacked military sandbags, dirty burlap, 3/4 front view, real-world proportions` |
| 28 | Поленница | `stack of chopped firewood logs against a small wooden frame, 3/4 front view, real-world proportions` |
| 29 | Велосипед | `old rusty Soviet bicycle leaning on its stand, 3/4 front view, real-world proportions` |
| 30 | Колодец | `old village well with wooden roof and bucket on a chain, weathered, 3/4 front view, real-world proportions` |

## 4. Промзона и военная часть (6) — до 2000 треуг., текстура 512–1024
| # | Модель | Промпт (+ STYLE) |
|---|---|---|
| 31 | Трансформаторная будка | `small Soviet concrete electrical transformer box with metal doors, rusty, warning stains, 3/4 front view, real-world proportions` |
| 32 | Цистерна | `horizontal rusty metal fuel storage tank on concrete supports, 3/4 front view, real-world proportions` |
| 33 | Штабель труб | `pile of large rusty steel pipes stacked on wooden beams, 3/4 front view, real-world proportions` |
| 34 | Химические бочки | `group of three dented rusty chemical barrels with faded hazard paint, leaking, 3/4 front view, real-world proportions` |
| 35 | Противотанковый ёж | `Czech hedgehog anti-tank obstacle made of rusty steel beams, 3/4 front view, real-world proportions` |
| 36 | Ящики со снарядами | `stack of olive green military ammunition crates, worn stencils without text, 3/4 front view, real-world proportions` |

## Запас — 100 кредитов (4 переделки)
Только для неудачных моделей и только после «ок» на исправленный промпт.

## Что делается кодом, без кредитов
Стены, полы, окна, двери, крыши, заборы, ограждения, рельсы, вагоны, вышки, теплицы, сараи, качели и горки,
рекламные щиты, костры, бочки-взрывалки (поведение — `features/barrels.gd`).
