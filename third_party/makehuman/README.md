# MakeHuman assets (CC0 1.0)

Базовая модель человека, морфы (targets), скелет с весами и меш глаз взяты из
репозитория MakeHuman: https://github.com/makehumancommunity/makehuman (`makehuman/data/`).

По лицензии проекта (раздел «C. The license for the bundled assets» в его LICENSE.md)
все ассеты MakeHuman — базовая модель, морфы, текстуры, прокси — выпущены под
**CC0 1.0 Universal**: их можно свободно использовать, менять и распространять.

Файлы скопированы без изменений:

- `base.obj` — базовая модель hm08 (единицы — дециметры)
- `rigs/default.mhskel`, `rigs/default_weights.mhw` — стандартный скелет (163 кости) и веса
- `eyes/high-poly.obj`, `eyes/high-poly.mhclo` — меш глаз и его привязка к базовой модели
- `targets/**.target` — морфы, из которых собирается тело зомби, топтуна и рубера

`assets/zombie_eye.png` сделан из `eyes/materials/brown_eye.png` скриптом `scripts/make-eye-texture.py`.
