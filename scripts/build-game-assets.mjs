// Модели для игры (текстуры 512, чтобы быстрее грузилось на телефоне):
// models/game/player.glb, runner.glb, stomper.glb
// Запуск: npm run build:game

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { installNodeShims } from './node-shims.mjs';
import { buildCharacter } from './makehuman/build-zombie.mjs';
import { PLAYER_PROFILE, RUNNER_PROFILE, STOMPER_PROFILE } from './makehuman/profiles.mjs';

installNodeShims();
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../models/game');
await mkdir(OUT, { recursive: true });
const only = process.argv.slice(2);
for (const [file, profile] of [['player', PLAYER_PROFILE], ['runner', RUNNER_PROFILE], ['stomper', STOMPER_PROFILE]]) {
	if (only.length && !only.includes(file)) continue;
	const t0 = Date.now();
	const { model, animations } = buildCharacter(profile, { textureSize: 512 });
	const glb = await new GLTFExporter().parseAsync(model, { binary: true, animations });
	await writeFile(join(OUT, `${file}.glb`), Buffer.from(glb));
	console.log(`${file}.glb: ${(glb.byteLength / 1024).toFixed(0)} КБ, ${((Date.now() - t0) / 1000).toFixed(1)} с`);
}
