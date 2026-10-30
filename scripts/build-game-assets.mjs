// Модели для игры (текстуры 512, чтобы быстрее грузилось на телефоне):
// models/game/player.glb, runner.glb, stomper.glb, ruber.glb
// Запуск: npm run build:game

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { installNodeShims } from './node-shims.mjs';
import { buildCharacter } from './makehuman/build-zombie.mjs';
import { HERO_PROFILE, RUNNER_PROFILE, STOMPER_PROFILE, RUBER_PROFILE } from './makehuman/profiles.mjs';
import { simplifyCharacter } from './makehuman/lod.mjs';
import { jpegTextures } from './makehuman/jpeg-textures.mjs';

// доля треугольников по материалам: камера игры сверху — мелкие складки не видны, зато FPS
const ZOMBIE_LOD = { Skin: 0.38, Cloth: 0.5, Eye: 0.25, Teeth: 0.4 };
const HERO_LOD = { Skin: 0.6, Cloth: 0.45, Eye: 0.25, Teeth: 0.5 };

installNodeShims();
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../models/game');
await mkdir(OUT, { recursive: true });
const only = process.argv.slice(2);
for (const [file, profile, lod] of [['player', HERO_PROFILE, HERO_LOD], ['runner', RUNNER_PROFILE, ZOMBIE_LOD], ['stomper', STOMPER_PROFILE, ZOMBIE_LOD], ['ruber', RUBER_PROFILE, ZOMBIE_LOD]]) {
	if (only.length && !only.includes(file)) continue;
	const t0 = Date.now();
	const { model, animations } = buildCharacter(profile, { textureSize: 512 });
	console.log(`${file}: ${await simplifyCharacter(model, lod)}`);
	// текстуры кожи и одежды — в JPEG (впятеро легче PNG), прозрачные глаза — PNG
	const { glb } = jpegTextures(await new GLTFExporter().parseAsync(model, { binary: true, animations }));
	await writeFile(join(OUT, `${file}.glb`), glb);
	console.log(`${file}.glb: ${(glb.byteLength / 1024).toFixed(0)} КБ, ${((Date.now() - t0) / 1000).toFixed(1)} с`);
}
