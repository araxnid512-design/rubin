// Собирает реалистичного зомби из ассетов MakeHuman и экспортирует в models/zombie.glb (с 5 анимациями).
// Запуск: npm run build

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildZombie } from './makehuman/build-zombie.mjs';
import { installNodeShims } from './node-shims.mjs';

installNodeShims();

export async function exportZombieGLB(options) {
	const { model, animations } = buildZombie(options);
	const exporter = new GLTFExporter();
	return exporter.parseAsync(model, { binary: true, animations });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const out = resolve(dirname(fileURLToPath(import.meta.url)), '../models/zombie.glb');
	const glb = await exportZombieGLB();
	await mkdir(dirname(out), { recursive: true });
	await writeFile(out, Buffer.from(glb));
	console.log(`Готово: ${out} (${(glb.byteLength / 1024).toFixed(1)} КБ)`);
}
