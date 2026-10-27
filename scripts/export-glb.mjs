// Экспортирует процедурную модель зомби в models/zombie.glb (вместе с 5 анимациями).
// Запуск: npm run build

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createZombie } from '../src/zombie.js';

// GLTFExporter в бинарном режиме использует FileReader, которого нет в Node.
if (typeof globalThis.FileReader === 'undefined') {
	globalThis.FileReader = class {
		readAsArrayBuffer(blob) {
			blob.arrayBuffer().then((buffer) => {
				this.result = buffer;
				this.onloadend?.();
			});
		}
	};
}

export async function exportZombieGLB() {
	const { model, animations } = createZombie();
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
