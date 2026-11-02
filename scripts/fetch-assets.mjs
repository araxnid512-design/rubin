#!/usr/bin/env node
// Скачивание бесплатных ассетов для Godot-версии — ПЕРВЫЙ набор из docs/assets-catalog.md
// (текстуры 1K, лёгкие модели, анимации Quaternius, эффекты, звуки; только файлы данных).
//
// Запуск (CI, Node 22, без сторонних пакетов; zip распаковывает системный unzip):
//   node scripts/fetch-assets.mjs                 — весь первый набор
//   node scripts/fetch-assets.mjs --only=textures,road_damaged   — по категориям или id
//   node scripts/fetch-assets.mjs --list          — показать набор, ничего не качать
//   --force   — скачать заново, даже если файлы уже есть
//   --strict  — код выхода 1, если что-то не скачалось (по умолчанию — только предупреждение)
// Локально за прокси облачной среды: NODE_USE_ENV_PROXY=1 node scripts/fetch-assets.mjs (Node ≥ 22.21).
//
// Результат: godot/assets/external/<категория>/<ассет>/…, там же LICENSES.md (что, автор, лицензия, ссылка)
// и manifest.json. Папка в git не хранится (godot/.gitignore) — её собирает CI перед импортом в Godot.
// Недоступный ресурс не валит сборку: предупреждение и запись в раздел «Не скачано» в LICENSES.md.
// Проверки: размер (предел на ассет и на весь набор), md5 у Poly Haven, «не HTML вместо файла», JSON у glTF.

import { mkdir, rm, stat, readFile, writeFile, readdir, copyFile, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, basename, extname, relative, normalize, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'godot', 'assets', 'external');
const CACHE = join(OUT, '.cache'); // скачанные архивы; Godot сюда не смотрит (.gdignore)
const UA = 'ulei-cluster17-assets/1.0 (+https://github.com/araxnid512-design/rubin)';
const MB = 1024 * 1024;
const BUDGET_MB = 250; // предупреждение, если весь набор на диске больше
const TEXT_EXT = new Set(['.gltf', '.json', '.txt', '.md', '.html', '.htm', '.mtlx', '.usda']);

// ---------------------------------------------------------------- лицензии
const LIC = {
	cc0: { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
	by3: { name: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' },
	by4: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
};

// ---------------------------------------------------------------- первый набор
// type: polyhaven-tex | polyhaven-model | ambientcg | url | page; fallbacks — запасные источники.
const PH_TEX = (id) => ({ type: 'polyhaven-tex', id, res: '1k', maps: ['diff', 'nor_gl', 'arm'] });
const ACG = (id, keep = 'Color|NormalGL|Roughness|AmbientOcclusion|Metalness|Opacity') => ({
	type: 'ambientcg', id, res: '1K-JPG', keep: new RegExp(`_(${keep})\\.(jpg|png)$`, 'i'),
});
const CDDA = 'https://raw.githubusercontent.com/Fris0uman/cdda-soundpacks/master/sound/CC-Sounds';
const UAL_REPO = 'https://raw.githubusercontent.com/tilakpatell/tilakverse-assets';

const ASSETS = [
	// --- PBR-текстуры 1K (цвет + нормаль GL + ARM/шероховатость) ---
	{ id: 'road_damaged', cat: 'textures', what: 'асфальт улиц: трещины, выбоины, заплатки', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/road_damaged', src: PH_TEX('road_damaged'), maxMB: 12 },
	{ id: 'Asphalt024C', cat: 'textures', what: 'мокрый растрескавшийся асфальт — слой луж и сырости', author: 'ambientCG (Lennart Demes)', lic: 'cc0', page: 'https://ambientcg.com/view?id=Asphalt024C', src: ACG('Asphalt024C'), maxMB: 25 },
	{ id: 'brown_mud_leaves_01', cat: 'textures', what: 'обочина: грязь, трава, мох, листья', author: 'Rob Tuytel / Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/brown_mud_leaves_01', src: PH_TEX('brown_mud_leaves_01'), maxMB: 12 },
	{ id: 'leaves_forest_ground', cat: 'textures', what: 'осенняя листва и ветки под берёзами и в садах', author: 'Dimitrios Savva / Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/leaves_forest_ground', src: PH_TEX('leaves_forest_ground'), maxMB: 12 },
	{ id: 'Grass007', cat: 'textures', what: 'трава с сорняками — пустыри, бурьян у заборов', author: 'ambientCG (Lennart Demes)', lic: 'cc0', page: 'https://ambientcg.com/view?id=Grass007', src: ACG('Grass007'), maxMB: 25 },
	{ id: 'asbestos_sheet', cat: 'textures', what: 'шифер (волнистый асбестоцемент) — крыши домов и сараев', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/asbestos_sheet', src: PH_TEX('asbestos_sheet'), maxMB: 12 },
	{ id: 'Moss001', cat: 'textures', what: 'мох — второй слой на шифер, бетон, землю у стен', author: 'ambientCG (Lennart Demes)', lic: 'cc0', page: 'https://ambientcg.com/view?id=Moss001', src: ACG('Moss001'), maxMB: 25 },
	{ id: 'rusty_corrugated_iron', cat: 'textures', what: 'ржавый профнастил — гаражи, сараи, заборы', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/rusty_corrugated_iron', src: PH_TEX('rusty_corrugated_iron'), maxMB: 12 },
	{ id: 'raw_plank_wall', cat: 'textures', what: 'серые старые доски — штакетник, сараи, ящики', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/raw_plank_wall', src: PH_TEX('raw_plank_wall'), maxMB: 12 },
	{ id: 'wood_peeling_paint_weathered', cat: 'textures', what: 'крашеные доски с облезлой краской — дома, ставни, наличники', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/wood_peeling_paint_weathered', src: PH_TEX('wood_peeling_paint_weathered'), maxMB: 12 },
	{ id: 'concrete_wall_001', cat: 'textures', what: 'белёная штукатурка со сколами — стены домов', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/concrete_wall_001', src: PH_TEX('concrete_wall_001'), maxMB: 12 },
	{ id: 'concrete_wall_008', cat: 'textures', what: 'старый бетон с подтёками — плиты, столбы, фундаменты', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/concrete_wall_008', src: PH_TEX('concrete_wall_008'), maxMB: 12 },
	{ id: 'mixed_brick_wall', cat: 'textures', what: 'старый кирпич — трубы, руины, стаб', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/mixed_brick_wall', src: PH_TEX('mixed_brick_wall'), maxMB: 12 },
	{ id: 'PaintedMetal007', cat: 'textures', what: 'синяя крашеная жесть с ржавчиной — кузова старых машин', author: 'ambientCG (Lennart Demes)', lic: 'cc0', page: 'https://ambientcg.com/view?id=PaintedMetal007', src: ACG('PaintedMetal007'), maxMB: 25 },
	{ id: 'pine_bark', cat: 'textures', what: 'сосновая кора — стволы сосен', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/pine_bark', src: PH_TEX('pine_bark'), maxMB: 12 },
	{ id: 'Fence006', cat: 'textures', what: 'проволочная сетка с прозрачностью — рабица (проверить вид; запасной Fence001)', author: 'ambientCG (Lennart Demes)', lic: 'cc0', page: 'https://ambientcg.com/view?id=Fence006', src: ACG('Fence006'), maxMB: 25 },
	{ id: 'LeafSet026', cat: 'textures', what: 'атлас травинок с прозрачностью — трава-карточки (MultiMesh)', author: 'ambientCG (Lennart Demes)', lic: 'cc0', page: 'https://ambientcg.com/view?id=LeafSet026', src: ACG('LeafSet026'), maxMB: 25 },
	{ id: 'ScatteredLeaves001', cat: 'textures', what: 'опавшие листья — наклейки на асфальт и крыльца', author: 'ambientCG (Lennart Demes)', lic: 'cc0', page: 'https://ambientcg.com/view?id=ScatteredLeaves001', src: ACG('ScatteredLeaves001'), maxMB: 25 },

	// --- модели (лёгкие, glTF 1K) ---
	{ id: 'Barrel_01', cat: 'models', what: 'ржавая бочка (~3K треугольников)', author: 'Jorge Camacho / Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/Barrel_01', src: { type: 'polyhaven-model', id: 'Barrel_01', res: '1k' }, maxMB: 15 },
	{ id: 'old_tyre', cat: 'models', what: 'старая покрышка (~3K треугольников)', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/old_tyre', src: { type: 'polyhaven-model', id: 'old_tyre', res: '1k' }, maxMB: 15 },
	{ id: 'covered_car', cat: 'models', what: 'машина под пыльным тентом (~13K треугольников, 1–2 на локацию)', author: 'Poly Haven', lic: 'cc0', page: 'https://polyhaven.com/a/covered_car', src: { type: 'polyhaven-model', id: 'covered_car', res: '1k' }, maxMB: 20 },

	// --- анимации: Quaternius Universal Animation Library 1 и 2 (полные, CC0), копия на GitHub закреплена коммитом ---
	{
		id: 'ual1', cat: 'animations', what: 'Universal Animation Library: 120+ клипов (ходьба, бег, присед, пистолет, удары, рубка, смерти, зомби)',
		author: 'Quaternius', lic: 'cc0', page: 'https://quaternius.com/packs/universalanimationlibrary.html', maxMB: 35,
		src: { type: 'url', files: [
			`${UAL_REPO}/3fc5b474cacffc5b3958aca4f8a652d3d9f75524/quaternius/universal-animation-library/Unreal-Godot/UAL1.glb`,
			`${UAL_REPO}/3fc5b474cacffc5b3958aca4f8a652d3d9f75524/quaternius/universal-animation-library/License.txt`,
		] },
		fallbacks: [{ type: 'page', page: 'https://opengameart.org/content/universal-animation-library', match: /\.zip$/i, select: /\.(glb|txt)$/i }],
	},
	{
		id: 'ual2', cat: 'animations', what: 'Universal Animation Library 2: 130+ клипов (комбо ближнего боя, оружие, паркур, переноска, походка зомби)',
		author: 'Quaternius', lic: 'cc0', page: 'https://quaternius.com/packs/universalanimationlibrary2.html', maxMB: 35,
		src: { type: 'url', files: [
			`${UAL_REPO}/b88b0c642f0f04c031f20b4304ff95878f79528e/quaternius/universal-animation-library-2/Unreal-Godot/UAL2.glb`,
			`${UAL_REPO}/b88b0c642f0f04c031f20b4304ff95878f79528e/quaternius/universal-animation-library-2/License.txt`,
		] },
		fallbacks: [{ type: 'page', page: 'https://opengameart.org/content/universal-animation-library-2', match: /\.zip$/i, select: /\.(glb|txt)$/i }],
	},

	// --- эффекты (спрайты частиц) ---
	{
		id: 'kenney_particle_pack', cat: 'fx', what: 'дульные вспышки, дым, огонь, искры, пыль, гарь, трассеры (PNG 512×512 с прозрачностью)',
		author: 'Kenney (www.kenney.nl)', lic: 'cc0', page: 'https://kenney.nl/assets/particle-pack', maxMB: 40,
		src: { type: 'page', page: 'https://kenney.nl/assets/particle-pack', match: /\.zip$/i, select: /(muzzle|smoke|fire|flame|spark|dirt|scorch|trace|light|circle)_\d+\.png$/i, prefer: /transparent/i },
		fallbacks: [{ type: 'page', page: 'https://opengameart.org/content/particle-pack-80-sprites', match: /\.zip$/i, select: /(muzzle|smoke|fire|flame|spark|dirt|scorch|trace|light|circle)_\d+\.png$/i, prefer: /transparent/i }],
	},
	{
		id: 'kenney_smoke_particles', cat: 'fx', what: 'взрывы, клубы дыма, вспышки — кадры для гранат и горящих бочек',
		author: 'Kenney (www.kenney.nl)', lic: 'cc0', page: 'https://kenney.nl/assets/smoke-particles', maxMB: 40,
		src: { type: 'page', page: 'https://kenney.nl/assets/smoke-particles', match: /\.zip$/i, select: /\.png$/i, exclude: /preview|sample/i },
	},
	{
		id: 'oga_blood_splatter', cat: 'fx', what: 'брызги крови — наклейки на землю и стены',
		author: 'ExileGL (OpenGameArt)', lic: 'cc0', page: 'https://opengameart.org/content/blood-splatter', maxMB: 20,
		src: { type: 'page', page: 'https://opengameart.org/content/blood-splatter', match: /\.(png|zip)$/i, all: true, select: /\.png$/i },
	},

	// --- звуки: окружение и удары из набора CC-Sounds (GitHub, у каждого файла свой автор) ---
	{ id: 'amb_autumn_wind', cat: 'sounds', what: 'осенний ветер, пасмурно (фон кластера)', author: 'Apostolinkyyti', lic: 'cc0', page: 'https://freesound.org/people/Apostolinkyyti/sounds/128940/', src: { type: 'url', files: [`${CDDA}/environment/weather/weather_cloudy/weather_cloudy_autumn.ogg`] }, maxMB: 15 },
	{ id: 'amb_autumn_clear', cat: 'sounds', what: 'осенний день: птицы, ветер (фон в ясную погоду)', author: 'klankbeeld', lic: 'by3', page: 'https://freesound.org/people/klankbeeld/sounds/324409/', src: { type: 'url', files: [`${CDDA}/environment/weather/weather_clear/weather_clear_autumn.ogg`] }, maxMB: 15 },
	{ id: 'amb_rain_heavy', cat: 'sounds', what: 'сильный дождь', author: 'Ali@k', lic: 'cc0', page: 'https://freesound.org/people/Ali@k/sounds/128907/', src: { type: 'url', files: [`${CDDA}/environment/weather/heavyrain.ogg`] }, maxMB: 15 },
	{ id: 'amb_rain_drizzle', cat: 'sounds', what: 'морось', author: 'klankbeeld', lic: 'by3', page: 'https://freesound.org/people/klankbeeld/sounds/325442/', src: { type: 'url', files: [`${CDDA}/environment/weather/drizzle.ogg`] }, maxMB: 15 },
	{ id: 'amb_thunder_far', cat: 'sounds', what: 'дальний гром (перед перезагрузкой кластера)', author: 'chromakei', lic: 'cc0', page: 'https://freesound.org/people/chromakei/sounds/398287/', src: { type: 'url', files: [`${CDDA}/environment/weather/thunder_far.ogg`] }, maxMB: 10 },
	{ id: 'amb_night_cloudy', cat: 'sounds', what: 'ночь, пасмурно', author: 'beambot', lic: 'cc0', page: 'https://freesound.org/people/beambot/sounds/259987/', src: { type: 'url', files: [`${CDDA}/environment/weather/night/cloudy_night.ogg`] }, maxMB: 15 },
	{ id: 'sfx_axe_swing', cat: 'sounds', what: 'взмах топора', author: 'qubodup', lic: 'cc0', page: 'https://freesound.org/people/qubodup/sounds/59992/', src: { type: 'url', files: [`${CDDA}/melee_swing/big_cutting/big_cutting_swing_1.ogg`] }, maxMB: 5 },
	{ id: 'sfx_door_wood', cat: 'sounds', what: 'деревянная дверь открывается', author: 'Peter Havran (Raven2236); файл на freesound — MaxDemianAGL', lic: 'by3', page: 'https://freesound.org/people/MaxDemianAGL/sounds/183603/', src: { type: 'url', files: [`${CDDA}/open_door/door_wood/open_door.ogg`] }, maxMB: 5 },
	// --- звуки: наборы OpenGameArt и Kenney ---
	{
		id: 'oga_zombies_sound_pack', cat: 'sounds', what: '24 звука заражённых: стоны, рык, атака, смерть',
		author: 'artisticdude (OpenGameArt)', lic: 'cc0', page: 'https://opengameart.org/content/zombies-sound-pack', maxMB: 40,
		src: { type: 'page', page: 'https://opengameart.org/content/zombies-sound-pack', match: /\.(zip|wav|ogg)$/i, all: true, select: /\.(wav|ogg)$/i },
	},
	{
		id: 'oga_gunshots_tabasco', cat: 'sounds', what: 'выстрелы на стрельбище: пистолет CZ-52, винтовка Мосина, СКС, дробовик',
		author: 'Tabasco (OpenGameArt)', lic: 'cc0', page: 'https://opengameart.org/content/gunshot-sounds', maxMB: 60,
		src: { type: 'page', page: 'https://opengameart.org/content/gunshot-sounds', match: /\.(zip|wav|ogg|mp3|flac)$/i, all: true, select: /\.(wav|ogg|mp3|flac)$/i },
	},
	{
		id: 'kenney_impact_sounds', cat: 'sounds', what: 'удары по металлу, дереву, стеклу, доскам (шаги — проверить)',
		author: 'Kenney (www.kenney.nl)', lic: 'cc0', page: 'https://kenney.nl/assets/impact-sounds', maxMB: 30,
		src: { type: 'page', page: 'https://kenney.nl/assets/impact-sounds', match: /\.zip$/i, select: /\.ogg$/i },
	},
	{
		id: 'kenney_rpg_audio', cat: 'sounds', what: 'фоли: одежда и ремни, двери, металл, оружие, шаги',
		author: 'Kenney (www.kenney.nl)', lic: 'cc0', page: 'https://kenney.nl/assets/rpg-audio', maxMB: 30,
		src: { type: 'page', page: 'https://kenney.nl/assets/rpg-audio', match: /\.zip$/i, select: /\.ogg$/i },
	},
];

// ---------------------------------------------------------------- аргументы
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7).split(',').map((s) => s.trim()).filter(Boolean) : [];
const FORCE = flag('force');
const STRICT = flag('strict');

const mb = (n) => `${(n / MB).toFixed(n < 10 * MB ? 2 : 1)} МБ`;
const log = (...a) => console.log(...a);
const warn = (...a) => console.warn('⚠', ...a);

// ---------------------------------------------------------------- сеть
async function fetchRetry(url, { tries = 3, timeout = 300000, accept } = {}) {
	let last;
	for (let i = 1; i <= tries; i++) {
		try {
			const res = await fetch(url, {
				headers: { 'User-Agent': UA, ...(accept ? { Accept: accept } : {}) },
				redirect: 'follow',
				signal: AbortSignal.timeout(timeout),
			});
			if (res.ok) return res;
			last = new Error(`HTTP ${res.status}`);
			if ([401, 403, 404, 410].includes(res.status)) break; // повтор не поможет
		} catch (e) {
			last = e;
		}
		if (i < tries) await new Promise((r) => setTimeout(r, 1500 * i));
	}
	throw new Error(`${url}: ${last?.cause?.message ?? last?.message ?? last}`);
}
const getJSON = async (url) => (await fetchRetry(url, { accept: 'application/json', timeout: 60000 })).json();
const getText = async (url) => (await fetchRetry(url, { accept: 'text/html', timeout: 60000 })).text();

const exists = (p) => stat(p).then((s) => s, () => null);
const safeName = (s) => s.replace(/[^\w.\-]+/g, '_');
function safeRel(rel) {
	const n = normalize(rel).replace(/^([/\\])+/, '');
	if (!n || isAbsolute(n) || n.split(/[/\\]/).includes('..')) throw new Error(`недопустимый путь в архиве или glTF: ${rel}`);
	return n;
}

/** Скачивает url в dest с проверками размера, md5 и «HTML вместо файла». Уже скачанный файл пропускает. */
async function download(url, dest, { maxBytes = 0, md5 = '', size = 0, budget } = {}) {
	const have = await exists(dest);
	if (have && !FORCE && have.size > 0 && (!size || have.size === size)) return have.size;
	await mkdir(dirname(dest), { recursive: true });
	const res = await fetchRetry(url);
	const limit = Math.min(maxBytes || Infinity, budget?.left ?? Infinity);
	const len = Number(res.headers.get('content-length') || 0);
	if (len && len > limit) {
		await res.body?.cancel();
		throw new Error(`${basename(dest)}: ${mb(len)} больше предела ${mb(limit)}`);
	}
	const part = `${dest}.part`;
	const out = createWriteStream(part);
	const hash = createHash('md5');
	let n = 0;
	let head = Buffer.alloc(0);
	try {
		for await (const chunk of res.body) {
			n += chunk.length;
			if (n > limit) throw new Error(`${basename(dest)}: больше предела ${mb(limit)}`);
			if (head.length < 64) head = Buffer.concat([head, chunk.subarray(0, 64)]);
			hash.update(chunk);
			if (!out.write(chunk)) await once(out, 'drain');
		}
		await new Promise((ok, fail) => out.end((e) => (e ? fail(e) : ok())));
		const ext = extname(dest).toLowerCase();
		const start = head.toString('utf8').trimStart().slice(0, 15).toLowerCase();
		if (!TEXT_EXT.has(ext) && (start.startsWith('<!doctype') || start.startsWith('<html'))) throw new Error(`${basename(dest)}: вместо файла пришла HTML-страница`);
		if (n < 64) throw new Error(`${basename(dest)}: подозрительно мал (${n} байт)`);
		if (size && n !== size) throw new Error(`${basename(dest)}: размер ${n}, ожидался ${size}`);
		if (md5 && hash.digest('hex') !== md5.toLowerCase()) throw new Error(`${basename(dest)}: не совпал md5`);
		await rename(part, dest);
		if (budget) budget.left -= n;
		return n;
	} catch (e) {
		out.destroy();
		await rm(part, { force: true });
		throw e;
	}
}

// ---------------------------------------------------------------- архивы
let unzipOk = null;
function hasUnzip() {
	if (unzipOk === null) {
		try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); unzipOk = true; } catch { unzipOk = false; }
	}
	return unzipOk;
}
async function walk(dir) {
	const out = [];
	for (const e of await readdir(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) out.push(...(await walk(p)));
		else out.push(p);
	}
	return out;
}
/** Распаковывает zip во временную папку и копирует в destDir (плоско) файлы, подходящие под select. */
async function extract(zip, destDir, { select = /./, exclude = null, prefer = null } = {}) {
	if (!hasUnzip()) throw new Error('нет системного unzip');
	const tmp = `${zip}.x`;
	await rm(tmp, { recursive: true, force: true });
	await mkdir(tmp, { recursive: true });
	try {
		execFileSync('unzip', ['-q', '-o', zip, '-d', tmp], { stdio: 'ignore' });
		const byName = new Map();
		for (const f of await walk(tmp)) {
			const rel = relative(tmp, f).split(sep).join('/');
			if (rel.startsWith('__MACOSX/') || !select.test(rel) || (exclude && exclude.test(rel))) continue;
			const name = safeName(basename(rel));
			const prev = byName.get(name);
			if (!prev || (prefer && prefer.test(rel) && !prefer.test(prev.rel))) byName.set(name, { f, rel });
		}
		await mkdir(destDir, { recursive: true });
		const files = [];
		for (const [name, { f }] of byName) {
			await copyFile(f, join(destDir, name));
			files.push(join(destDir, name));
		}
		if (!files.length) throw new Error(`в архиве ${basename(zip)} нет подходящих файлов`);
		return files;
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
}

// ---------------------------------------------------------------- источники
const PH_KEYS = { diff: ['Diffuse', 'diff', 'Color'], nor_gl: ['nor_gl'], arm: ['arm'], rough: ['Rough', 'rough'], ao: ['AO', 'ao'], disp: ['Displacement', 'disp'] };
const findKey = (obj, names) => Object.keys(obj).find((k) => names.some((n) => n.toLowerCase() === k.toLowerCase()));

async function phAuthors(id) {
	try {
		const info = await getJSON(`https://api.polyhaven.com/info/${encodeURIComponent(id)}`);
		const a = Object.keys(info.authors ?? {});
		return a.length ? `${a.join(', ')} / Poly Haven` : null;
	} catch { return null; }
}

const SOURCES = {
	// Poly Haven, текстура: API /files/<id> → json[карта][1k].jpg = {url, md5, size}; без API — по шаблону адреса
	async 'polyhaven-tex'(s, dir, ctx) {
		let files = null;
		try { files = await getJSON(`https://api.polyhaven.com/files/${encodeURIComponent(s.id)}`); } catch (e) { warn(`Poly Haven API: ${e.message} — беру адреса по шаблону`); }
		const got = [];
		for (const map of s.maps) {
			const key = files && findKey(files, PH_KEYS[map] ?? [map]);
			const e = key && (files[key]?.[s.res]?.jpg ?? files[key]?.[s.res]?.png);
			if (files && !e) {
				warn(`${s.id}: в Poly Haven нет карты ${map} ${s.res} — пропускаю`);
				continue;
			}
			const url = e?.url ?? `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/${s.res}/${s.id}/${s.id}_${map}_${s.res}.jpg`;
			const dest = join(dir, safeName(basename(new URL(url).pathname)));
			await download(url, dest, { maxBytes: ctx.maxBytes, md5: e?.md5, size: e?.size, budget: ctx.budget });
			got.push(dest);
		}
		if (!got.length) throw new Error(`${s.id}: ни одной карты ${s.res}`);
		ctx.author = (await phAuthors(s.id)) ?? ctx.author;
		return got;
	},
	// Poly Haven, модель: json.gltf[1k].gltf = {url, md5, include: {путь: {url, md5}}}; без API — разбор .gltf
	async 'polyhaven-model'(s, dir, ctx) {
		let e = null;
		try { e = (await getJSON(`https://api.polyhaven.com/files/${encodeURIComponent(s.id)}`)).gltf?.[s.res]?.gltf ?? null; } catch (err) { warn(`Poly Haven API: ${err.message} — беру адрес по шаблону`); }
		const url = e?.url ?? `https://dl.polyhaven.org/file/ph-assets/Models/gltf/${s.res}/${s.id}/${s.id}_${s.res}.gltf`;
		const main = join(dir, safeName(basename(new URL(url).pathname)));
		await download(url, main, { maxBytes: ctx.maxBytes, md5: e?.md5, size: e?.size, budget: ctx.budget });
		const doc = JSON.parse(await readFile(main, 'utf8')); // заодно проверка, что это glTF
		const got = [main];
		const deps = e?.include
			? Object.entries(e.include).map(([rel, d]) => ({ rel, url: d.url, md5: d.md5, size: d.size }))
			: [...(doc.buffers ?? []), ...(doc.images ?? [])].filter((b) => b.uri && !b.uri.startsWith('data:'))
				.map((b) => ({ rel: decodeURIComponent(b.uri), url: new URL(b.uri, url).href }));
		for (const d of deps) {
			const dest = join(dir, safeRel(d.rel));
			await download(d.url, dest, { maxBytes: ctx.maxBytes, md5: d.md5, size: d.size, budget: ctx.budget });
			got.push(dest);
		}
		ctx.author = (await phAuthors(s.id)) ?? ctx.author;
		return got;
	},
	// ambientCG: zip <id>_1K-JPG.zip (ссылка get?file= перенаправляет на файл); без неё — поиск ссылки в API v2
	async ambientcg(s, dir, ctx) {
		const zip = join(CACHE, `${s.id}_${s.res}.zip`);
		const direct = `https://ambientcg.com/get?file=${encodeURIComponent(`${s.id}_${s.res}.zip`)}`;
		try {
			await download(direct, zip, { maxBytes: ctx.maxBytes, budget: ctx.budget });
		} catch (e) {
			warn(`ambientCG: ${e.message} — ищу ссылку в API`);
			const api = await getJSON(`https://ambientcg.com/api/v2/full_json?id=${encodeURIComponent(s.id)}&include=downloadData`);
			const link = findDownload(api, s.res);
			if (!link) throw new Error(`ambientCG: нет ссылки ${s.res} для ${s.id}`);
			await download(link, zip, { maxBytes: ctx.maxBytes, budget: ctx.budget });
		}
		return extract(zip, dir, { select: s.keep });
	},
	// прямые ссылки (raw.githubusercontent.com и т. п.)
	async url(s, dir, ctx) {
		const got = [];
		for (const url of s.files) {
			const dest = join(dir, safeName(decodeURIComponent(basename(new URL(url).pathname))));
			await download(url, dest, { maxBytes: ctx.maxBytes, budget: ctx.budget });
			got.push(dest);
		}
		return got;
	},
	// страница ассета (OpenGameArt, kenney.nl): ищем ссылки на файлы, zip распаковываем по фильтру
	async page(s, dir, ctx) {
		const links = await pageLinks(s.page, s.match);
		if (!links.length) throw new Error(`на странице ${s.page} нет ссылок на файлы`);
		const got = [];
		for (const url of s.all ? links : links.slice(0, 1)) {
			const name = safeName(decodeURIComponent(basename(new URL(url).pathname)));
			if (/\.zip$/i.test(name)) {
				const zip = join(CACHE, `${ctx.id}__${name}`);
				await download(url, zip, { maxBytes: ctx.maxBytes, budget: ctx.budget });
				got.push(...(await extract(zip, dir, s)));
			} else if (!s.select || s.select.test(name)) {
				const dest = join(dir, name);
				await download(url, dest, { maxBytes: ctx.maxBytes, budget: ctx.budget });
				got.push(dest);
			}
		}
		if (!got.length) throw new Error(`со страницы ${s.page} ничего не подошло под фильтр`);
		return got;
	},
};

function findDownload(node, attr) {
	if (!node || typeof node !== 'object') return null;
	if (node.attribute === attr && (node.downloadLink || node.rawLink)) return node.downloadLink || node.rawLink;
	for (const v of Object.values(node)) {
		const r = findDownload(v, attr);
		if (r) return r;
	}
	return null;
}

async function pageLinks(page, match) {
	const html = await getText(page);
	// у OpenGameArt файлы ассета — в блоке field-name-field-art-files (картинки-превью в /styles/ не берём)
	const at = html.indexOf('field-name-field-art-files');
	const part = at >= 0 ? html.slice(at, at + 30000) : html;
	const links = [...part.matchAll(/href=["']([^"']+)["']/g)].map((m) => {
		try { return new URL(m[1].replace(/&amp;/g, '&'), page).href; } catch { return null; }
	});
	return [...new Set(links)].filter((u) => {
		if (!u || /\/styles\//.test(u)) return false;
		const path = decodeURIComponent(new URL(u).pathname);
		return match.test(path);
	});
}

// ---------------------------------------------------------------- отчёт
const rel = (p) => relative(OUT, p).split(sep).join('/');
const CAT_RU = { textures: 'Текстуры', models: 'Модели', animations: 'Анимации', fx: 'Эффекты', sounds: 'Звуки' };

function licensesMd(entries, failed) {
	const L = [];
	L.push('# Внешние ассеты — авторы и лицензии', '');
	L.push('Файл пишет `scripts/fetch-assets.mjs` (первый набор из `docs/assets-catalog.md`). Все ассеты бесплатные:');
	L.push('CC0 — без условий (автор указан из уважения), CC BY — **с обязательным указанием автора** в титрах игры.', '');
	L.push('| Категория | Ассет | Что в игре | Автор | Лицензия | Источник | Файлы |', '|---|---|---|---|---|---|---|');
	for (const e of entries) {
		const lic = LIC[e.lic];
		const files = e.files.map((f) => `\`${f.path}\``).join('<br>');
		L.push(`| ${CAT_RU[e.cat] ?? e.cat} | ${e.id} | ${e.what} | ${e.author} | [${lic.name}](${lic.url}) | ${e.page} | ${files} |`);
	}
	const by = entries.filter((e) => e.lic !== 'cc0');
	if (by.length) {
		L.push('', '## Указать в титрах (CC BY)', '');
		for (const e of by) L.push(`- «${e.what}» — ${e.author}, ${e.page}, лицензия ${LIC[e.lic].name} (${LIC[e.lic].url}); файл обрезан и перекодирован при необходимости.`);
	}
	if (failed.length) {
		L.push('', '## Не скачано в этот раз', '');
		for (const f of failed) L.push(`- ${f.id} (${f.page}): ${f.error}`);
	}
	L.push('');
	return L.join('\n');
}

// ---------------------------------------------------------------- главное
async function main() {
	const ids = new Set();
	for (const a of ASSETS) {
		if (ids.has(a.id)) throw new Error(`повтор id в наборе: ${a.id}`);
		ids.add(a.id);
		if (!LIC[a.lic] || !SOURCES[a.src.type]) throw new Error(`ошибка в описании ассета ${a.id}`);
	}
	const list = ONLY.length ? ASSETS.filter((a) => ONLY.includes(a.id) || ONLY.includes(a.cat)) : ASSETS;
	if (flag('list')) {
		for (const a of list) log(`${a.cat.padEnd(10)} ${a.id.padEnd(30)} ${LIC[a.lic].name.padEnd(9)} ≤${String(a.maxMB).padStart(3)} МБ  ${a.what}`);
		log(`всего: ${list.length}`);
		return;
	}
	await mkdir(CACHE, { recursive: true });
	await writeFile(join(CACHE, '.gdignore'), '');
	const manifestPath = join(OUT, 'manifest.json');
	const old = JSON.parse((await readFile(manifestPath, 'utf8').catch(() => '[]')) || '[]');
	const byId = new Map(old.map((e) => [e.id, e]));
	const budget = { left: BUDGET_MB * MB * 2 }; // жёсткий предел скачивания за запуск — вдвое больше бюджета на диске
	const failed = [];
	let fresh = 0;

	for (const a of list) {
		const dir = join(OUT, a.cat, a.id);
		const ctx = { id: a.id, author: a.author, maxBytes: a.maxMB * MB, budget };
		let files = null;
		const errors = [];
		for (const src of [a.src, ...(a.fallbacks ?? [])]) {
			try {
				files = await SOURCES[src.type](src, dir, ctx);
				break;
			} catch (e) {
				errors.push(e.message);
			}
		}
		if (!files) {
			warn(`${a.id}: не скачан — ${errors.join(' | ')}`);
			failed.push({ id: a.id, page: a.page, error: errors.join(' | ') });
			continue;
		}
		const sized = [];
		let total = 0;
		for (const f of files) {
			const s = await stat(f);
			total += s.size;
			sized.push({ path: rel(f), bytes: s.size });
		}
		if (total > a.maxMB * MB) warn(`${a.id}: на диске ${mb(total)} — больше предела ${a.maxMB} МБ`);
		byId.set(a.id, { id: a.id, cat: a.cat, what: a.what, author: ctx.author, lic: a.lic, page: a.page, files: sized });
		fresh++;
		log(`✓ ${a.cat}/${a.id}: ${files.length} файл(ов), ${mb(total)}`);
	}

	const entries = [...byId.values()].filter((e) => ids.has(e.id)).sort((x, y) => x.cat.localeCompare(y.cat) || x.id.localeCompare(y.id));
	await writeFile(manifestPath, JSON.stringify(entries, null, 1));
	await writeFile(join(OUT, 'LICENSES.md'), licensesMd(entries, failed));
	const disk = entries.reduce((s, e) => s + e.files.reduce((t, f) => t + f.bytes, 0), 0);
	log(`\nготово: ${fresh} из ${list.length} ассетов, всего на диске ${mb(disk)}; не скачано: ${failed.length}`);
	if (disk > BUDGET_MB * MB) warn(`набор больше бюджета ${BUDGET_MB} МБ — проверьте, что лишнее не попадает в APK (exclude_filter)`);
	if (failed.length) warn(`не скачаны: ${failed.map((f) => f.id).join(', ')} (см. LICENSES.md)`);
	if (STRICT && failed.length) process.exitCode = 1;
}

main().catch((e) => {
	console.error('fetch-assets:', e.message);
	process.exitCode = STRICT ? 1 : 0; // по условию CI не падает из-за ассетов
});
