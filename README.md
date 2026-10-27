# 🧟 Zombie — low-poly модель зомби с 5 анимациями

Процедурная low-poly модель зомби на [three.js](https://threejs.org): один `SkinnedMesh`, скелет из 19 костей
и 5 анимаций. Модель экспортируется в стандартный **`models/zombie.glb`** (glTF 2.0), который открывается в
Blender, Unity, Unreal, Godot, three.js, Babylon.js и т.д.

| # | Анимация | Длительность | Повтор | Описание |
|---|----------|--------------|--------|----------|
| 1 | `Idle`   | 3.2 с | цикл   | покачивается, голова болтается, челюсть шевелится |
| 2 | `Walk`   | 1.8 с | цикл   | шаркающая походка, руки вытянуты вперёд, правая нога волочится |
| 3 | `Run`    | 0.8 с | цикл   | быстрый бег с сильным наклоном, руки тянутся к жертве |
| 4 | `Attack` | 1.4 с | один раз | замах обеими руками, выпад и укус |
| 5 | `Death`  | 2.0 с | один раз | отдача от удара, колени подкашиваются, падает на спину |

## Как протестировать

```bash
npm install
npm start            # открыть http://localhost:8080
```

В просмотрщике:
- кнопки или клавиши **1–5** — переключение анимаций (с плавным переходом);
- кнопка ⏸ (или **пробел**) — пауза, ползунки скорости и длительности перехода;
- показ скелета, каркаса, автоповорот камеры (мышь — вращение/зум);
- «Источник модели» — проверить как процедурную модель, так и готовый файл `models/zombie.glb`;
- «Скачать zombie.glb» — сохранить модель; любой `.glb/.gltf` можно перетащить в окно и проверить его анимации.
- на телефоне панель уезжает вниз (в горизонтальной ориентации — вправо), кнопки анимаций крупные,
  настройки свёрнуты под «⚙ Настройки», камера сама подстраивается под экран; вращение — одним пальцем, зум — двумя.

### Автотесты

```bash
npm test             # юнит-тесты: скелет, 5 анимаций, экспорт и обратная загрузка GLB
npm run test:e2e     # браузерный тест (Playwright): проигрывает все анимации, проверяет вид на телефоне, скриншоты в test-output/
```

### Пересобрать GLB

```bash
npm run build        # src/zombie.js → models/zombie.glb
```

## Использование в своём проекте (three.js)

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltf = await new GLTFLoader().loadAsync('models/zombie.glb');
scene.add(gltf.scene);
const mixer = new THREE.AnimationMixer(gltf.scene);
mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'Walk')).play();
// в цикле рендера: mixer.update(delta);
```

Или без файла — напрямую из кода: `import { createZombie } from './src/zombie.js'`.

## Структура

```
src/zombie.js            модель: геометрия, скелет, анимации
models/zombie.glb        готовая модель (glTF binary)
index.html               просмотрщик для тестирования
server.mjs               мини-сервер для просмотрщика
scripts/export-glb.mjs   экспорт в GLB
tests/                   юнит- и e2e-тесты
```

Кости: `Root → Hips → Spine → Chest → Neck → Head → Jaw`, руки `UpperArm/Forearm/Hand.L|R`,
ноги `UpperLeg/LowerLeg/Foot.L|R`. Персонаж смотрит в +Z, ступни стоят на Y = 0, рост ≈ 2 м.
