// Проверка локации (game/locations/<id>.js) без игры: собирает её в tools/level.html, считает время сборки,
// коллайдеры, здания, тайники, группы заражённых; поиском по сетке навигации от точки старта проверяет, что все
// тайники (точка обыска в 1,2 м от проходимой клетки) и все выходы достижимы; снимок сверху — в <out>.jpg.
// Запуск: node scripts/check-location.mjs <id> [out.jpg] [--game x z] (--game — снимок игровой камерой в точке x,z)

import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const id = args[0];
if (!id) { console.log('node scripts/check-location.mjs <id> [out.jpg] [--game x z]'); process.exit(1); }
const out = args[1] && !args[1].startsWith('--') ? args[1] : null;
const gi = args.indexOf('--game');
const game = gi >= 0 ? [+args[gi + 1], +args[gi + 2]] : null;

const server = await startServer(0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = false;
try {
	const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
	const errors = [];
	page.on('pageerror', (e) => errors.push(`${e.message} ${e.stack?.split('\n')[1]?.trim() ?? ''}`));
	await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => {
		const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
		route.fulfill({ path: join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript' });
	});
	const q = game ? `view=game&x=${game[0]}&z=${game[1]}` : 'view=top&s=95&nav=1';
	await page.goto(`http://localhost:${server.address().port}/tools/level.html?id=${id}&${q}`);
	await page.waitForFunction(() => window.ready || window.failed, null, { timeout: 600000 }).catch(() => {});
	if (errors.length) { console.log('ОШИБКИ:\n' + errors.join('\n')); process.exitCode = 1; }
	const r = await page.evaluate(() => {
		const L = window.level;
		if (!L) return null;
		const { N, blocked, cell, center } = L.nav;
		// поиск в ширину от старта по 8 соседям (как flowFrom в игре)
		const dist = new Int32Array(N * N).fill(-1);
		const [sx, sz] = cell(L.start.pos.x, L.start.pos.z);
		const q = [sz * N + sx];
		dist[q[0]] = 0;
		const startBlocked = !!blocked[q[0]];
		for (let h = 0; h < q.length; h++) {
			const i = q[h], x = i % N, z = (i / N) | 0;
			for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
				const nx = x + dx, nz = z + dz;
				if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
				const j = nz * N + nx;
				if (blocked[j] || dist[j] >= 0) continue;
				if (dx && dz && (blocked[z * N + nx] || blocked[nz * N + x])) continue; // не срезаем угол
				dist[j] = dist[i] + 1;
				q.push(j);
			}
		}
		const near = (x0, z0, rad) => {
			const [cx, cz] = cell(x0, z0), k = Math.ceil(rad / L.nav.CELL);
			for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) {
				const x = cx + dx, z = cz + dz;
				if (x < 0 || z < 0 || x >= N || z >= N) continue;
				if (Math.hypot(center(x) - x0, center(z) - z0) <= rad && dist[z * N + x] >= 0) return true;
			}
			return false;
		};
		const badBoxes = L.containers.filter((c) => !near(c.ax, c.az, 1.2)).map((c) => `${c.building}/${c.name} (${c.ax.toFixed(1)}, ${c.az.toFixed(1)})`);
		const badExits = L.exits.filter((e) => !near(e.spawn.x, e.spawn.z, 0.8)).map((e) => `${e.to ?? 'карта'} (${e.spawn.x}, ${e.spawn.z})`);
		const zombies = (L.groups ?? []).reduce((s, g) => s + (g.count ?? g.n ?? (g.types?.length ?? 0)), 0);
		const reach = q.length, free = blocked.reduce((s, b) => s + (b ? 0 : 1), 0);
		return {
			info: document.getElementById('info').textContent, half: L.half, start: [L.start.pos.x, L.start.pos.z], startBlocked,
			containers: L.containers.length, buildings: L.buildings.length, colliders: L.colliders.length, exits: L.exits.map((e) => e.to ?? 'карта'),
			groups: (L.groups ?? []).length, zombies, stations: (L.stations ?? []).length, badBoxes, badExits,
			reachShare: +(reach / free).toFixed(2),
		};
	});
	if (!r) { console.log('уровень не собран'); process.exitCode = 1; } else {
		console.log(r.info);
		console.log(`размер ${r.half * 2}×${r.half * 2} м, старт (${r.start.join(', ')})${r.startBlocked ? ' — СТАРТ В ПРЕПЯТСТВИИ!' : ''}`);
		console.log(`зданий ${r.buildings}, тайников ${r.containers}, коллайдеров ${r.colliders}, групп заражённых ${r.groups}, выходы: ${r.exits.join(', ')}`);
		console.log(`достижимо ${Math.round(r.reachShare * 100)} % свободных клеток`);
		console.log(r.badBoxes.length ? `НЕДОСТИЖИМЫ ТАЙНИКИ (${r.badBoxes.length}): ${r.badBoxes.join('; ')}` : 'все тайники достижимы');
		console.log(r.badExits.length ? `НЕДОСТИЖИМЫ ВЫХОДЫ: ${r.badExits.join('; ')}` : 'все выходы достижимы');
		ok = !r.startBlocked && !r.badBoxes.length && !r.badExits.length && !errors.length;
		if (out) { await page.screenshot({ path: out, type: 'jpeg', quality: 80 }); console.log(`снимок: ${out}`); }
	}
} finally {
	await browser.close();
	server.close();
}
console.log(ok ? 'ПРОВЕРКА: OK' : 'ПРОВЕРКА: ЕСТЬ ОШИБКИ');
if (!ok) process.exitCode = 1;
