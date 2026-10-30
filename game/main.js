// «Улей. Кластер-17» — игра в духе Last Day on Earth по мотивам вселенной «Стикс».
// Вид сверху. Иммунный ходит по кластерам Улья: они перезагружаются каждые 5–7 минут вместе со всем,
// что внутри, — надо успеть обыскать дома и уйти. Между кластерами — карта мира, в стабе «Полис» —
// торговец (оружие, патроны, живчики за спораны) и лекарь.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildLevel, resolveCollisions } from './level.js';
import { setAnisotropy, bloodDecalTexture, splatterTexture, softDotTexture, bulletHoleTexture } from './textures.js';
import { createFire } from './dressing.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { view, onResize, goLandscape } from './screen.js';
import { WEAPONS, AMMO, MOUNTS, CLIPS, EQUIP, makeGrenade } from './weapons.js';
import { ITEMS, plural, makeItemMesh, GLOW, CONSUMABLES } from './items.js';
import { createIconFactory } from './icons.js';
import { createSpores } from './atmosphere.js';
import { drawPlan, Minimap, LocationMap } from './minimap.js';
import { createPost } from './post.js';
import { createMuzzleFlashes } from './muzzle.js';
import { OFFLINE } from './assets.js';
import { clothVariants, dressZombie, bodyVariation } from './variety.js';
import { MERCS, CLASSES, MAX_PARTY, ROOM_BEDS, MERC_HEAL, newMerc, PartyWindow } from './mercs.js';
import { Inventory } from './inventory.js';
import { Trade, PEA_RATE, PEARL_PRICE } from './trade.js';
import { WorldMap } from './worldmap.js';
import { NODES, WARN, newWorld, normalizeWorld, advance, timeLeft, travelTime, clock, approx, saveGame, loadGame, clearSave } from './world.js';
import { EQUIP_TIMES, HERO_GAIT } from '../src/hero-animations.js';
import { ZOMBIE_GAIT, RUBER_GAIT } from '../src/animations.js';

const $ = (id) => document.getElementById(id);
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
// настройки игрока (графика, счётчик FPS) — в localStorage; ?q= и ?fps=1 в адресе важнее
const PREFS_KEY = 'ulei-cluster17-prefs';
const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') ?? {}; } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* без хранилища — до перезагрузки */ } };
const params = new URLSearchParams(location.search);
const QUALITY = params.get('q') || (prefs.quality && prefs.quality !== 'auto' ? prefs.quality : isMobile ? 'medium' : 'high');

// ---------- Рендер ----------
// на высоком качестве сглаживание — в цепочке пост-обработки (см. post.js)
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile && QUALITY === 'medium', powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, { high: isMobile ? 1.5 : 2, medium: 1.5, low: 1 }[QUALITY] ?? 1.5));
renderer.setSize(view.w, view.h);
// теней от солнца нет: картинка чище, кадр дешевле; под персонажами — мягкие пятна (см. Actor)
renderer.shadowMap.enabled = false;
renderer.toneMappingExposure = 1.06;
$('game').appendChild(renderer.domElement);
document.body.classList.add(`q-${QUALITY}`);
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
// обычный день и «кислая» муть перед перезагрузкой кластера
const SKY = new THREE.Color(0x7a7a72), SKY_SOUR = new THREE.Color(0x8c8a5c);
const FOG = new THREE.Color(0x6e6c64), FOG_SOUR = new THREE.Color(0x8a8658);
scene.background = SKY.clone();
scene.fog = new THREE.Fog(FOG.clone(), 34, 90);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.2;

const camera = new THREE.PerspectiveCamera(42, view.w / view.h, 0.5, 220);
// заливка темнее и холоднее, солнце низкое и тёплое — жёсткий свет, освещённые и тёмные стороны
scene.add(new THREE.HemisphereLight(0xa8b4bc, 0x3c362c, 1.0));
const sun = new THREE.DirectionalLight(0xffd9b0, 2.45);
scene.add(sun, sun.target);
// ACES с цветом Улья; на высоком — ещё затенение в углах, свечение и зерно
const post = createPost(renderer, scene, camera, { quality: QUALITY, mobile: isMobile });

onResize(() => {
	camera.aspect = view.w / view.h;
	camera.updateProjectionMatrix();
	renderer.setSize(view.w, view.h);
	post.setSize(view.w, view.h);
});
// вспышка выстрела: один постоянный источник света (добавлять/убирать свет на каждый выстрел —
// перекомпиляция шейдеров и рывки на телефоне) и пламя у дула (game/muzzle.js)
const flashLight = new THREE.PointLight(0xffc070, 0, 7);
scene.add(flashLight);
const flashes = createMuzzleFlashes();
// споры в воздухе (на низком качестве — меньше)
const spores = createSpores(scene, { count: QUALITY === 'low' ? 120 : 260 });

// ---------- Загрузка ----------
const loader = new GLTFLoader();
async function loadModel(name) {
	let buffer;
	try {
		if (OFFLINE) throw new Error('offline'); // в скачанном файле модели встроены в код
		const res = await fetch(`./models/game/${name}.glb`);
		if (!res.ok) throw new Error(res.status);
		buffer = await res.arrayBuffer();
	} catch {
		const { default: b64 } = await import(`../models/game/${name}-glb.js`);
		buffer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
	}
	return loader.parseAsync(buffer, './');
}

const progress = (p, text) => { $('loadbar').style.width = `${p * 100}%`; $('loadtext').textContent = text; };
const frameWait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

let level, assets, iconFactory;
const clothSets = {}; // варианты одежды заражённых по видам
async function boot() {
	const saved = loadGame();
	progress(0.05, 'Строим кластер…');
	await frameWait();
	level = buildLevel(scene, { quality: QUALITY, id: saved?.world?.at ?? 'zarechny' });
	game.level = level;
	game.planLevel();
	progress(0.35, 'Загружаем иммунного…');
	const player = await loadModel('player');
	progress(0.55, 'Загружаем бегунов…');
	const runner = await loadModel('runner');
	progress(0.75, 'Загружаем топтунов…');
	const stomper = await loadModel('stomper');
	progress(0.83, 'Загружаем руберов…');
	const ruber = await loadModel('ruber');
	assets = { player, runner, stomper, ruber };
	// разные заражённые: варианты одежды бегуна и топтуна (цвет, кровь, грязь)
	const clothOf = (gltf) => { let map = null; gltf.scene.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) if (m.name === 'Cloth') map ??= m.map; }); return map; };
	clothSets.runner = clothVariants(clothOf(runner), 5, 11);
	clothSets.stomper = clothVariants(clothOf(stomper), 4, 23);
	progress(0.9, 'Рисуем иконки…');
	await frameWait(20);
	makeIcons();
	progress(1, 'Готово');
	$('loading').classList.add('hidden');
	showMenu();
	renderer.setAnimationLoop(frame);
	window.__game = game;
}

function showMenu() {
	const saved = loadGame();
	// скачать одним файлом — на опубликованной странице (https; файл download/ulei-cluster17.html публикуется рядом,
	// собирает его scripts/build-offline.mjs); в скачанной версии — дата сборки
	if (OFFLINE) {
		$('offline-note').textContent = `Скачанная версия, сборка от ${window.__BUILD?.date ?? '—'} Новую — скачай со страницы игры и замени этот файл: сохранение останется.`;
		$('offline-note').classList.remove('hidden');
	} else $('download').classList.toggle('hidden', location.protocol !== 'https:');
	$('btn-continue').classList.toggle('hidden', !saved);
	$('menu-save').textContent = saved ? `Сохранение: ${NODES[saved.world.at]?.short ?? '—'} · споранов ${saved.bag?.spore ?? 0}` : '';
	$('menu').classList.remove('hidden');
}

// Скачать игру одним файлом. На странице публикации — через подтверждение зрителя (возможность downloads:
// браузер внутри окна просмотра сам файлы не скачивает); где её нет — обычная ссылка с download.
let downloads = null;
window.claude?.use?.('downloads').then((d) => { downloads = d; }).catch(() => {});
$('download').addEventListener('click', async (e) => {
	if (!downloads) return; // обычная ссылка
	e.preventDefault();
	const link = $('download'), label = link.querySelector('b'), text = label.textContent;
	label.textContent = '⏳ Готовим файл…';
	try {
		const blob = await (await fetch(link.getAttribute('href'))).blob();
		await downloads.save({ filename: 'ulei-cluster17.html', data: blob });
	} catch (err) {
		// отказ зрителя — молча; иначе подсказка, что делать
		if (err?.code === 'rate_limited') link.querySelector('small').textContent = 'Окно сохранения уже открыто — подтверди его или попробуй через минуту.';
		else if (err?.code !== 'declined') link.querySelector('small').textContent = 'Здесь скачивание недоступно — открой игру в браузере на claude.ai и нажми ещё раз.';
	} finally {
		label.textContent = text;
	}
});

// Иконки предметов и портрет героя — из настоящих 3D-моделей (см. icons.js)
function makeIcons() {
	iconFactory = createIconFactory();
	if (!iconFactory) return;
	const I = game.icons;
	for (const id of Object.keys(WEAPONS)) I[id] = iconFactory.weapon(id);
	for (const k of CONSUMABLES) I[k] = iconFactory.item(k);
	I.portrait = iconFactory.portrait(assets.player);
	$('avatar').src = I.portrait;
	$('go-avatar').src = I.portrait;
	// портреты жителей стаба (торговец, лекарь) — та же модель в своей форме
	const stab = buildPortraits();
	I.trader = stab[0]; I.medic = stab[1]; I.recruiter = stab[2];
	for (const [id, D] of Object.entries(MERCS)) I[`merc_${id}`] = iconFactory.portrait(assets.player, { tint: D.tint, gear: {} });
	if (I.trader) $('trade-avatar').src = I.trader;
	$('btn-heal').insertAdjacentHTML('afterbegin', `<img src="${I.zhivchik}" alt="">`);
	$('btn-grenade').insertAdjacentHTML('afterbegin', `<img src="${I.grenade}" alt="">`);
}

/** Портреты торговца, лекаря и вербовщика по их форме из описания стаба. */
function buildPortraits() {
	const tints = [[0.75, 0.7, 0.62], [0.95, 0.95, 0.92], [0.8, 0.75, 0.7]];
	return tints.map((tint) => iconFactory.portrait(assets.player, { tint, gear: {} }));
}

// ---------- Утилиты ----------
const tmpV = new THREE.Vector3();
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
function turnTowards(current, target, maxStep) {
	let d = target - current;
	while (d > Math.PI) d -= Math.PI * 2;
	while (d < -Math.PI) d += Math.PI * 2;
	return current + Math.max(-maxStep, Math.min(maxStep, d));
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const casingGeo = {}, casingMat = {}; // общие для всех гильз
const tmpV2 = new THREE.Vector3();
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
let blobMat = null, dustMat = null, debrisGeo = null, debrisMat = null;
let splatGeo = null, splatMats = null, chunkGeo = null, chunkMat = null, bloodMat = null; // кровь и ошмётки — общие
let holeGeo = null, holeMat = null, wreckMat = null; // следы пуль, остовы бочек

/**
 * Попадает ли точка в кадр (с запасом на тени): камера сверху-сзади видит прямоугольник вокруг героя.
 * Персонажей вне кадра не рисуем и не анимируем — на телефоне это главная экономия.
 */
function inView(pos) {
	const c = camTarget, portrait = camera.aspect < 1;
	const dx = pos.x - c.x, dz = pos.z - c.z;
	return Math.abs(dx) < (portrait ? 13 : 21) * (game.zoom ?? 1) && dz > -16 && dz < (portrait ? 20 : 15);
}

/** Поле расстояний по сетке проходимости от точки (x, z) — путь к ней из любого места (волна BFS). */
function flowFrom(x, z, dist) {
	const { N, blocked } = level.nav;
	if (dist?.length !== N * N) dist = new Int16Array(N * N);
	dist.fill(-1);
	const [px, pz] = level.nav.cell(x, z);
	const start = Math.max(0, Math.min(N - 1, pz)) * N + Math.max(0, Math.min(N - 1, px));
	const queue = new Int32Array(N * N);
	let head = 0, tail = 0;
	queue[tail++] = start; dist[start] = 0;
	while (head < tail) {
		const i = queue[head++], cx = i % N, cz = (i / N) | 0, d = dist[i] + 1;
		for (let k = 0; k < 8; k++) {
			const dx = [1, -1, 0, 0, 1, 1, -1, -1][k], dz = [0, 0, 1, -1, 1, -1, 1, -1][k];
			const nx = cx + dx, nz = cz + dz;
			if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
			const j = nz * N + nx;
			if (dist[j] >= 0 || blocked[j]) continue;
			if (k >= 4 && (blocked[cz * N + nx] || blocked[nz * N + cx])) continue; // не срезаем углы
			dist[j] = d;
			queue[tail++] = j;
		}
	}
	return dist;
}

/** Куда шагнуть из pos по полю расстояний (к его началу), или null. */
function flowStep(dist, pos) {
	const { N } = level.nav;
	const [cx, cz] = level.nav.cell(pos.x, pos.z);
	let best = null, bd = dist[cz * N + cx];
	if (bd < 0) bd = 1e9;
	for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
		const nx = cx + dx, nz = cz + dz;
		if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
		const d = dist[nz * N + nx];
		if (d >= 0 && d < bd) { bd = d; best = [nx, nz]; }
	}
	if (!best) return null;
	return new THREE.Vector3(level.nav.center(best[0]) - pos.x, 0, level.nav.center(best[1]) - pos.z).normalize();
}

function lineOfSight(a, b) {
	const { N, CELL, blocked, cell } = level.nav;
	const d = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(d / (CELL * 0.5));
	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		const [gx, gz] = cell(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
		if (blocked[gz * N + gx]) return false;
	}
	return true;
}

// ---------- Персонажи ----------
class Actor {
	constructor(gltf, { scale = 1 } = {}) {
		this.root = new THREE.Group();
		this.model = SkeletonUtils.clone(gltf.scene);
		this.model.scale.setScalar(scale);
		this.model.traverse((o) => {
			if (o.isMesh) {
				o.castShadow = true;
				// кто за кадром — не рисуется (и в тени тоже): сфера позы покоя с запасом на любую анимацию
				// (лёг замертво, прыгнул, вытянул лапы)
				if (o.isSkinnedMesh) {
					o.geometry.boundingSphere ?? o.geometry.computeBoundingSphere();
					o.boundingSphere = o.geometry.boundingSphere.clone();
					o.boundingSphere.radius *= 2.2;
				}
				// свои материалы, чтобы вспыхивать красным при попадании
				o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
			}
		});
		this.root.add(this.model);
		scene.add(this.root);
		this.mixer = new THREE.AnimationMixer(this.model);
		this.actions = {};
		for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
		this.current = null;
		this.flash = 0;
		this.mats = [];
		this.model.traverse((o) => { if (o.isMesh) this.mats.push(...[o.material].flat()); });
		// мягкое пятно под ногами вместо тени от солнца
		blobMat ??= new THREE.MeshBasicMaterial({ map: softDotTexture('0,0,0'), transparent: true, opacity: 0.55, depthWrite: false });
		const blob = new THREE.Mesh(blobGeo, blobMat);
		blob.position.y = 0.03;
		blob.scale.setScalar(scale * 1.1);
		this.root.add(blob);
	}

	get pos() { return this.root.position; }

	play(name, { fade = 0.18, once = false, timeScale = 1, restart = false } = {}) {
		const a = this.actions[name];
		if (!a) return null;
		a.timeScale = timeScale;
		if (this.current === name && !restart) return a;
		const prev = this.current && this.actions[this.current];
		a.reset();
		a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
		a.clampWhenFinished = once;
		a.play();
		if (prev && prev !== a) a.crossFadeFrom(prev, fade, false);
		this.current = name;
		return a;
	}

	hitFlash() { this.flash = 1; }

	/**
	 * Толчок корпуса поверх анимации: отдача выстрела или попадание. amount — сила, wrist — подбросить кисть
	 * (пистолет, обрез), lean — куда клонит ({ x: −1 — назад, 1 — вперёд; z — вбок }).
	 */
	kick(amount, wrist = false, lean = BACK) {
		this.recoil = Math.min(1.2, (this.recoil ?? 0) + amount);
		this.recoilTwist = Math.random() - 0.5;
		this.recoilWrist = wrist;
		this.recoilLean = lean;
	}

	update(dt) {
		this.mixer.update(dt);
		if (this.recoil > 0.003) this.applyRecoil(dt);
		if (this.flash > 0) {
			this.flash = Math.max(0, this.flash - dt * 5);
			for (const m of this.mats) m.emissive?.setRGB(this.flash * 0.22, this.flash * 0.02, 0); // лёгкий отсвет, без «розового» тела
		}
	}

	/**
	 * Толчок поверх анимации: у стрелка грудь откидывается назад (ствол уходит вверх вместе с обеими руками),
	 * корпус чуть доворачивает, у пистолета кисть подбрасывает; заражённого от пули дёргает по ходу удара,
	 * голова мотается. Резкий толчок и плавный возврат.
	 */
	applyRecoil(dt) {
		this.recoil *= Math.exp(-dt * 11);
		const rig = this.kickRig ?? HERO_KICK, r = this.recoil * rig.k, L = this.recoilLean ?? BACK, m = this.model;
		this.recoilBones ??= Object.fromEntries(Object.entries(rig.bones).map(([k, n]) => [k, m.getObjectByName(n)]));
		const { chest, spine, head, hand } = this.recoilBones, tw = this.recoilTwist;
		chest?.quaternion.multiply(tmpQ.setFromEuler(tmpE.set(0.15 * r * L.x, 0.06 * r * tw, 0.15 * r * L.z)));
		spine?.quaternion.multiply(tmpQ.setFromEuler(tmpE.set(0.06 * r * L.x, 0, 0.06 * r * L.z)));
		head?.quaternion.multiply(tmpQ.setFromEuler(tmpE.set(0.22 * r * L.x, 0.12 * r * tw, 0.22 * r * L.z)));
		if (this.recoilWrist) hand?.quaternion.multiply(tmpQ.setFromEuler(tmpE.set(0, 0.55 * r, 0)));
	}

	dispose() {
		scene.remove(this.root);
		this.mixer.stopAllAction();
	}
}
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
// кости для толчка: у героя и наёмников — скелет Mixamo, у заражённых — простой (k — во сколько раз сильнее)
const HERO_KICK = { k: 1, bones: { chest: 'mixamorigSpine2', spine: 'mixamorigSpine1', hand: 'mixamorigRightHand' } };
const ZOMBIE_KICK = { k: 1.7, bones: { chest: 'Chest', spine: 'Spine', head: 'Head' } };
const BACK = { x: -1, z: 0 };

/** С чем начинают: целый топор и ПМ с полным магазином, патроны в запасе, живчик. */
const startKit = () => ({ gear: { melee: 'axe', gun: 'pistol' }, owned: ['axe', 'pistol'], mags: { pistol: WEAPONS.pistol.mag }, wear: { axe: WEAPONS.axe.durability } });

/** Набор из старого сохранения: прочность топоров, кулаки, если топора нет. */
function normalizeKit(kit) {
	kit.wear ??= {};
	kit.mags ??= {};
	for (const id of kit.owned) if (WEAPONS[id]?.durability && kit.wear[id] == null) kit.wear[id] = WEAPONS[id].durability;
	const melee = kit.gear.melee;
	if (!melee || (melee !== 'fists' && !kit.owned.includes(melee))) kit.gear.melee = kit.owned.find((w) => WEAPONS[w].slot === 'melee') ?? 'fists';
	return kit;
}
const START_BAG = { ammo9: 8, zhivchik: 1, spore: 0, peas: 0 };
const SEARCH_TIME = 1.1; // секунды на обыск
const SEARCH_REACH = 1.25; // как близко надо подойти к мебели
const REST_TIME = 120; // отдых у лекаря, секунд мира

/** Что лежит в тайнике: { ammo9: [min, max, шанс], zhivchik: шанс, ... } → [[предмет, количество]]. */
function rollLoot(spec) {
	const out = [];
	for (const [kind, v] of Object.entries(spec)) {
		if (Array.isArray(v)) { if (Math.random() < v[2]) out.push([kind, v[0] + Math.floor(Math.random() * (v[1] - v[0] + 1))]); }
		else if (Math.random() < v) out.push([kind, 1]);
	}
	return out;
}

/**
 * Бочка с горючим: пуля пробивает (искры), набралось урона — через мгновение рвётся как граната (game.explode,
 * соседние бочки — цепочкой); остаётся смятый чёрный остов и догорает. Цель для прицела — как заражённый.
 */
class FuelBarrel {
	constructor(b) {
		this.b = b;
		this.pos = b.pos;
		this.collider = b.collider;
		this.alive = true;
		this.hp = 24;
		this.scale = 0.6; // высота попадания (трассер)
		this.radius = 0.35;
		const m = b.mesh;
		b.restore ??= { material: m.material, y: m.position.y, rx: m.rotation.x, rz: m.rotation.z };
		m.position.y = b.restore.y;
		m.material = b.restore.material; m.scale.set(1, 1, 1); m.rotation.x = b.restore.rx; m.rotation.z = b.restore.rz;
	}

	damage(dmg, from) {
		if (!this.alive) return;
		this.hp -= dmg;
		game.impact(this.pos.clone().setY(0.55), true, 0.6);
		if (this.hp > 0) return;
		this.alive = false;
		let t = 0.08 + Math.random() * 0.18; // искра — и рвануло
		game.fx.push({ life: 1, update: (dt) => { t -= dt; if (t <= 0) { this.blow(); return false; } return true; }, dispose() {} });
	}

	blow() {
		const m = this.b.mesh;
		game.explode(this.pos.clone().setY(0.5));
		wreckMat ??= new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.9, metalness: 0.3 });
		m.material = wreckMat;
		m.scale.set(1.12, 0.42, 0.95);
		m.position.y = 0.18;
		m.rotation.x = (Math.random() - 0.5) * 0.5; m.rotation.z = (Math.random() - 0.5) * 0.5;
		// разлитое горючее догорает секунд восемь
		const fire = createFire(scene, this.pos.x, 0.15, this.pos.z, { size: 0.85, light: false });
		let left = 8;
		game.fx.push({ life: 8, update(dt) { left -= dt; fire.update(dt, game.time); fire.group.scale.setScalar(Math.min(1, left / 2)); return left > 0; }, dispose() { scene.remove(fire.group); } });
	}
}

/** Запасной синтезированный звук выстрела, пока записи не загрузились. */
const shotKind = (W) => (W.pellets ? 'shotgun' : W.anim === 'rifle' ? 'rifle' : 'pistol');

/**
 * Выстрел из ствола W (gun — его 3D-модель) стрелком shooter — героем или наёмником (pos, root, burst, lastShot).
 * Вспышка, дымок, гильза; пуля попадает в цель с вероятностью (падает с дальностью и длиной очереди),
 * промах бьёт в стену или землю; дробь летит веером.
 */
function fireShot(shooter, W, gun, target, { player = false } = {}) {
	const from = gun.localToWorld(gun.userData.muzzle.clone());
	const dir = new THREE.Vector3(0, -1, 0).transformDirection(gun.matrixWorld); // ствол смотрит по −Y оружия
	game.muzzleFlash(gun, from, dir, W.flash ?? 1);
	game.smoke(from, W.pellets ? 1.5 : W.flash === 0 ? 0.5 : 1);
	game.cycleGun(gun, player && shooter.ammo === 0);
	shooter.kick(0.35 + W.kick * 2.2, W.anim === 'pistol');
	if (player) game.shake = Math.min(1, game.shake + W.kick);
	if (W.casing === 'brass' || W.eject === 'shot') { game.casing(gun, W.casing); Sfx.casing(W.casing, game.ear(from)); }
	if (W.pellets) { firePellets(shooter, W, from, target); return; }
	const pos = shooter.pos;
	shooter.burst = game.time - (shooter.lastShot ?? -9) < 0.35 ? (shooter.burst ?? 0) + 1 : 0;
	shooter.lastShot = game.time;
	const d = target ? Math.hypot(target.pos.x - pos.x, target.pos.z - pos.z) : 0;
	const chance = clamp01(1 - (d / W.range) * (W.falloff ?? 0.35) - Math.min(10, shooter.burst) * W.spread);
	if (target && target.alive && Math.random() < Math.max(0.4, chance)) {
		game.tracer(from, target.pos.clone().setY(1.2 * target.scale));
		target.damage(W.damage, pos, W.damage > 80 ? 0.6 : 0.25);
		return;
	}
	// мимо: пуля уходит с отклонением и бьёт в стену или землю
	const base = target ? angleTo(pos, target.pos) : shooter.root.rotation.y;
	const a = base + (Math.random() - 0.5) * (0.12 + Math.min(10, shooter.burst) * W.spread);
	const hit = game.bulletEnd(from, Math.sin(a), Math.cos(a), W.range);
	game.tracer(from, hit.pos);
	game.impact(hit.pos, hit.wall);
	game.hitObstacle(hit, W.damage, pos);
}

/** Картечь: дробины веером, каждая — в первого заражённого на своей линии; урон падает с дистанцией. */
function firePellets(shooter, W, from, target) {
	const pos = shooter.pos;
	const base = target ? angleTo(pos, target.pos) : shooter.root.rotation.y;
	const hits = new Map();
	for (let i = 0; i < W.pellets; i++) {
		const a = base + (Math.random() - 0.5) * W.spread;
		const dx = Math.sin(a), dz = Math.cos(a);
		let best = null, bt = W.range;
		for (const e of game.enemies) {
			if (!e.alive) continue;
			const ox = e.pos.x - pos.x, oz = e.pos.z - pos.z;
			const t = ox * dx + oz * dz;
			if (t < 0 || t > bt) continue;
			const px = ox - dx * t, pz = oz - dz * t;
			if (px * px + pz * pz > (e.radius + 0.15) ** 2) continue;
			best = e; bt = t;
		}
		if (best && !lineOfSight(pos, best.pos)) { best = null; bt = W.range; }
		if (best) hits.set(best, (hits.get(best) ?? 0) + W.damage * (1 - 0.5 * bt / W.range));
		else if (i % 2 === 0) { const end = game.bulletEnd(from, dx, dz, W.range); game.impact(end.pos, end.wall, 0.6); game.hitObstacle(end, W.damage * 2, pos); bt = Math.hypot(end.pos.x - pos.x, end.pos.z - pos.z); }
		if (i % 2 === 0) game.tracer(from, new THREE.Vector3(pos.x + dx * bt, best ? 1.1 * best.scale : from.y * 0.5, pos.z + dz * bt));
	}
	for (const [e, dmg] of hits) e.damage(dmg, pos, Math.min(1.2, dmg / 60));
}

const ONE_SHOT = new Set(['Melee', 'Shoot', 'ShootRifle', 'Hit', 'HitPistol', 'HitRifle', 'Reload', 'ReloadRifle', 'EquipPistol', 'EquipAxe', 'EquipRifle', 'EquipAxeR']);

class Player extends Actor {
	constructor(gltf, kit) {
		super(gltf);
		this.kit = kit; // общий с game: слоты, всё оружие, патроны в магазинах
		this.radius = 0.38;
		this.maxHp = 100;
		this.hp = 100;
		this.hold = 'melee'; // что в руках: melee | gun
		this.reloading = 0;
		this.cooldown = 0;
		this.busy = 0; // время, пока анимация удара/выстрела не даёт бежать
		this.trigger = 0; // нажатие атаки, ждущее конца перезарядки оружия (одно нажатие — один выстрел)
		this.autoT = 0; // до следующего выстрела серии при зажатой кнопке
		this.aim = 0; // сколько ещё держать ствол в прицеле после выстрела
		this.pending = [];
		this.alive = true;
		this.lastHurt = -99;
		// точка хвата в кулаке и крепления оружия на теле (чехол топора, кобура, ремень за спиной)
		this.hand = this.model.getObjectByName('GripR');
		this.mountNodes = Object.fromEntries(Object.entries(MOUNTS).map(([k, n]) => [k, this.model.getObjectByName(n)]));
		this.models = {};
		this.attachGear();
		this.play(this.clips.idle);
	}

	/** Оружие в руках (id), его параметры и набор анимаций. */
	get weapon() { return this.kit.gear[this.hold]; }
	get W() { return WEAPONS[this.weapon]; }
	get clips() { return CLIPS[this.W.anim]; }
	get ammo() { return this.kit.mags[this.weapon] ?? 0; }
	set ammo(v) { this.kit.mags[this.weapon] = v; }

	/** 3D-модель оружия (одна на id). */
	gun(id) { return (this.models[id] ??= WEAPONS[id].make()); }

	/** Мгновенно: в руке — оружие слота hold, второе — в креплении на теле, остальное убрано. */
	attachGear() {
		const gear = Object.values(this.kit.gear);
		for (const [id, obj] of Object.entries(this.models)) if (!gear.includes(id)) obj.removeFromParent();
		for (const slot of ['melee', 'gun']) {
			const id = this.kit.gear[slot];
			if (!id) continue;
			if (slot === this.hold) { this.hand.add(this.gun(id)); this.gun(id).visible = true; } else this.stow(id);
		}
		this.reloading = 0;
		if (!this.equipping && this.alive) this.play(this.clips.idle, { fade: 0.15 });
		game.hud();
	}

	stow(id) {
		const m = this.mountNodes[WEAPONS[id].mount];
		const obj = this.gun(id);
		(m ?? this.hand).add(obj);
		obj.visible = !!m;
	}

	/** Смена оружия анимацией: убрать текущее на тело, достать другое (to — слот, по умолчанию другой). */
	switchWeapon(to) {
		to ??= this.hold === 'melee' ? 'gun' : 'melee';
		if (!this.alive || this.equipping || to === this.hold) return;
		if (this.busy > 0) { this.queuedSwitch = to; return; } // нажали во время удара — сменим сразу после
		if (!this.kit.gear[to]) { game.toast('Огнестрела нет — купи в стабе', 'warn'); return; }
		const gunAnim = WEAPONS[this.kit.gear.gun].anim;
		const clip = to === 'gun' ? EQUIP[gunAnim].draw : EQUIP[gunAnim].stow;
		const T = EQUIP_TIMES[clip];
		const from = this.weapon;
		this.reloading = 0;
		this.equipping = true;
		this.busy = this.actions[clip].getClip().duration - 0.1;
		this.play(clip, { once: true, fade: 0.12, restart: true });
		this.pending.push({ t: T.stow, fn: () => this.stow(from) });
		this.pending.push({ t: T.draw, fn: () => {
			this.hold = to;
			const obj = this.gun(this.weapon);
			this.hand.add(obj);
			obj.visible = true;
			game.hud();
		} });
		this.pending.push({ t: this.busy, fn: () => { this.equipping = false; } });
	}

	/** knock — насколько отбрасывает (удар рубера сбивает с ног и отшвыривает). */
	hurt(dmg, from, knock) {
		if (!this.alive) return;
		game.cancelSearch('Обыск прерван');
		this.hp -= dmg;
		this.lastHurt = game.time;
		this.hitFlash();
		Sfx.hurt();
		game.shake = Math.min(1, game.shake + dmg / 30);
		$('hurt').style.opacity = Math.min(0.85, 0.3 + dmg / 40);
		const av = $('avatar-wrap');
		av.classList.remove('hit'); void av.offsetWidth; av.classList.add('hit');
		if (from) {
			const d = knock ?? (dmg > 20 ? 0.6 : 0.2);
			this.push = (this.push ?? new THREE.Vector3()).addScaledVector(tmpV.subVectors(this.pos, from).setY(0).normalize(), d * PUSH_DECAY);
		}
		if (this.hp <= 0) this.die('eaten');
		else if (this.busy <= 0) {
			this.play(this.clips.hit, { once: true, fade: 0.06, restart: true });
			this.busy = 0.3;
		}
		game.hud();
	}

	die(reason) {
		if (!this.alive) return;
		this.hp = 0;
		this.alive = false;
		this.play('Death', { once: true, fade: 0.1 });
		this.pending.push({ t: 0.55, fn: () => this.dropWeapon() });
		game.over(reason);
	}

	get canAttack() { return this.alive && this.cooldown <= 0 && this.reloading <= 0 && !this.equipping; }

	/**
	 * Спуск: нажатие — ровно один выстрел/удар (если оружие ещё не готово, выстрел дождётся его),
	 * удержание — серия в темпе auto (у автомата — очередь), отпускание — огонь сразу прекращается.
	 */
	pullTrigger(dt, input) {
		if (input.consume('attack')) this.trigger = 0.3;
		else this.trigger -= dt;
		this.autoT -= dt;
		if (!this.canAttack) return;
		if (this.trigger > 0 || (input.held('attack') && this.autoT <= 0)) {
			this.trigger = 0;
			this.attack();
		}
	}

	attack() {
		if (!this.canAttack) return;
		game.cancelSearch();
		const W = this.W;
		this.autoT = W.auto ?? W.cooldown;
		if (!W.ammo) {
			const target = game.nearestEnemy(this.pos, 3.2);
			if (target) this.root.rotation.y = angleTo(this.pos, target.pos);
			this.play('Melee', { once: true, fade: 0.06, restart: true, timeScale: W.speed });
			this.cooldown = W.cooldown;
			this.busy = 0.58 / W.speed;
			Sfx.swing();
			game.noise(this.pos, W.noise);
			const id = this.weapon;
			this.pending.push({ t: W.hitTime, fn: () => this.meleeHit(W, id) });
			game.hud();
			return;
		}
		if (this.ammo <= 0) {
			// пустой магазин: перезарядка из запаса, а если запас пуст — сухой щелчок
			if ((game.bag[W.ammo] ?? 0) > 0) { this.reload(); return; }
			Sfx.dry();
			this.cooldown = 0.35;
			if (game.time - (this.emptyToast ?? -9) > 2.5) { this.emptyToast = game.time; game.toast(`Патроны ${AMMO[W.ammo]} кончились — бери топор`, 'warn'); }
			game.hud();
			return;
		}
		// у бочки с горючим толпа — прицел бьёт по бочке, иначе по ближайшему заражённому
		const target = game.barrelTarget(this.pos, W.range) ?? game.nearestEnemy(this.pos, W.range, true);
		if (target) this.root.rotation.y = angleTo(this.pos, target.pos);
		// из прицела отдача начинается сразу, из низкой готовности ствол вскидывается за 0.07 с
		const c = this.clips;
		const aiming = this.current === c.shoot || this.current === c.aim;
		this.play(c.shoot, { once: true, fade: aiming ? 0.03 : 0.07, restart: true });
		this.cooldown = W.cooldown;
		this.busy = W.anim === 'rifle' ? 0.14 : 0.25;
		this.aim = 0.9;
		this.ammo--;
		game.noise(this.pos, W.noise); // выстрел слышно издалека
		this.pending.push({ t: aiming ? 0.03 : 0.06, fn: () => this.shotHit(W, this.weapon, target) });
		if (this.ammo === 0 && (game.bag[W.ammo] ?? 0) > 0) this.pending.push({ t: 0.35, fn: () => this.reload() });
		game.hud();
	}

	/** Удар достаётся одному заражённому — ближайшему перед героем (топор не рубит толпу разом). */
	meleeHit(W, id) {
		const fx = Math.sin(this.root.rotation.y), fz = Math.cos(this.root.rotation.y);
		let best = null, score = Infinity;
		for (const e of game.enemies) {
			if (!e.alive) continue;
			const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
			if (d > W.range + e.radius) continue;
			const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (d || 1))));
			if (ang > W.arc) continue;
			const sc = d + ang * 0.8; // ближе и прямее по ходу удара
			if (sc < score) { score = sc; best = e; }
		}
		if (!best) return;
		best.damage(W.damage, this.pos, 0.45);
		Sfx.chop();
		if (W.durability) game.wearOut(id); // топор тупится от каждого удара по заражённому
	}

	/** Выстрел — в момент вскидки ствола: звук, вспышка и пуля вместе. */
	shotHit(W, id, target) {
		Sfx.gun(id, shotKind(W));
		fireShot(this, W, this.gun(id), target, { player: true });
	}

	/** При смерти оружие выпадает из руки и ложится на землю. */
	dropWeapon() {
		const w = Object.values(this.models).find((o) => o.parent === this.hand);
		if (!w) return;
		const pos = w.getWorldPosition(new THREE.Vector3());
		w.removeFromParent();
		scene.add(w);
		w.position.set(pos.x, 0.025, pos.z);
		// плашмя на боку: топорище/ствол горизонтально, лезвие вбок
		w.rotation.set(0, Math.random() * Math.PI * 2, 0);
		w.rotateZ(Math.PI / 2);
		w.rotateX(-(w.userData.tilt ?? 0)); // топорище в кулаке наклонено — на земле выравниваем
		this.dropped = w;
	}

	dispose() {
		this.dropped?.removeFromParent();
		super.dispose();
	}

	reload() {
		const W = this.W;
		if (!W.ammo || this.reloading > 0 || this.equipping || this.ammo >= W.mag) return;
		if ((game.bag[W.ammo] ?? 0) <= 0) { Sfx.dry(); game.toast(`Нет патронов ${AMMO[W.ammo]} в запасе`, 'warn'); return; }
		this.reloading = W.reload;
		this.playReload(0.1);
		if (W.casing === 'shell' && W.eject !== 'shot') {
			const spent = W.mag - this.ammo, gun = this.gun(this.weapon);
			for (let i = 0; i < spent; i++) this.pending.push({ t: 0.35 + i * 0.08, fn: () => game.casing(gun, 'shell') });
		}
		Sfx.reload(this.weapon, { dur: W.reload, n: W.mag - this.ammo });
		game.hud();
	}

	/** Анимация перезарядки растянута на время перезарядки оружия. */
	playReload(fade) {
		const c = this.clips.reload;
		this.play(c, { once: true, fade, restart: true, timeScale: this.actions[c].getClip().duration / this.W.reload });
	}

	update(dt, input) {
		super.update(dt);
		this.cooldown -= dt;
		this.busy -= dt;
		for (const p of this.pending) p.t -= dt;
		const due = this.pending.filter((p) => p.t <= 0);
		this.pending = this.pending.filter((p) => p.t > 0);
		due.forEach((p) => p.fn());
		if (this.reloading > 0) {
			this.reloading -= dt;
			if (this.reloading <= 0) {
				// в магазин уходит сколько есть в запасе
				const W = this.W;
				const take = Math.min(W.mag - this.ammo, game.bag[W.ammo] ?? 0);
				this.ammo += take;
				game.bag[W.ammo] -= take;
				game.releaseGun(this.gun(this.weapon));
				game.hud();
			}
		}
		if (this.push) {
			const k = Math.exp(-dt * PUSH_DECAY);
			this.pos.addScaledVector(this.push, (1 - k) / PUSH_DECAY);
			this.push.multiplyScalar(k);
			resolveCollisions(this.pos, this.radius ?? 0.35, level.colliders);
			if (this.push.lengthSq() < 4e-4) this.push = null;
		}
		if (!this.alive) return;
		if (this.queuedSwitch && this.busy <= 0 && !this.equipping) { const to = this.queuedSwitch; this.queuedSwitch = null; this.switchWeapon(to); }
		this.aim -= dt;
		this.pullTrigger(dt, input);
		// регенерация, если давно не ранили
		if (game.time - this.lastHurt > 6 && this.hp < this.maxHp) { this.hp = Math.min(this.maxHp, this.hp + dt * 3); game.hudThrottled(); }

		const mv = input.move;
		const mag = Math.min(1, Math.hypot(mv.x, mv.y));
		const c = this.clips;
		if (this.busy > 0) {
			// во время удара почти стоим на месте
			if (mag > 0.1) this.pos.addScaledVector(tmpV.set(mv.x, 0, mv.y).normalize(), dt * 0.6 * mag);
		} else if (mag > 0.12) {
			// шаг 1.1–1.7 м/с, бег 3.6–5 м/с; анимация ускоряется вместе с героем, ноги не скользят
			const run = mag > 0.55;
			const speed = run ? 3.6 + (1.4 * (mag - 0.55)) / 0.45 : 1.1 + (0.6 * Math.min(1, (mag - 0.12) / 0.43));
			const dir = tmpV.set(mv.x, 0, mv.y).normalize();
			this.pos.addScaledVector(dir, speed * dt);
			if (run && (this.stepDust = (this.stepDust ?? 0) + speed * dt) > 1.1) { this.stepDust = 0; game.dust(this.pos); }
			// шаги слышно: асфальт, трава, грунт или пол — по тому, что под ногами
			if ((this.stride = (this.stride ?? 0) + speed * dt) > (run ? 1.05 : 0.68)) { this.stride = 0; Sfx.step(level.surface(this.pos), run); }
			this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 12);
			const clip = run ? c.run : c.walk;
			this.play(clip, { timeScale: speed / HERO_GAIT[clip] });
		} else if (this.reloading > 0) {
			if (this.current !== c.reload) this.playReload(0.15);
		} else if (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning()) {
			// после выстрела ствол ещё немного в прицеле, потом плавно опускается
			const aim = this.hold === 'gun' && this.aim > 0;
			this.play(aim ? c.aim : c.idle, { fade: this.current === c.shoot ? 0.05 : 0.25 });
		}
		resolveCollisions(this.pos, this.radius, level.colliders);
	}
}

/** Шанс чёрной жемчужины в споровом мешке рубера. */
const PEARL_CHANCE = 0.25;
/** Чёрная жемчужина: на сколько навсегда растёт здоровье и до какого предела. */
const PEARL_HP = 20, MAX_HP_CAP = 200;
/** Как быстро гаснет толчок от попадания (1/с): весь отъезд тела = сила толчка. */
const PUSH_DECAY = 9;
const ENEMY_TYPES = {
	// move — клип погони; его скорость (ZOMBIE_GAIT) подгоняется под настоящую, чтобы ноги не скользили
	// heavy — во сколько раз хуже отлетает от ударов; stagger — на сколько замирает от попадания;
	// sight — с какого расстояния замечает героя; armor — сколько урона срезает броня с каждого попадания
	runner: { hp: 60, speed: 3.4, scale: 1, radius: 0.36, damage: 8, range: 1.25, hitTime: 0.72, attackAnim: 1, move: 'Run', score: 1, heavy: 1, stagger: 0.3 },
	stomper: { hp: 220, speed: 2.0, scale: 1.08, radius: 0.5, damage: 22, range: 1.55, hitTime: 0.85, attackAnim: 0.85, move: 'Stomp', score: 3, heavy: 3, stagger: 0.08 },
	// рубер: следующая за топтуном стадия — зверь на четырёх лапах в костяной броне, с пастью собаки-обезьяны;
	// ревёт, бросается рывками (charge — скорость галопа), бьёт броском с укусом; gait — скорости его клипов
	ruber: { hp: 520, speed: 2.6, charge: 6.4, scale: 1.12, radius: 0.58, damage: 34, knock: 1.6, range: 2.0, hitTime: 0.5, attackAnim: 1, attack: 'Attack', move: 'Walk', gait: RUBER_GAIT, score: 5, heavy: 5, stagger: 0.03, sight: 18, armor: 8, roar: true },
};

class Enemy extends Actor {
	constructor(type, pos, hp) {
		const T = ENEMY_TYPES[type];
		super(assets[type], { scale: T.scale });
		this.type = type;
		this.T = T;
		// у каждого свой рост и сложение, одежда и оттенок кожи
		const body = bodyVariation();
		this.model.scale.set(T.scale * body.s * body.w, T.scale * body.s, T.scale * body.s * body.w);
		dressZombie(this, clothSets[type], { recolor: type !== 'ruber' });
		this.scale = T.scale * body.s;
		this.radius = T.radius * body.s;
		this.hp = hp ?? T.hp;
		this.alive = true;
		this.timer = 0;
		this.stagger = 0;
		this.speedVar = 0.85 + Math.random() * 0.3;
		this.pos.copy(pos);
		this.home = pos.clone();
		this.root.rotation.y = Math.random() * Math.PI * 2;
		this.growl = 2 + Math.random() * 6;
		this.kickRig = ZOMBIE_KICK;
		// пока не заметили игрока — стоят или бродят на месте
		this.state = 'idle';
		this.wander = null;
		this.wanderTimer = Math.random() * 5;
		const idle = this.play('Idle');
		idle.time = Math.random() * idle.getClip().duration; // не все качаются в такт
	}

	/** Заметил игрока: переходит в погоню и поднимает соседей. */
	alert() {
		if (!this.alive || this.state !== 'idle') return;
		this.wander = null;
		if (this.T.roar) {
			// рубер сначала ревёт во весь рост — и рёв поднимает всех вокруг
			this.state = 'roar';
			this.timer = 0;
			this.root.rotation.y = angleTo(this.pos, game.foeFor(this.pos).pos);
			this.play('Roar', { once: true, fade: 0.15, restart: true });
			Sfx.roar(game.ear(this.pos));
			const near = clamp01(1 - this.pos.distanceTo(game.player.pos) / 20);
			game.shake = Math.min(1, game.shake + near * 0.35);
			for (const o of game.enemies) if (o !== this && o.state === 'idle' && o.pos.distanceTo(this.pos) < 18) setTimeout(() => o.alert(), 400 + Math.random() * 700);
			return;
		}
		this.state = 'chase';
		if (Math.random() < 0.6) Sfx.growl(this.type, game.ear(this.pos));
		for (const o of game.enemies) if (o !== this && o.state === 'idle' && o.pos.distanceTo(this.pos) < 6 && Math.random() < 0.6) setTimeout(() => o.alert(), 300 + Math.random() * 900);
	}

	idle(dt, p, dist) {
		if (p.alive && (dist < 3.5 || (dist < (this.T.sight ?? 13) && lineOfSight(this.pos, p.pos)))) { this.alert(); return; }
		this.wanderTimer -= dt;
		if (!this.wander && this.wanderTimer <= 0) {
			if (Math.random() < 0.5) {
				for (let i = 0; i < 8; i++) {
					const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 5;
					const x = this.home.x + Math.cos(a) * r, z = this.home.z + Math.sin(a) * r;
					if (!level.nav.blockedAt(x, z, 0.5)) { this.wander = new THREE.Vector3(x, 0, z); break; }
				}
			}
			this.wanderTimer = 3 + Math.random() * 6;
		}
		if (this.wander) {
			const dir = tmpV.set(this.wander.x - this.pos.x, 0, this.wander.z - this.pos.z);
			if (dir.length() < 0.4) { this.wander = null; this.play('Idle', { fade: 0.4 }); return; }
			dir.normalize();
			const speed = this.type === 'runner' ? 0.55 : 0.6;
			this.pos.addScaledVector(dir, speed * dt);
			this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 2.5);
			this.play('Walk', { fade: 0.4, timeScale: speed / ((this.T.gait ?? ZOMBIE_GAIT).Walk * this.scale) });
			resolveCollisions(this.pos, this.radius, level.colliders);
		} else {
			this.play('Idle', { fade: 0.4 });
		}
	}

	damage(dmg, from, knock) {
		if (!this.alive) return;
		const T = this.T;
		const dir = new THREE.Vector3().subVectors(this.pos, from).setY(0).normalize();
		// костяная броня рубера: срезает часть урона с каждого попадания — слабые пули и картечь почти не берут
		if (T.armor) {
			const cut = Math.min(dmg * 0.7, T.armor);
			dmg -= cut;
			if (cut > dmg * 0.5) game.impact(this.pos.clone().setY(1.3 * this.scale).addScaledVector(dir, -this.radius), true, 0.7); // искры от кости
		}
		this.hp -= dmg;
		this.hitFlash();
		game.blood(this.pos.clone().setY(1.2 * this.scale), T.armor ? 5 : 10, dir);
		// попадание дёргает корпус по ходу пули: в грудь — назад, в спину — вперёд, сбоку — вбок
		const ry = this.root.rotation.y;
		this.kick(Math.min(1, 0.25 + dmg / 60) / Math.sqrt(T.heavy), false, { x: dir.x * Math.sin(ry) + dir.z * Math.cos(ry), z: dir.x * Math.cos(ry) - dir.z * Math.sin(ry) });
		this.lastHit = { dmg, dir, blast: knock >= 1.2 };
		// толчок от удара: тело отъезжает плавно (топтун и рубер тяжелее); убитого отбрасывает сильнее
		const fling = this.hp <= 0 ? 1.8 : 1;
		this.push = (this.push ?? new THREE.Vector3()).addScaledVector(dir, (knock * fling * PUSH_DECAY) / T.heavy);
		this.stagger = this.state === 'roar' ? 0 : T.stagger;
		this.alert();
		Sfx.flesh(game.ear(this.pos));
		if (this.hp <= 0) this.die();
	}

	die() {
		this.alive = false;
		this.state = 'dead';
		this.timer = 0;
		this.charging = 0;
		this.play('Death', { once: true, fade: 0.08 });
		this.gore();
		game.onKill(this);
	}

	/**
	 * Тяжёлый смертельный удар разрывает тело: СВД, ВСС, пожарный топор, взрыв — сносит голову,
	 * дробь в упор и взрыв — отрывает руку. Кость сжимается в точку (голова или предплечье с кистью
	 * исчезают), из обрубка бьёт кровь, летят ошмётки.
	 */
	gore() {
		const h = this.lastHit;
		if (!h || QUALITY === 'low') return;
		const parts = [];
		if (h.dmg >= 55 && Math.random() < (h.blast ? 0.7 : 0.55)) parts.push('Head');
		if ((h.dmg >= 45 || h.blast) && Math.random() < (h.blast ? 0.6 : 0.35)) parts.push(Math.random() < 0.5 ? 'Forearm.L' : 'Forearm.R');
		for (const name of parts) {
			const bone = this.model.getObjectByName(name);
			if (!bone) continue;
			bone.scale.setScalar(0.01);
			game.stump(bone, h.dir, name === 'Head' ? 1 : 0.6);
		}
		if (parts.length) { this.gored = parts; Sfx.gib(game.ear(this.pos)); }
	}

	update(dt) {
		// цель — ближайший живой: герой или наёмник (выбор раз в полсекунды, чтобы не дёргался)
		this.foeT = (this.foeT ?? 0) - dt;
		if (this.foeT <= 0 || !this.foe?.alive) { this.foe = game.foeFor(this.pos); this.foeT = 0.5; }
		const p = this.foe;
		const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
		// далеко от камеры — не анимируем и не рисуем (экономия на телефонах)
		const near = inView(this.pos);
		this.model.visible = near;
		if (near) super.update(dt);
		if (this.push) {
			// скорость толчка гаснет по экспоненте; путь за кадр — точный интеграл
			const k = Math.exp(-dt * PUSH_DECAY);
			this.pos.addScaledVector(this.push, (1 - k) / PUSH_DECAY);
			this.push.multiplyScalar(k);
			resolveCollisions(this.pos, this.radius, level.colliders);
			if (this.push.lengthSq() < 4e-4) this.push = null;
		}
		if (!this.alive) {
			this.timer += dt;
			if (this.timer > 7) this.model.position.y -= dt * 0.25; // уходит в землю
			return this.timer < 10;
		}
		this.growl -= dt;
		if (this.growl < 0) { this.growl = 4 + Math.random() * 8; if (dist < 16) Sfx.growl(this.type, game.ear(this.pos)); }
		if (this.stagger > 0) { this.stagger -= dt; return true; }
		if (this.state === 'idle') { this.idle(dt, p, dist); return true; }
		if (this.state === 'roar') {
			this.timer += dt;
			this.root.rotation.y = turnTowards(this.root.rotation.y, angleTo(this.pos, p.pos), dt * 2);
			if (this.timer > this.actions.Roar.getClip().duration - 0.2) { this.state = 'chase'; this.chargeCd = 0; }
			return true;
		}

		if (this.state === 'attack') {
			this.timer += dt;
			const a = this.actions[this.T.attack ?? 'Attack'];
			if (!this.hitDone && this.timer >= this.T.hitTime / this.T.attackAnim) {
				this.hitDone = true;
				if (p.alive && dist < this.T.range + 0.6) p.hurt(this.T.damage, this.pos, this.T.knock);
				if (this.T.knock) { const near = clamp01(1 - dist / 12); game.shake = Math.min(1, game.shake + near * 0.4); Sfx.thud(); }
			}
			// во время выпада тело немного продвигается вперёд
			if (this.timer < 0.9) this.root.rotation.y = turnTowards(this.root.rotation.y, angleTo(this.pos, p.pos), dt * 4);
			if (this.timer > a.getClip().duration / this.T.attackAnim - 0.15) this.state = 'chase';
			return true;
		}

		if (p.alive && dist < this.T.range && this.state !== 'attack') {
			this.state = 'attack';
			this.timer = 0;
			this.hitDone = false;
			this.charging = 0;
			this.play(this.T.attack ?? 'Attack', { once: true, fade: 0.12, restart: true, timeScale: this.T.attackAnim });
			return true;
		}
		// рубер бросается рывками: разгон к добыче, на рывке плохо поворачивает — можно увернуться
		if (this.T.charge) {
			this.chargeCd = (this.chargeCd ?? 0) - dt;
			if (this.charging > 0) this.charging -= dt;
			else if (this.chargeCd <= 0 && dist > 4 && dist < 16 && lineOfSight(this.pos, p.pos)) { this.charging = 1.4; this.chargeCd = 4 + Math.random() * 2; Sfx.growl(this.type, game.ear(this.pos)); }
		}
		if (!p.alive) { this.play('Idle'); return true; }

		// направление: напрямую, если видно, иначе по полю путей (оно ведёт к герою, рядом с ним — и наёмники)
		let dir;
		if (dist < (p === game.player ? 7 : 10) && lineOfSight(this.pos, p.pos)) {
			dir = tmpV.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
		} else {
			dir = game.flowDir(this.pos) ?? tmpV.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
		}
		// расталкиваем соседей
		for (const o of game.enemies) {
			if (o === this || !o.alive) continue;
			const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d2 = dx * dx + dz * dz, r = this.radius + o.radius;
			if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); dir.x += (dx / d) * (r - d) * 3; dir.z += (dz / d) * (r - d) * 3; }
		}
		dir.normalize();
		const charging = this.charging > 0;
		if (charging) {
			// на рывке несётся туда, куда смотрит, и лишь медленно доворачивает
			this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 1.6);
			dir.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
		}
		const speed = charging ? this.T.charge : this.T.speed * this.speedVar;
		this.pos.addScaledVector(dir, speed * dt);
		if (!charging) this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 6);
		const move = charging ? 'Charge' : this.actions[this.T.move] ? this.T.move : 'Walk';
		this.play(move, { timeScale: speed / ((this.T.gait ?? ZOMBIE_GAIT)[move] * this.scale) });
		resolveCollisions(this.pos, this.radius, level.colliders);
		return true;
	}
}

/** Житель стаба: стоит на посту, поворачивается к герою, когда тот рядом. */
class Npc extends Actor {
	constructor(spec) {
		super(assets.player);
		this.pos.set(spec.x, spec.y ?? 0, spec.z);
		this.root.rotation.y = this.ry0 = spec.ry ?? 0;
		// другая форма: перекрашиваем ткань и снаряжение (не кожу)
		const tint = new THREE.Color(...(spec.tint ?? [1, 1, 1]));
		this.model.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) if (/Cloth|Gear/.test(m.name)) m.color.multiply(tint); });
		if (spec.gun) this.model.getObjectByName('GripR')?.add(WEAPONS[spec.gun].make());
		const a = this.play(spec.clip ?? 'Idle');
		if (a) a.time = Math.random() * a.getClip().duration;
	}

	update(dt) {
		const p = game.player;
		const d = p ? Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : 99;
		const want = d < 5 && Math.abs(this.pos.y) < 0.5 ? angleTo(this.pos, p.pos) : this.ry0;
		this.root.rotation.y = turnTowards(this.root.rotation.y, want, dt * 2);
		this.model.visible = inView(this.pos);
		if (this.model.visible) super.update(dt);
	}
}

/**
 * Наёмник: идёт за героем (сзади слева или справа), сам выбирает цель и стреляет из своего постоянного оружия;
 * перезаряжается из своего запаса патронов. Сам не лечится — нужен живчик от героя (или медик отряда).
 * Управлять им нельзя: в отряде он ходит за героем, а оставленный в стабе — стоит у своей койки в комнате героя.
 * Поведение — по классу (CLASSES в mercs.js): снайпер идёт поодаль, бьёт топтунов и дальних и отходит от тех,
 * кто подобрался вплотную; пулемётчик стреляет стоя длинными очередями; охотник ждёт, пока подойдут; медик лечит
 * раненых из своей аптечки; подрывник кидает гранаты в кучу, если свои не рядом с целью.
 * state ({ id, hp, mag, ammo, out, bed, meds?, nades? }) — в game.roster, в сохранении.
 */
class Merc extends Actor {
	constructor(state) {
		super(assets.player);
		this.state = state;
		this.def = MERCS[state.id];
		this.C = CLASSES[this.def.cls];
		this.W = WEAPONS[this.def.weapon];
		this.clips = CLIPS[this.W.anim];
		this.slot = 0;
		this.planted = 0;
		// своя койка в комнате героя (в стабе)
		this.home = level.room?.spots[state.bed ?? 0] ?? null;
		this.radius = 0.38;
		this.scale = 1;
		this.alive = true;
		this.cooldown = 0; this.reloading = 0; this.retarget = 0; this.burstLeft = 0; this.timer = 0;
		const tint = new THREE.Color(...this.def.tint);
		this.model.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) if (/Cloth|Gear/.test(m.name)) m.color.multiply(tint); });
		this.gunObj = this.W.make();
		this.model.getObjectByName('GripR')?.add(this.gunObj);
		this.play(this.clips.idle);
	}

	get hp() { return this.state.hp; }

	/** Точка в строю: сзади-слева или сзади-справа от героя; снайпер — дальше, медик — ближе (по классу). */
	spot() {
		const p = game.player, a = p.root.rotation.y + Math.PI + (this.slot ? 0.65 : -0.65), k = this.C.keep;
		return tmpV2.set(p.pos.x + Math.sin(a) * k, 0, p.pos.z + Math.cos(a) * k);
	}

	/** Поставить рядом с героем (приход в локацию, отстал). */
	place() {
		const s = this.spot();
		this.pos.set(s.x, 0, s.z);
		resolveCollisions(this.pos, this.radius, level.colliders);
		this.root.rotation.y = game.player.root.rotation.y;
	}

	hurt(dmg, from, knock = 0.2) {
		if (!this.alive) return;
		this.state.hp -= dmg;
		this.hitFlash();
		if (from) { tmpV.subVectors(this.pos, from).setY(0).normalize().multiplyScalar(Math.min(knock, 1)); this.pos.add(tmpV); resolveCollisions(this.pos, this.radius, level.colliders); }
		if (this.state.hp <= 0) {
			this.state.hp = 0;
			this.alive = false;
			this.play('Death', { once: true, fade: 0.1 });
			game.mercDied(this);
		} else if (this.reloading <= 0) this.play(this.clips.hit, { once: true, fade: 0.06, restart: true });
		game.hudThrottled();
	}

	update(dt) {
		const near = inView(this.pos);
		this.model.visible = near;
		if (near) super.update(dt);
		if (!this.alive) { this.timer += dt; return this.timer < 12; }
		const W = this.W, st = this.state, p = game.player, c = this.clips;
		this.cooldown -= dt;
		if (this.reloading > 0) {
			this.reloading -= dt;
			if (this.reloading <= 0) { const take = Math.min(W.mag - st.mag, st.ammo); st.mag += take; st.ammo -= take; game.hudThrottled(); }
		}
		if (!st.out) return this.stayHome(dt, near);
		if (this.throwing) return this.throwStep(dt);
		if (!p.alive) { this.play(c.idle); return true; }
		const C = this.C, dP = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
		// отстал или застрял где-то вне кадра — догоняет (появляется рядом с героем)
		if (dP > 26 && !near) { this.place(); return true; }
		// медик: раненый рядом важнее стрельбы; подрывник: граната в кучу заражённых
		if (C.heals && this.medic(dt)) return true;
		if (C.grenades && this.sapper(dt)) return true;
		this.retarget -= dt;
		if (this.retarget <= 0 || (this.target && !this.target.alive)) {
			this.retarget = 0.35;
			this.target = this.pickTarget(Math.min(W.range, C.reach));
		}
		const t = this.target;
		// снайпер вблизи беззащитен: от заражённого, подобравшегося вплотную, отходит (к герою, а не от него)
		const close = C.kite && this.reloading <= 0 ? game.nearestEnemy(this.pos, C.kite) : null;
		const follow = dP > (t ? 12 + C.keep - 2.3 : C.keep + 1.1);
		let shooting = false;
		if (t && !follow && !close) {
			shooting = true;
			this.root.rotation.y = turnTowards(this.root.rotation.y, angleTo(this.pos, t.pos), dt * 8);
			const facing = Math.abs(((angleTo(this.pos, t.pos) - this.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35;
			// пулемётчик сначала встаёт и упирает приклад
			const ready = !C.plant || this.planted > 0.45;
			if (st.mag <= 0) {
				if (st.ammo > 0 && this.reloading <= 0) this.startReload();
				else if (st.ammo <= 0 && !this.warned) { this.warned = true; game.toast(`${this.def.name}: патроны кончились!`, 'warn'); }
			} else if (this.cooldown <= 0 && this.reloading <= 0 && facing && ready) this.fire(t);
		}
		// строй: держится сзади героя; во время стрельбы стоит
		const s = this.spot();
		const dS = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
		if (close || (!shooting && dS > 0.9) || follow) {
			let dir;
			if (close) {
				// отход: прочь от заражённого, с уклоном к герою
				dir = tmpV.set(this.pos.x - close.pos.x, 0, this.pos.z - close.pos.z).normalize();
				dir.x += (p.pos.x - this.pos.x) / (dP || 1) * 0.6; dir.z += (p.pos.z - this.pos.z) / (dP || 1) * 0.6;
				dir.normalize();
			} else dir = lineOfSight(this.pos, s) ? tmpV.set(s.x - this.pos.x, 0, s.z - this.pos.z).normalize() : game.flowDir(this.pos);
			dir ??= tmpV.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
			const run = close || dP > 6 || dS > 4;
			const speed = (run ? 4.6 : Math.min(1.7, 0.6 + dS)) * (C.plant ? 0.88 : 1); // с пулемётом — тяжелее
			this.walk(dir, speed, run, !shooting || close, dt);
			this.planted = 0;
		} else {
			this.planted += dt;
			if (this.reloading > 0) {
				if (this.current !== c.reload) this.play(c.reload, { once: true, fade: 0.15, timeScale: this.actions[c.reload].getClip().duration / W.reload });
			} else if (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning()) {
				this.play(shooting ? c.aim : c.idle, { fade: 0.2 });
			}
		}
		resolveCollisions(this.pos, this.radius, level.colliders);
		return true;
	}

	/** Шаг в сторону dir: не наступает на героя и соседей; turn — разворачиваться по ходу. */
	walk(dir, speed, run, turn, dt) {
		const c = this.clips;
		for (const o of [game.player, ...game.mercs]) {
			if (o === this || !o.alive) continue;
			const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz);
			if (d < 0.8 && d > 1e-4) { dir.x += (dx / d) * (0.8 - d) * 3; dir.z += (dz / d) * (0.8 - d) * 3; }
		}
		dir.normalize();
		this.pos.addScaledVector(dir, speed * dt);
		if (turn) this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 10);
		const clip = run ? c.run : c.walk;
		if (this.reloading <= 0 || run) this.play(clip, { timeScale: speed / HERO_GAIT[clip] });
	}

	/**
	 * Цель по классу: обычно — ближайший видимый заражённый. Снайпер сначала снимает тех, кто вцепился
	 * в героя, потом руберов и топтунов, потом самых дальних.
	 */
	pickTarget(reach) {
		if (this.C.prefer !== 'far') return game.nearestEnemy(this.pos, reach, true);
		const p = game.player;
		let best = null, score = -Infinity;
		for (const e of game.enemies) {
			if (!e.alive) continue;
			const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
			if (d > reach || !lineOfSight(this.pos, e.pos)) continue;
			const onHero = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 3;
			const sc = (onHero ? 1000 : 0) + (e.type === 'ruber' ? 150 : e.type === 'stomper' ? 100 : 0) + d;
			if (sc > score) { score = sc; best = e; }
		}
		return best;
	}

	/** Медик: раненый (герой или боец отряда меньше чем на половине) — подбегает и лечит живчиком из аптечки. */
	medic(dt) {
		const st = this.state, c = this.clips;
		if (this.treating) {
			const tr = this.treating;
			tr.t -= dt;
			if (tr.who !== this) this.root.rotation.y = turnTowards(this.root.rotation.y, angleTo(this.pos, tr.who.pos), dt * 8);
			if (tr.t <= 0) {
				this.treating = null;
				this.healT = 2.5;
				if (tr.who.alive && st.meds > 0) {
					st.meds--;
					const name = tr.who === game.player ? 'тебя' : tr.who === this ? 'себя' : tr.who.def.name;
					if (tr.who === game.player) tr.who.hp = Math.min(tr.who.maxHp, tr.who.hp + MERC_HEAL);
					else tr.who.state.hp = Math.min(tr.who.def.hp, tr.who.state.hp + MERC_HEAL);
					Sfx.drink();
					game.toast(`${this.def.name} перевязал ${name}: +${MERC_HEAL}${st.meds ? '' : ' · аптечка пуста'}`);
					game.hud();
				}
			}
			return true;
		}
		this.healT = (this.healT ?? 0) - dt;
		if (this.healT > 0 || !(st.meds > 0) || this.reloading > 0) return false;
		const p = game.player;
		let who = p.alive && p.hp < p.maxHp * 0.5 ? p : null;
		for (const m of game.mercs) if (!who && m !== this && m.alive && m.state.out && m.state.hp < m.def.hp * 0.5) who = m;
		if (!who && st.hp < this.def.hp * 0.5) { who = this; } // и себя, если некого больше
		if (!who) return false;
		const d = who === this ? 0 : Math.hypot(who.pos.x - this.pos.x, who.pos.z - this.pos.z);
		if (d > 1.3) {
			const dir = lineOfSight(this.pos, who.pos) ? tmpV.set(who.pos.x - this.pos.x, 0, who.pos.z - this.pos.z).normalize() : game.flowDir(this.pos);
			if (!dir) return false;
			this.walk(dir, 4.6, true, true, dt);
			resolveCollisions(this.pos, this.radius, level.colliders);
			return true;
		}
		// рядом: перевязка (достаёт живчик и колет — та же анимация рук, что при перезарядке)
		this.treating = { who, t: 0.9 };
		this.play(c.reload, { once: true, fade: 0.1, restart: true, timeScale: this.actions[c.reload].getClip().duration / 0.9 });
		return true;
	}

	/**
	 * Подрывник: раз в секунду ищет, куда бросить Ф-1 — топтун или кучка из трёх и больше заражённых в 6–16 м,
	 * и чтобы ни героя, ни бойцов отряда не было ближе 7 м к цели. Граната выдержана в руке: рвётся почти сразу.
	 */
	sapper(dt) {
		const st = this.state;
		this.nadeT = (this.nadeT ?? 1.5) - dt;
		if (this.nadeT > 0 || !(st.nades > 0) || this.reloading > 0) return false;
		this.nadeT = 1;
		const friends = [game.player, ...game.mercs.filter((m) => m.state.out)].filter((a) => a.alive);
		let best = null, score = 2;
		for (const e of game.enemies) {
			if (!e.alive) continue;
			const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
			if (d < 6 || d > 16 || !lineOfSight(this.pos, e.pos)) continue;
			let n = 0;
			for (const o of game.enemies) if (o.alive && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 3) n++;
			const sc = n + (e.type === 'ruber' ? 3 : e.type === 'stomper' ? 2 : 0);
			if (sc <= score || friends.some((a) => Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) < 7)) continue;
			score = sc; best = e;
		}
		if (!best) return false;
		st.nades--;
		this.nadeT = 6;
		this.throwing = { t: 0.55, to: best.pos.clone(), thrown: false, nade: makeGrenade() };
		this.root.rotation.y = angleTo(this.pos, best.pos);
		this.gunObj.visible = false;
		this.model.getObjectByName('GripR')?.add(this.throwing.nade);
		this.play('Melee', { once: true, fade: 0.06, restart: true, timeScale: 1.25 });
		Sfx.swing();
		game.toast(`${this.def.name}: граната!`);
		game.hudThrottled();
		return true;
	}

	/** Бросок идёт: на взмахе граната улетает, потом в руки снова оружие. */
	throwStep(dt) {
		const th = this.throwing;
		th.t -= dt;
		if (!th.thrown && th.t <= 0.28) {
			th.thrown = true;
			const from = th.nade.getWorldPosition(new THREE.Vector3());
			th.nade.removeFromParent();
			const d = Math.hypot(th.to.x - from.x, th.to.z - from.z);
			game.launchGrenade(from, th.to, 0.5 + d / 22 + 0.3);
		}
		if (th.t <= 0) { this.throwing = null; this.gunObj.visible = true; }
		return true;
	}

	/** Оставлен в стабе: идёт к своей койке (по сетке проходимости) и ждёт там; к подошедшему герою поворачивается. */
	stayHome(dt, near) {
		const h = this.home, p = game.player, c = this.clips;
		if (!h) return true;
		const d = Math.hypot(h.x - this.pos.x, h.z - this.pos.z);
		if (d > 0.3) {
			let dir = lineOfSight(this.pos, h) ? tmpV.set(h.x - this.pos.x, 0, h.z - this.pos.z).normalize() : flowStep(this.homeFlow ??= flowFrom(h.x, h.z), this.pos);
			// пути нет или боец далеко вне кадра — сразу у койки
			if (!dir || (!near && !inView(h))) { this.pos.set(h.x, 0, h.z); this.root.rotation.y = h.ry; return true; }
			const speed = d > 4 ? 3.4 : Math.min(1.7, 0.6 + d);
			// не идёт сквозь других бойцов
			for (const o of game.mercs) {
				if (o === this || !o.alive) continue;
				const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, r = Math.hypot(dx, dz);
				if (r < 0.8 && r > 1e-4) { dir.x += (dx / r) * (0.8 - r) * 2; dir.z += (dz / r) * (0.8 - r) * 2; }
			}
			dir.normalize();
			this.pos.addScaledVector(dir, Math.min(speed * dt, d));
			this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 10);
			const clip = d > 4 ? c.run : c.walk;
			this.play(clip, { timeScale: speed / HERO_GAIT[clip] });
			if (d > 0.6) resolveCollisions(this.pos, this.radius, level.colliders);
		} else {
			const dP = p ? Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : 99;
			this.root.rotation.y = turnTowards(this.root.rotation.y, p?.alive && dP < 3.5 ? angleTo(this.pos, p.pos) : h.ry, dt * 3);
			if (this.reloading <= 0) this.play(c.idle, { fade: 0.3 });
		}
		return true;
	}

	startReload() {
		this.reloading = this.W.reload;
		const c = this.clips.reload;
		this.play(c, { once: true, fade: 0.1, restart: true, timeScale: this.actions[c].getClip().duration / this.W.reload });
		Sfx.reload(this.def.weapon, { dur: this.W.reload, n: this.W.mag - this.state.mag, ...game.ear(this.pos) });
	}

	/** Выстрел; у автоматов — короткими очередями с паузами (бережёт патроны). */
	fire(target) {
		const W = this.W;
		this.state.mag--;
		this.play(this.clips.shoot, { once: true, fade: 0.04, restart: true });
		Sfx.gun(this.def.weapon, shotKind(W), game.ear(this.pos));
		game.noise(this.pos, W.noise);
		if (W.auto < 0.2) {
			// очередь по классу: штурмовик — 3–5, пулемётчик — 9–15; потом пауза
			const [b0, b1] = this.C.burst ?? [3, 5];
			this.burstLeft = this.burstLeft > 0 ? this.burstLeft - 1 : b0 - 1 + Math.floor(Math.random() * (b1 - b0 + 1));
			this.cooldown = this.burstLeft > 0 ? W.auto : (this.C.plant ? 0.6 : 0.45) + Math.random() * 0.4;
		} else this.cooldown = W.auto + Math.random() * 0.15;
		fireShot(this, W, this.gunObj, target);
		game.hudThrottled();
	}
}

// ---------- Игра ----------
const game = {
	barrels: [], // бочки с горючим текущей локации (FuelBarrel)
	time: 0, shake: 0, kills: 0, state: 'menu', paused: false,
	bag: { ...START_BAG },
	kit: startKit(),
	world: newWorld(),
	loc: 'zarechny', from: null,
	icons: {},
	enemies: [], pickups: [], fx: [], npcs: [], mercs: [],
	perks: { maxHp: 100 }, // что даёт съеденная чёрная жемчужина (навсегда)
	roster: [], // нанятые наёмники: { id, hp, mag, ammo, out } — out: идёт с героем, иначе ждёт в комнате в стабе
	/** Отряд — кто идёт с героем. */
	get party() { return this.roster.filter((m) => m.out); },
	/** Герой в стабе (там его комната с наёмниками). */
	get inStab() { return !!level?.room; },
	player: null,
	flow: null, flowTimer: 0,
	exitArmed: false, warnStage: 0,
	input: new Input(),

	/** Новая игра: свежий иммунный в Заречном, до перезагрузки кластера 6 минут. */
	newGame() {
		clearSave();
		this.world = newWorld();
		this.bag = { ...START_BAG };
		this.kit = startKit();
		this.roster = [];
		this.perks = { maxHp: 100 };
		this.kills = 0;
		this.begin();
		this.enter('zarechny', undefined);
		this.banner('Кластер «Заречный»', `Ты в Улье. Кластер перезагрузится через ${approx(timeLeft(this.world, 'zarechny'))} — обыщи дома и уходи к стабу по трассе на восток`);
	},

	/** Продолжить с сохранения. */
	continueGame() {
		const s = loadGame();
		if (!s) { this.newGame(); return; }
		this.world = normalizeWorld(s.world);
		this.bag = { ...START_BAG, ...s.bag };
		this.kit = normalizeKit(s.kit);
		this.perks = { maxHp: 100, ...s.perks };
		// старые сохранения: был только отряд — все в нём идут с героем
		this.roster = (s.roster ?? (s.party ?? []).map((m) => ({ ...m, out: true }))).filter((m) => MERCS[m.id] && m.hp > 0).slice(0, ROOM_BEDS);
		this.roster.forEach((m, i) => { if (!(m.bed >= 0) || this.roster.some((o, j) => j < i && o.bed === m.bed)) m.bed = [...Array(ROOM_BEDS).keys()].find((b) => !this.roster.some((o, j) => j !== i && o.bed === b)); });
		this.kills = 0;
		this.begin();
		this.enter(s.world.at, s.from ?? null);
		if (this.player && s.hp) this.player.hp = Math.max(1, s.hp);
		this.hud();
		this.banner(NODES[this.loc].name, NODES[this.loc].kind === 'stab' ? 'Безопасно' : `До перезагрузки ${approx(timeLeft(this.world, this.loc))}`);
	},

	begin() {
		this.state = 'play';
		this.paused = false;
		$('menu').classList.add('hidden');
		$('gameover').classList.add('hidden');
		$('hud').classList.remove('hidden');
		this.input.pressed.clear();
		Sfx.unlock();
	},

	/** Перестроить сцену под локацию id (если она другая). */
	loadLocation(id) {
		for (const e of this.enemies) e.dispose();
		for (const n of this.npcs) n.dispose();
		for (const m of this.mercs) m.dispose();
		for (const p of this.pickups) scene.remove(p.mesh);
		for (const f of this.fx) f.dispose?.();
		this.enemies = []; this.pickups = []; this.fx = []; this.npcs = []; this.mercs = [];
		this.searching = null;
		this.flow = null;
		if (level?.id !== id) {
			level?.dispose();
			level = buildLevel(scene, { quality: QUALITY, id });
			this.level = level;
			this.planLevel();
		}
		this.barrels = level.barrels.map((b) => new FuelBarrel(b)); // взорванные — снова целые (кластер свежий)
	},

	/** План новой локации: миникарта и карта локации. */
	planLevel() {
		level.planUrl = drawPlan(level).toDataURL('image/png');
		this.minimap.setLevel(level, level.planUrl);
		this.locationMap.setLevel(level.planUrl);
	},

	/**
	 * Прийти в локацию id из from (undefined — начало игры: точка старта локации).
	 * Кластер: восстановить, что было (если не перезагрузился), или заселить заново.
	 */
	enter(id, from) {
		this.loadLocation(id);
		this.loc = id;
		this.from = from;
		this.world.at = id;
		const spot = from === undefined ? level.start : level.entry(from);
		if (!this.player || !this.player.alive) {
			this.player?.dispose();
			this.player = new Player(assets.player, this.kit);
			this.player.maxHp = this.player.hp = this.perks.maxHp;
		}
		this.player.kit = this.kit;
		this.player.pos.copy(spot.pos);
		this.player.root.rotation.y = spot.ry;
		this.player.attachGear();
		camTarget.copy(spot.pos).setY(0.8);
		this.exitArmed = false;
		this.edgeHint = false;
		this.warnStage = 0;
		this.visited = new Set();
		this.inventory?.close();
		spores.density = NODES[id].kind === 'cluster' ? 1 : 0.35;
		if (NODES[id].kind === 'cluster') this.populate(this.world.clusters[id].saved);
		else for (const n of level.npcs) this.npcs.push(new Npc(n));
		this.spawnMercs();
		this.reloadFx(Infinity);
		this.hud();
		this.save();
	},

	spawnEnemy(type, pos, hp) {
		const e = new Enemy(type, pos, hp);
		this.enemies.push(e);
		return e;
	},

	/** Заражённые уже в кластере, тайники в домах. saved — состояние с прошлого визита в этом цикле. */
	populate(saved) {
		if (saved) {
			for (const e of saved.enemies) this.spawnEnemy(e.type, new THREE.Vector3(e.x, 0, e.z), e.hp);
			level.containers.forEach((c, i) => {
				const s = saved.containers[i];
				c.items = s ? s.items : rollLoot(c.loot);
				c.searched = s ? s.searched : false;
				c.spark.visible = !c.searched;
			});
			for (const p of saved.pickups) this.spawnPickup(p.kind, new THREE.Vector3(p.x, 0, p.z), p.value, { ground: p.ground });
			return;
		}
		const start = this.player.pos;
		const free = (cx, cz, r) => {
			for (let i = 0; i < 30; i++) {
				const a = Math.random() * Math.PI * 2, d = Math.random() * r;
				const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
				if (level.nav.blockedAt(x, z, 0.6) || Math.hypot(x - start.x, z - start.z) < 15) continue;
				if (this.enemies.some((e) => e.pos.distanceTo(tmpV.set(x, 0, z)) < 1.2)) continue;
				return new THREE.Vector3(x, 0, z);
			}
			return null;
		};
		for (const g of level.groups) {
			for (const [type, n] of [['runner', g.runners ?? 0], ['stomper', g.stompers ?? 0], ['ruber', g.rubers ?? 0]]) {
				for (let i = 0; i < n; i++) {
					const pos = free(g.at[0], g.at[1], g.r);
					if (pos) this.spawnEnemy(type, pos);
				}
			}
		}
		// тайники в домах: что где лежит — заново на каждый цикл кластера
		for (const c of level.containers) {
			c.items = rollLoot(c.loot);
			c.searched = false;
			c.spark.visible = true;
		}
	},

	/** Запомнить кластер, каким его оставляем: живые заражённые, обысканное, лежащее на земле. */
	snapshot() {
		const c = this.world.clusters[this.loc];
		if (!c || !level) return;
		c.saved = {
			enemies: this.enemies.filter((e) => e.alive).map((e) => ({ type: e.type, x: +e.pos.x.toFixed(2), z: +e.pos.z.toFixed(2), hp: Math.ceil(e.hp) })),
			containers: level.containers.map((k) => ({ items: k.items ?? [], searched: !!k.searched })),
			pickups: this.pickups.map((p) => ({ kind: p.kind, x: +p.mesh.position.x.toFixed(2), z: +p.mesh.position.z.toFixed(2), value: p.value, ground: p.ground })),
		};
	},

	/** Сохранить игру (в localStorage; в приватном режиме может не получиться — тогда без сохранения). */
	save() {
		if (this.state !== 'play' || !this.player?.alive) return;
		if (NODES[this.loc].kind === 'cluster') this.snapshot();
		saveGame({ world: this.world, bag: this.bag, kit: this.kit, roster: this.roster, perks: this.perks, hp: Math.ceil(this.player.hp), from: this.from ?? null });
	},

	/** Уйти по дороге в to: время мира уходит на путь, за это время кластеры могут перезагрузиться. */
	travel(to) {
		if (this.state !== 'play') return;
		const from = this.loc, time = travelTime(from, to);
		if (NODES[from].kind === 'cluster') this.snapshot();
		this.state = 'travel';
		this.setPaused(true);
		$('travel-title').textContent = `Дорога: ${NODES[to].name}`;
		$('travel-sub').textContent = `в пути ${approx(time)}…`;
		$('travel').classList.remove('hidden');
		// портрет героя едет по карте, потом строится локация (это занимает время на телефоне)
		this.worldMap.animateTravel(from, to, 1500, () => setTimeout(() => {
			advance(this.world, time);
			const node = NODES[to], visited = !!this.world.clusters[to]?.saved;
			this.state = 'play';
			this.enter(to, from);
			this.setPaused(false);
			if (node.kind === 'stab') this.banner(node.name, 'Безопасно: торговец, лекарь. Выход — через ворота');
			else this.banner(node.name, `До перезагрузки ${approx(timeLeft(this.world, to))}${visited ? ' · здесь ты уже был' : ''}`);
			setTimeout(() => $('travel').classList.add('hidden'), 350);
		}, 30));
	},

	/** Гибель: в рюкзаке всё пропадает, оружие остаётся; герой приходит в себя в стабе. */
	respawn() {
		for (const k of CONSUMABLES) this.bag[k] = 0;
		advance(this.world, 90);
		this.player?.dispose();
		this.player = null;
		this.begin();
		this.enter('stab', undefined);
		this.banner('Стаб «Полис»', this.party.length ? 'Наёмники вытащили тебя. Рюкзак остался в кластере, оружие при тебе' : 'Тебя вытащили рейдеры. Рюкзак остался в кластере, оружие при тебе');
	},

	/** Шум: заражённые в радиусе r идут на звук. */
	noise(pos, r) {
		for (const e of this.enemies) if (e.state === 'idle' && e.pos.distanceTo(pos) < r) e.alert();
	},

	banner(title, sub) {
		$('banner-title').textContent = title;
		$('banner-sub').textContent = sub;
		const b = $('banner');
		b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
	},

	/** Сколько записей звуков загружено и сколько всего (для тестов). */
	sounds() { return [Sfx.loaded, Sfx.total]; },

	/** Где звук относительно героя: до него метров и левее/правее на экране (камера смотрит на север). */
	ear(p) {
		const h = this.player?.pos;
		if (!h) return {};
		const dx = p.x - h.x;
		return { d: Math.hypot(dx, p.z - h.z), pan: Math.max(-0.8, Math.min(0.8, dx / 14)) };
	},

	nearestEnemy(from, range, needSight = false) {
		let best = null, bd = range;
		for (const e of this.enemies) {
			if (!e.alive) continue;
			const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z);
			if (d < bd && (!needSight || lineOfSight(from, e.pos))) { bd = d; best = e; }
		}
		return best;
	},

	// Поле путей: BFS от клетки игрока по сетке навигации
	updateFlow() { this.flow = flowFrom(this.player.pos.x, this.player.pos.z, this.flow); },

	flowDir(pos) { return this.flow ? flowStep(this.flow, pos) : null; },

	onKill(e) {
		this.kills++;
		Sfx.death(e.type, this.ear(e.pos));
		this.decal(e.pos, e.type === 'runner' ? 1.6 : e.type === 'stomper' ? 2.4 : 3);
		// споровый мешок на затылке: чем развитее заражённый, тем он богаче. У бегуна — споран, у топтуна — ещё
		// горох, у рубера — больше гороха и бывает чёрная жемчужина. Патронов и живчиков у заражённых нет
		const near = (dx, dz) => e.pos.clone().add(new THREE.Vector3(dx, 0, dz));
		this.spawnPickup('spore', e.pos, e.T.score);
		if (e.type === 'stomper') this.spawnPickup('peas', near(-0.5, 0.5), 1 + Math.floor(Math.random() * 2));
		if (e.type === 'ruber') {
			this.spawnPickup('peas', near(-0.6, 0.5), 2 + Math.floor(Math.random() * 3));
			if (Math.random() < PEARL_CHANCE) this.spawnPickup('pearl', near(0.6, -0.4), 1);
		}
		this.hud();
	},

	/** Предмет на земле: висит и светится; ground — лежит на земле. */
	spawnPickup(kind, pos, value = 1, { ground = false } = {}) {
		const mesh = new THREE.Group();
		const model = makeItemMesh(kind);
		model.scale.setScalar(1.3);
		const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(GLOW[kind] ?? GLOW.weapon), transparent: true, opacity: 0.55, depthWrite: false }));
		glow.scale.setScalar(ITEMS[kind]?.type === 'ammo' ? 1.1 : 0.85);
		glow.position.y = 0.15;
		mesh.add(model, glow);
		mesh.position.copy(pos).setY(ground ? 0.02 : 0.3);
		scene.add(mesh);
		this.pickups.push({ kind, mesh, value, t: Math.random() * 6, ground, glow });
	},

	/** Подобрать предмет в рюкзак. Найденное оружие — в коллекцию (повторное — разбираем на патроны). */
	take(kind, n) {
		const W = WEAPONS[kind];
		if (W) {
			const kit = this.kit;
			if (kit.owned.includes(kind)) {
				if (W.ammo) { this.bag[W.ammo] = (this.bag[W.ammo] ?? 0) + 4; this.toast(`${W.name} уже есть — забрал 4 патрона ${AMMO[W.ammo]}`); }
				if (W.durability) { kit.wear[kind] = W.durability; this.toast(`${W.name}: сменил затупленный на целый`); this.hud(); }
			} else {
				kit.owned.push(kind);
				if (W.ammo) kit.mags[kind] = Math.min(W.mag, 2);
				if (W.durability) kit.wear[kind] = W.durability;
				if (kit.gear[W.slot] === 'fists') { kit.gear[W.slot] = kind; this.player.attachGear(); this.toast(`Найден: ${W.name}! Сразу в слот`); }
				else this.toast(`Найден: ${W.name}! Возьми его в рюкзаке`);
			}
		} else {
			this.bag[kind] = (this.bag[kind] ?? 0) + n;
			if (kind === 'pearl') { this.banner('Чёрная жемчужина!', 'Редчайшая находка Улья. Съешь — организм окрепнет, или продай торговцу в стабе'); Sfx.chime(); }
			else this.toast(`+${n} ${plural(n, ITEMS[kind].forms)}`);
		}
		Sfx.pickup();
		this.hud();
		if (this.inventory?.isOpen) this.inventory.render();
	},

	/** Ближайший необысканный тайник, до которого дотягивается герой. */
	nearContainer() {
		const p = this.player.pos;
		let best = null, bd = SEARCH_REACH;
		for (const c of level.containers) {
			if (c.searched) continue;
			const d = Math.min(Math.hypot(c.ax - p.x, c.az - p.z), Math.hypot(c.x - p.x, c.z - p.z) - 0.45);
			if (d < bd) { bd = d; best = c; }
		}
		return best;
	},

	/**
	 * Точка действия стаба рядом: торговец, лекарь, вербовщик, стол в комнате — и наёмники в комнате героя:
	 * к ждущему у койки подходишь — «Взять с собой», к идущему с тобой (в комнате) — «Оставить».
	 */
	nearStation() {
		const p = this.player.pos;
		let best = null, bd = Infinity;
		const consider = (s) => { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < s.r && d < bd) { bd = d; best = s; } };
		for (const s of level.stations) consider(s);
		if (level.room) {
			const inRoom = level.room.contains(p);
			for (const m of this.mercs) {
				if (!m.alive) continue;
				if (!m.state.out) consider({ id: 'take', merc: m, name: m.def.name, label: 'Взять с собой', x: m.pos.x, z: m.pos.z, r: 1.6 });
				else if (inRoom) consider({ id: 'leave', merc: m, name: m.def.name, label: 'Оставить в комнате', x: m.pos.x, z: m.pos.z, r: 2.8 });
			}
		}
		return best;
	},

	/** Кнопка действия: обыскать мебель или поговорить с жителем стаба. */
	act() {
		const p = this.player;
		if (!p?.alive || this.searching || this.paused || p.busy > 0 || p.equipping) return;
		const s = this.nearStation();
		if (s) {
			p.root.rotation.y = Math.atan2(s.x - p.pos.x, (s.merc ? s.z : s.z - 2) - p.pos.z); // лицом к бойцу, прилавку, палатке
			if (s.id === 'trade') this.trade.open();
			if (s.id === 'rest') this.rest();
			if (s.id === 'mercs') this.partyWindow.open({ hiring: true });
			if (s.id === 'room') this.partyWindow.open();
			if (s.id === 'take') this.takeMerc(s.merc.state.id);
			if (s.id === 'leave') this.leaveMerc(s.merc.state.id);
			return;
		}
		const c = this.nearContainer();
		if (!c) return;
		this.searching = { c, t: 0 };
		p.root.rotation.y = Math.atan2(c.x - p.pos.x, c.z - p.pos.z);
		Sfx.search();
	},

	cancelSearch(msg) {
		if (!this.searching) return;
		this.searching = null;
		if (msg) this.toast(msg, 'warn');
	},

	updateSearch(dt, input) {
		const s = this.searching;
		const el = $('search');
		if (s) {
			const mv = input.move;
			if (Math.hypot(mv.x, mv.y) > 0.25 || !this.player.alive) { this.cancelSearch('Обыск прерван'); return; }
			s.t += dt;
			$('search-bar').style.width = `${Math.min(1, s.t / SEARCH_TIME) * 100}%`;
			if (s.t >= SEARCH_TIME) {
				const c = s.c;
				this.searching = null;
				c.searched = true;
				c.spark.visible = false;
				if (!c.items.length) this.toast(`${c.name}: пусто`);
				for (const [kind, n] of c.items) this.take(kind, n);
				c.items = [];
			}
		}
		// подсказка у мебели и у жителей стаба
		const st = this.searching ? null : this.nearStation();
		const c = st ? null : this.searching?.c ?? this.nearContainer();
		el.classList.toggle('hidden', (!c && !st) || !this.player.alive);
		const face = st ? this.icons[st.merc ? `merc_${st.merc.state.id}` : { trade: 'trader', rest: 'medic', mercs: 'recruiter' }[st.id] ?? 'portrait'] : null;
		$('search-face').classList.toggle('hidden', !face);
		if (face && $('search-face').getAttribute('src') !== face) $('search-face').src = face;
		if (st) {
			$('search-verb').textContent = st.label;
			$('search-name').textContent = st.name;
			el.classList.remove('busy');
			$('search-bar').style.width = '0%';
		} else if (c) {
			$('search-verb').textContent = 'Обыскать';
			$('search-name').textContent = c.name;
			el.classList.toggle('busy', !!this.searching);
			if (!this.searching) $('search-bar').style.width = '0%';
		}
		// подсказка при входе в здание
		const b = level.buildingAt(this.player.pos);
		if (b && !this.visited.has(b.name)) {
			this.visited.add(b.name);
			const hint = level.hint?.(b);
			if (hint) this.toast(hint);
		}
	},

	/** Выпить живчик из рюкзака. */
	drink() {
		const p = this.player;
		if (!p?.alive || !(this.bag.zhivchik > 0)) { if (p?.alive) this.toast('Живчиков нет', 'warn'); return; }
		if (p.hp >= p.maxHp) { this.toast('Здоровье и так полное'); return; }
		this.bag.zhivchik--;
		p.hp = Math.min(p.maxHp, p.hp + 45);
		Sfx.drink();
		this.toast('Живчик: +45 здоровья');
		this.hud();
	},

	/** Съесть чёрную жемчужину: здоровье навсегда больше (до предела) и сразу полное. */
	eatPearl() {
		const p = this.player;
		if (!p?.alive || !(this.bag.pearl > 0)) return;
		if (this.perks.maxHp >= MAX_HP_CAP) { this.toast(`Здоровье и так на пределе (${MAX_HP_CAP}) — лучше продай торговцу`, 'warn'); return; }
		this.bag.pearl--;
		this.perks.maxHp = Math.min(MAX_HP_CAP, this.perks.maxHp + PEARL_HP);
		p.maxHp = this.perks.maxHp;
		p.hp = p.maxHp;
		Sfx.chime();
		this.banner('Организм окреп', `Здоровье навсегда ${p.maxHp} (+${PEARL_HP})`);
		this.hud();
		this.save();
	},

	/** Продать чёрную жемчужину торговцу. */
	sellPearl() {
		if (!(this.bag.pearl > 0)) return;
		this.bag.pearl--;
		this.bag.spore = (this.bag.spore ?? 0) + PEARL_PRICE;
		Sfx.coins();
		this.toast(`Чёрная жемчужина → ${PEARL_PRICE} споранов`);
		this.hud();
		this.save();
	},

	/** Взять в руки оружие слота (анимацией). */
	hold(slot) { this.player.switchWeapon(slot); },

	/** Запасное оружие из рюкзака — в его слот; прежнее уходит в рюкзак. */
	equipGear(id) {
		const W = WEAPONS[id];
		if (!W || !this.kit.owned.includes(id)) return;
		this.kit.gear[W.slot] = id;
		this.player.attachGear();
		this.toast(`${W.name} — в слоте`);
		this.save();
	},

	/** Купить у торговца. */
	buy(offer) {
		const price = offer.price, W = WEAPONS[offer.id], kit = this.kit;
		if ((this.bag.spore ?? 0) < price) { this.toast('Не хватает споранов', 'warn'); return; }
		const owned = W && kit.owned.includes(offer.id);
		if (owned && !(W.durability && (kit.wear[offer.id] ?? W.durability) < W.durability)) return;
		this.bag.spore -= price;
		if (owned) {
			// изношенный топор меняем на новый
			kit.wear[offer.id] = W.durability;
			this.toast(`Новый ${W.name.toLowerCase()} — ${W.durability} ударов`);
		} else if (W) {
			kit.owned.push(offer.id);
			if (W.ammo) kit.mags[offer.id] = W.mag; // продаётся снаряжённым
			if (W.durability) kit.wear[offer.id] = W.durability;
			const old = kit.gear[W.slot];
			kit.gear[W.slot] = offer.id;
			this.player.attachGear();
			this.toast(`${W.name} — в слоте${old && old !== 'fists' ? `, ${WEAPONS[old].name} — в рюкзаке` : ''}`);
		} else {
			this.bag[offer.id] = (this.bag[offer.id] ?? 0) + offer.n;
			this.toast(`+${offer.n} ${plural(offer.n, ITEMS[offer.id].forms)}`);
		}
		Sfx.coins();
		this.hud();
		this.save();
	},

	/** Обменять n горошин на спораны. */
	exchangePeas(n) {
		n = Math.min(n, this.bag.peas ?? 0);
		if (n <= 0) return;
		this.bag.peas -= n;
		this.bag.spore = (this.bag.spore ?? 0) + n * PEA_RATE;
		Sfx.coins();
		this.toast(`+${n * PEA_RATE} ${plural(n * PEA_RATE, ITEMS.spore.forms)}`);
		this.hud();
		this.save();
	},

	/** Отдых у лекаря: здоровье полное, время мира идёт вперёд (кластеры успевают перезагрузиться). */
	rest() {
		const p = this.player;
		advance(this.world, REST_TIME);
		p.hp = p.maxHp;
		Sfx.drink();
		this.banner('Отдых', `Прошло ${approx(REST_TIME)}. Здоровье восстановлено`);
		this.hud();
		this.save();
	},

	/** Удар топором по заражённому: прочность −1; на исходе — предупреждение, на нуле — ломается. */
	wearOut(id) {
		const W = WEAPONS[id], kit = this.kit;
		const left = kit.wear[id] = (kit.wear[id] ?? W.durability) - 1;
		if (left <= 0) { this.breakWeapon(id); return; }
		if (left === Math.ceil(W.durability * 0.2)) this.toast(`${W.name} затупился — осталось ${left} ударов`, 'warn');
		this.hudThrottled();
	},

	/** Оружие сломалось: обломки падают на землю, в руки — запасное того же слота или кулаки. */
	breakWeapon(id) {
		const W = WEAPONS[id], kit = this.kit, p = this.player;
		kit.owned = kit.owned.filter((w) => w !== id);
		delete kit.wear[id];
		const spare = kit.owned.find((w) => WEAPONS[w].slot === W.slot);
		if (kit.gear[W.slot] === id) kit.gear[W.slot] = spare ?? 'fists';
		const obj = p.models[id];
		if (obj) {
			delete p.models[id];
			const pos = obj.getWorldPosition(new THREE.Vector3());
			obj.removeFromParent();
			obj.position.set(pos.x, 0.03, pos.z);
			obj.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2);
			obj.rotateX(-(obj.userData.tilt ?? 0) + 0.5);
			scene.add(obj);
			this.fx.push({ life: 25, update(dt) { this.life -= dt; return this.life > 0; }, dispose() { obj.removeFromParent(); } });
		}
		Sfx.snap();
		this.banner(`${W.name} сломался`, spare ? `В руках — ${WEAPONS[spare].name.toLowerCase()}` : 'Остались кулаки — купи топор у торговца в стабе или найди в домах');
		p.attachGear();
		this.save();
	},

	// ---------- Наёмники ----------

	/** Наёмники в новой локации: отряд — рядом с героем; в стабе ещё и оставленные — у своих коек. */
	spawnMercs() {
		for (const m of this.mercs) m.dispose();
		this.mercs = this.roster.filter((st) => st.out || level.room).map((st) => {
			const m = new Merc(st);
			if (st.out || !m.home) m.place(); else { m.pos.set(m.home.x, 0, m.home.z); m.root.rotation.y = m.home.ry; }
			return m;
		});
		this.slotMercs();
		this.renderPartyBar();
	},

	/** Места в строю: первый в отряде — сзади слева, второй — справа. */
	slotMercs() {
		const party = this.party;
		for (const m of this.mercs) m.slot = Math.max(0, party.indexOf(m.state));
	},

	/** Ближайший живой, на кого кидаются заражённые: герой или наёмник отряда. */
	foeFor(pos) {
		let best = this.player, bd = this.player?.alive ? Math.hypot(this.player.pos.x - pos.x, this.player.pos.z - pos.z) : Infinity;
		for (const m of this.mercs) {
			if (!m.alive || !m.state.out) continue;
			const d = Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z);
			if (d < bd) { bd = d; best = m; }
		}
		return best;
	},

	merc(id) { return this.roster.find((m) => m.id === id); },

	/** Нанять у вербовщика: боец идёт в комнату героя и ждёт у своей койки. */
	hire(id) {
		const D = MERCS[id];
		if (this.roster.length >= ROOM_BEDS || this.merc(id)) return;
		if ((this.bag.spore ?? 0) < D.price) { this.toast('Не хватает споранов', 'warn'); return; }
		this.bag.spore -= D.price;
		const bed = [...Array(ROOM_BEDS).keys()].find((b) => !this.roster.some((m) => m.bed === b));
		const st = newMerc(id, bed);
		this.roster.push(st);
		const m = new Merc(st);
		m.place();
		this.mercs.push(m);
		Sfx.coins();
		this.toast(`${D.name} (${CLASSES[D.cls].name.toLowerCase()}) нанят — ждёт в твоей комнате (жилой блок у казармы)`);
		this.renderPartyBar();
		this.hud();
		this.save();
	},

	/** Взять бойца из комнаты на вылазку. */
	takeMerc(id) {
		const st = this.merc(id);
		if (!st || st.out) return;
		if (this.party.length >= MAX_PARTY) { this.toast(`С тобой уже ${MAX_PARTY} — сначала оставь кого-нибудь в комнате`, 'warn'); return; }
		st.out = true;
		this.slotMercs();
		Sfx.reload();
		this.toast(`${MERCS[id].name} идёт с тобой`);
		this.renderPartyBar();
		this.save();
	},

	/** Оставить бойца в комнате (только в стабе): он уходит к своей койке. */
	leaveMerc(id) {
		const st = this.merc(id);
		if (!st?.out || !level.room) return;
		st.out = false;
		this.slotMercs();
		this.toast(`${MERCS[id].name} остаётся в комнате`);
		this.renderPartyBar();
		this.save();
	},

	/** Дать наёмнику патроны его калибра (до магазина за раз). */
	giveAmmo(id) {
		const st = this.merc(id), W = WEAPONS[MERCS[st.id].weapon], n = Math.min(this.bag[W.ammo] ?? 0, W.mag);
		if (n <= 0) { this.toast(`Нет патронов ${AMMO[W.ammo]}`, 'warn'); return; }
		this.bag[W.ammo] -= n;
		st.ammo += n;
		const actor = this.mercs.find((m) => m.state === st);
		if (actor) actor.warned = false;
		Sfx.reload();
		this.toast(`${MERCS[st.id].name}: +${n} ${plural(n, ITEMS[W.ammo].forms)}`);
		this.hud();
	},

	/** Живчик наёмнику: сам он не лечится. */
	healMerc(id) {
		const st = this.merc(id), D = MERCS[st.id];
		if (!(this.bag.zhivchik > 0) || st.hp >= D.hp) return;
		this.bag.zhivchik--;
		st.hp = Math.min(D.hp, st.hp + MERC_HEAL);
		Sfx.drink();
		this.toast(`${D.name}: +${MERC_HEAL} здоровья`);
		this.hud();
	},

	/** Живчик в аптечку медика — он сам лечит им раненых. */
	giveMeds(id) {
		const st = this.merc(id);
		if (!st || !(this.bag.zhivchik > 0)) return;
		this.bag.zhivchik--;
		st.meds = (st.meds ?? 0) + 1;
		Sfx.drink();
		this.toast(`${MERCS[id].name}: в аптечке ${st.meds} ${plural(st.meds, ITEMS.zhivchik.forms)}`);
		this.hud();
	},

	/** Гранату подрывнику. */
	giveNade(id) {
		const st = this.merc(id);
		if (!st || !(this.bag.grenade > 0)) return;
		this.bag.grenade--;
		st.nades = (st.nades ?? 0) + 1;
		Sfx.reload();
		this.toast(`${MERCS[id].name}: гранат ${st.nades}`);
		this.hud();
	},

	/** Отпустить наёмника совсем (у вербовщика): освобождает койку. */
	dismiss(id) {
		const st = this.merc(id);
		if (!st) return;
		this.roster = this.roster.filter((m) => m !== st);
		const a = this.mercs.find((m) => m.state === st);
		a?.dispose();
		this.mercs = this.mercs.filter((m) => m !== a);
		this.slotMercs();
		this.toast(`${MERCS[st.id].name} ушёл из стаба`);
		this.renderPartyBar();
		this.save();
	},

	/** Погиб — насовсем: койка в комнате освобождается. */
	mercDied(m) {
		this.roster = this.roster.filter((st) => st !== m.state);
		this.slotMercs();
		Sfx.death('human');
		this.banner(`${m.def.name} погиб`, `${WEAPONS[m.def.weapon].name} остался на месте гибели`);
		this.renderPartyBar();
	},

	/** Полоса отряда под здоровьем: портрет, здоровье кольцом, патроны. */
	renderPartyBar() {
		const el = $('party-bar');
		el.innerHTML = this.party.map((st, i) => `<button class="pm" data-i="${i}"><span class="pm-face" style="--hp:100%"><img src="${this.icons[`merc_${st.id}`] ?? ''}" alt=""><i class="pm-cls cls-${MERCS[st.id].cls}">${CLASSES[MERCS[st.id].cls].short}</i></span><span class="pm-ammo"></span></button>`).join('');
		el.classList.toggle('hidden', !this.party.length);
		this.hudParty();
	},

	hudParty() {
		const el = $('party-bar');
		this.party.forEach((st, i) => {
			const b = el.children[i];
			if (!b) return;
			const D = MERCS[st.id];
			b.querySelector('.pm-face').style.setProperty('--hp', `${Math.max(0, (st.hp / D.hp) * 100).toFixed(0)}%`);
			// у медика — живчики в аптечке, у подрывника — гранаты
			b.querySelector('.pm-ammo').textContent = `${st.mag}+${st.ammo}${st.meds != null ? ` ✚${st.meds}` : ''}${st.nades != null ? ` ✱${st.nades}` : ''}`;
			b.classList.toggle('low', st.hp < D.hp * 0.3 || st.mag + st.ammo === 0);
		});
	},

	// ---------- Гранаты ----------

	/** Бросок гранаты: к ближайшим заражённым (до 14 м) или вперёд; взрыв через 2 с после броска. */
	throwGrenade() {
		const p = this.player;
		if (!p?.alive || this.paused || p.busy > 0 || p.equipping || this.state !== 'play') return;
		if (!(this.bag.grenade > 0)) { this.toast('Гранат нет — продаёт торговец', 'warn'); return; }
		this.bag.grenade--;
		const target = this.nearestEnemy(p.pos, 14);
		if (target) p.root.rotation.y = angleTo(p.pos, target.pos);
		const to = target ? target.pos.clone() : p.pos.clone().add(new THREE.Vector3(Math.sin(p.root.rotation.y), 0, Math.cos(p.root.rotation.y)).multiplyScalar(10));
		// оружие на миг убираем, в руке — граната; бросок сверху
		const held = p.gun(p.weapon), nade = makeGrenade();
		held.visible = false;
		p.hand.add(nade);
		p.play('Melee', { once: true, fade: 0.06, restart: true, timeScale: 1.25 });
		p.busy = 0.55;
		Sfx.swing();
		p.pending.push({ t: 0.27, fn: () => {
			const from = nade.getWorldPosition(new THREE.Vector3());
			nade.removeFromParent();
			this.launchGrenade(from, to);
		} });
		p.pending.push({ t: 0.5, fn: () => { held.visible = true; } });
		this.hud();
	},

	/** Полёт гранаты дугой; fuse — через сколько после броска взрыв (у героя — 2 с, у подрывника — выдержана). */
	launchGrenade(from, to, fuse = 2.0) {
		const g = makeGrenade();
		g.scale.setScalar(1.4);
		g.position.copy(from);
		scene.add(g);
		const d = Math.hypot(to.x - from.x, to.z - from.z), T = 0.5 + d / 22;
		const start = from.clone(), end = to.clone().setY(0.06);
		let t = 0;
		const spin = new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
		this.fx.push({ life: 3, update: (dt) => {
			t += dt; fuse -= dt;
			if (t < T) {
				const k = t / T;
				g.position.lerpVectors(start, end, k);
				g.position.y = start.y + (end.y - start.y) * k + Math.sin(Math.PI * k) * (1.2 + d * 0.12);
				g.rotation.x += spin.x * dt; g.rotation.y += spin.y * dt;
			}
			if (fuse <= 0) { this.explode(g.position.clone()); return false; }
			return true;
		}, dispose: () => scene.remove(g) });
	},

	/** Взрыв: осколки ранят всех в радиусе 6 м (и героя с наёмниками), шум на весь кластер. */
	explode(pos) {
		const R = 6;
		for (const e of this.enemies) {
			if (!e.alive) continue;
			const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
			if (d < R) e.damage(170 * (1 - d / R) ** 0.7, pos, 1.5 * (1 - d / R));
		}
		for (const a of [this.player, ...this.mercs]) {
			if (!a?.alive) continue;
			const d = Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z);
			if (d < R) a.hurt(80 * (1 - d / R), pos);
		}
		// соседние бочки с горючим рвутся следом — цепочкой
		for (const b of this.barrels) if (b.alive && Math.hypot(b.pos.x - pos.x, b.pos.z - pos.z) < R) b.damage(200, pos);
		this.noise(pos, 50);
		Sfx.explosion(this.ear(pos));
		const near = clamp01(1 - Math.hypot(pos.x - this.player.pos.x, pos.z - this.player.pos.z) / 25);
		this.shake = Math.min(1, this.shake + 0.4 + near * 0.6);
		flashLight.position.copy(pos).setY(1.2);
		flashLight.intensity = 160;
		flashLight.distance = 18;
		const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture('255,190,90'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
		fire.position.copy(pos).setY(0.8);
		scene.add(fire);
		this.fx.push({ life: 0.45, update(dt) { this.life -= dt; const k = 1 - this.life / 0.45; fire.scale.setScalar(1 + k * 5); fire.material.opacity = 1 - k; flashLight.intensity = 160 * (1 - k); return this.life > 0; }, dispose() { scene.remove(fire); fire.material.dispose(); flashLight.intensity = 0; flashLight.distance = 7; } });
		for (let i = 0; i < 9; i++) {
			const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(i % 3 ? '90,88,80' : '60,58,54'), transparent: true, opacity: 0.6, depthWrite: false }));
			sm.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.4 + Math.random(), (Math.random() - 0.5) * 2));
			sm.scale.setScalar(1.2 + Math.random());
			const v = new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
			scene.add(sm);
			this.fx.push({ life: 2.2, update(dt) { this.life -= dt; sm.position.addScaledVector(v, dt); sm.scale.multiplyScalar(1 + dt * 0.6); sm.material.opacity = 0.6 * this.life / 2.2; return this.life > 0; }, dispose() { scene.remove(sm); sm.material.dispose(); } });
		}
		for (let i = 0; i < 6; i++) this.impact(pos.clone().setY(0.1), false, 1.6);
		// ударная волна по земле — пыльное кольцо
		const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8ccb0, transparent: true, opacity: 0.55, depthWrite: false }));
		ring.position.set(pos.x, 0.08, pos.z);
		scene.add(ring);
		this.fx.push({ life: 0.4, update(dt) { this.life -= dt; const k = 1 - this.life / 0.4; ring.scale.setScalar(0.5 + k * R); ring.material.opacity = 0.55 * (1 - k); return this.life > 0; }, dispose() { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); } });
		// комья земли и обломки: летят дугой, падают, отскакивают и лежат, потом исчезают
		debrisGeo ??= new THREE.DodecahedronGeometry(0.09, 0);
		debrisMat ??= new THREE.MeshStandardMaterial({ color: 0x4a3f30, roughness: 1 });
		for (let i = 0; i < 14; i++) {
			const m = new THREE.Mesh(debrisGeo, debrisMat);
			m.position.copy(pos).setY(0.2);
			m.scale.setScalar(0.6 + Math.random() * 1.2);
			m.castShadow = true;
			const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
			const v = new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 5, Math.sin(a) * sp);
			const spin = (Math.random() - 0.5) * 20;
			scene.add(m);
			this.fx.push({ life: 3, update(dt) {
				this.life -= dt;
				if (v.lengthSq() > 0.01) {
					v.y -= 18 * dt;
					m.position.addScaledVector(v, dt);
					m.rotation.x += spin * dt; m.rotation.z += spin * 0.7 * dt;
					if (m.position.y < 0.05) { m.position.y = 0.05; v.y *= -0.3; v.x *= 0.5; v.z *= 0.5; if (Math.abs(v.y) < 0.6) v.set(0, 0, 0); }
				}
				if (this.life < 0.6) m.scale.multiplyScalar(1 - dt * 3);
				return this.life > 0;
			}, dispose() { scene.remove(m); } });
		}
		// выжженное пятно
		const scorch = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: softDotTexture('14,12,10'), transparent: true, opacity: 0.8, depthWrite: false }));
		scorch.rotation.x = -Math.PI / 2;
		scorch.position.set(pos.x, 0.04, pos.z);
		scene.add(scorch);
		this.fx.push({ life: 40, update(dt) { this.life -= dt; if (this.life < 5) scorch.material.opacity = 0.8 * this.life / 5; return this.life > 0; }, dispose() { scene.remove(scorch); scorch.geometry.dispose(); scorch.material.dispose(); } });
	},

	setPaused(on) {
		this.paused = on;
		// нажатия, сделанные при открытом окне, в игру не попадают
		this.input.pressed.clear();
		this.input.holding.clear();
	},

	/** Герой в полный рост с оружием — картинка для рюкзака (кэш по набору). */
	figure(gear, hold) {
		this.figures ??= {};
		const key = `${gear.melee}|${gear.gun}|${hold}`;
		if (!this.figures[key] && iconFactory) this.figures[key] = iconFactory.figure(assets.player, gear, hold);
		return this.figures[key];
	},

	decal(pos, size) {
		const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: bloodDecalTexture(Math.floor(Math.random() * 5)), transparent: true, depthWrite: false, roughness: 0.25 }));
		m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6;
		m.position.copy(pos).setY(0.035);
		m.scale.setScalar(0.2);
		scene.add(m);
		// лужа под телом растекается секунды три
		let t = 0;
		this.fx.push({ life: 40, mesh: m, update(dt) {
			this.life -= dt; t += dt;
			if (t < 4) m.scale.setScalar(0.2 + 0.8 * (1 - (1 - t / 4) ** 2));
			if (this.life < 5) m.material.opacity = this.life / 5;
			return this.life > 0;
		}, dispose() { scene.remove(m); } });
	},

	/**
	 * Брызги крови на земле: тёмная клякса с каплями, вытянутая по ходу полёта v (если задан).
	 * Копятся по ходу боя; самые старые исчезают, когда их больше 150.
	 */
	splat(pos, size = 0.25, v = null) {
		splatGeo ??= new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
		splatMats ??= [0, 1, 2, 3].map((i) => new THREE.MeshStandardMaterial({ map: splatterTexture(i), transparent: true, depthWrite: false, roughness: 0.22, polygonOffset: true, polygonOffsetFactor: -2 }));
		const m = new THREE.Mesh(splatGeo, splatMats[Math.floor(Math.random() * splatMats.length)]);
		m.position.set(pos.x, 0.03 + Math.random() * 0.004, pos.z);
		const speed = v ? Math.hypot(v.x, v.z) : 0;
		m.rotation.y = speed > 0.3 ? Math.atan2(-v.z, v.x) : Math.random() * Math.PI * 2; // +X текстуры — по ходу полёта
		const stretch = 1 + Math.min(1.2, speed * 0.25);
		m.scale.set(size * stretch * (0.8 + Math.random() * 0.4), 1, size * (0.7 + Math.random() * 0.4));
		m.renderOrder = 1;
		scene.add(m);
		const fx = { life: 60, update(dt) { this.life -= dt; if (this.life < 2) m.scale.multiplyScalar(1 - dt); return this.life > 0; }, dispose() { scene.remove(m); } };
		this.splats = (this.splats ?? []).filter((f) => f.life > 0);
		this.splats.push(fx);
		if (this.splats.length > 150) this.splats.shift().life = 0;
		this.fx.push(fx);
	},

	/**
	 * Обрубок (кость bone сжата): кровь бьёт толчками секунды полторы, летят ошмётки, на земле — пятна.
	 * dir — куда шёл удар, power — сила (голова — 1, рука — меньше).
	 */
	stump(bone, dir, power = 1) {
		const at = () => bone.getWorldPosition(new THREE.Vector3());
		chunkGeo ??= new THREE.IcosahedronGeometry(0.05, 0);
		chunkMat ??= new THREE.MeshStandardMaterial({ color: 0x5a0e0a, roughness: 0.45 });
		const p0 = at();
		for (let i = 0; i < Math.round(5 * power) + 2; i++) {
			const c = new THREE.Mesh(chunkGeo, chunkMat);
			c.position.copy(p0);
			c.scale.setScalar(0.5 + Math.random() * (0.8 + power));
			const v = new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3).addScaledVector(dir, 2 + Math.random() * 2);
			const spin = new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);
			scene.add(c);
			let landed = false;
			this.fx.push({ life: 8, update(dt) {
				this.life -= dt;
				if (!landed) {
					v.y -= 9.8 * dt;
					c.position.addScaledVector(v, dt);
					c.rotation.x += spin.x * dt; c.rotation.y += spin.y * dt;
					if (c.position.y < 0.03) { c.position.y = 0.03; landed = true; game.splat(c.position, 0.35 + Math.random() * 0.25, v); }
				}
				if (this.life < 1) c.scale.multiplyScalar(1 - dt * 2);
				return this.life > 0;
			}, dispose() { scene.remove(c); } });
		}
		this.blood(p0, Math.round(14 * power), dir);
		// фонтан из обрубка: толчки по 4 в секунду, слабеют
		let t = 0, next = 0;
		this.fx.push({ life: 1.6, update(dt) {
			this.life -= dt; t += dt;
			if (t >= next) { next += 0.25; game.blood(at(), Math.round(6 * power * (1 - t / 1.6)) + 1, tmpV2.set(0, 1.2, 0).addScaledVector(dir, 0.4)); }
			return this.life > 0;
		}, dispose() {} });
	},

	/** Брызги крови; dir — куда шёл удар: брызги летят больше в ту сторону. */
	blood(pos, n, dir = null) {
		bloodMat ??= new THREE.SpriteMaterial({ map: softDotTexture('92,6,5'), transparent: true, depthWrite: false });
		for (let i = 0; i < n; i++) {
			const s = new THREE.Sprite(bloodMat);
			s.position.copy(pos);
			s.scale.setScalar(0.07 + Math.random() * 0.12);
			const v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
			if (dir) v.addScaledVector(dir, 1.5 + Math.random() * 2.5);
			scene.add(s);
			this.fx.push({ life: 0.6, update(dt) {
				v.y -= 9 * dt; s.position.addScaledVector(v, dt); this.life -= dt;
				// капля долетела до земли — пятно
				if (s.position.y < 0.05) { this.life = 0; if (Math.random() < 0.3) game.splat(s.position, 0.16 + s.scale.x * 1.3, v); }
				return this.life > 0;
			}, dispose() { scene.remove(s); } });
		}
	},

	/** Вспышка у дула оружия gun (pos — дуло в мире, dir — куда смотрит ствол); size 0 — глушитель: ни пламени, ни света. */
	muzzleFlash(gun, pos, dir, size = 1) {
		if (size <= 0) return;
		flashes.fire(gun, size);
		flashLight.position.copy(pos).addScaledVector(dir, 0.2);
		flashLight.intensity = 30 * size;
		this.fx = this.fx.filter((f) => !f.flash);
		this.fx.push({ flash: true, life: 0.06, update(dt) { this.life -= dt; return this.life > 0; }, dispose() { flashLight.intensity = 0; } });
	},

	/**
	 * Подвижная часть оружия после выстрела (userData.action: затвор ПМ, рама автомата, цевьё помпы):
	 * резко назад, плавнее вперёд. locked — магазин пуст, затвор встаёт на задержку до перезарядки.
	 */
	cycleGun(gun, locked = false) {
		const a = gun.userData.action;
		if (!a) return;
		a.y0 ??= a.part.position.y;
		let t = -(a.delay ?? 0);
		this.fx = this.fx.filter((f) => f.gun !== gun);
		this.fx.push({ gun, life: 1, update(dt) {
			t += dt;
			const k = Math.max(0, t / a.dur);
			const off = k < 0.3 ? k / 0.3 : locked ? 1 : Math.max(0, 1 - (k - 0.3) / 0.7);
			a.part.position.y = a.y0 + a.travel * (t < 0 ? 0 : off);
			return k < 1;
		}, dispose() {} });
	},
	/** Затвор с задержки — на место (после перезарядки). */
	releaseGun(gun) {
		const a = gun?.userData.action;
		if (a?.y0 != null) a.part.position.y = a.y0;
	},

	/** Пыль из-под ног на бегу (на улице; в домах — нет). */
	dust(pos) {
		if (level.buildingAt(pos)) return;
		dustMat ??= new THREE.SpriteMaterial({ map: softDotTexture('170,150,120'), transparent: true, opacity: 0.3, depthWrite: false });
		const s = new THREE.Sprite(dustMat.clone());
		s.position.set(pos.x + (Math.random() - 0.5) * 0.3, 0.12, pos.z + (Math.random() - 0.5) * 0.3);
		s.scale.setScalar(0.3);
		scene.add(s);
		this.fx.push({ life: 0.6, update(dt) { this.life -= dt; s.scale.multiplyScalar(1 + dt * 1.8); s.position.y += dt * 0.25; s.material.opacity = 0.3 * this.life / 0.6; return this.life > 0; }, dispose() { scene.remove(s); s.material.dispose(); } });
	},

	/** Пороховой дымок у ствола: сизое облачко поднимается и тает. */
	smoke(pos, size = 1) {
		const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture('200,200,190'), transparent: true, opacity: 0.35, depthWrite: false }));
		s.position.copy(pos);
		s.scale.setScalar(0.25 * size);
		scene.add(s);
		this.fx.push({ life: 0.7, update(dt) { this.life -= dt; s.position.y += dt * 0.6; s.scale.multiplyScalar(1 + dt * 2.2); s.material.opacity = 0.35 * (this.life / 0.7); return this.life > 0; }, dispose() { scene.remove(s); s.material.dispose(); } });
	},

	/** Гильза: вылетает вправо-вверх из оружия, падает, отскакивает и полежит немного. kind: brass | shell. */
	casing(gun, kind) {
		casingGeo[kind] ??= kind === 'shell' ? new THREE.CylinderGeometry(0.011, 0.011, 0.065, 8) : new THREE.CylinderGeometry(0.0055, 0.0055, 0.024, 6);
		casingMat[kind] ??= new THREE.MeshStandardMaterial(kind === 'shell' ? { color: 0xa02a20, roughness: 0.5 } : { color: 0xc9a248, roughness: 0.3, metalness: 0.9 });
		const m = new THREE.Mesh(casingGeo[kind], casingMat[kind]);
		gun.updateMatrixWorld();
		m.position.copy(gun.localToWorld(new THREE.Vector3(0, kind === 'shell' ? -0.02 : -0.06, 0.09)));
		const right = new THREE.Vector3(-1, 0, 0).transformDirection(gun.matrixWorld); // правый бок оружия (+X хвата — левый)
		const v = right.multiplyScalar(kind === 'shell' ? 0.6 : 1.6 + Math.random()).add(new THREE.Vector3(0, kind === 'shell' ? 0.3 : 1.8 + Math.random(), 0));
		const spin = new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20);
		scene.add(m);
		this.casings = (this.casings ?? []).filter((c) => c.life > 0);
		const fx = { life: 6, update(dt) {
			this.life -= dt;
			if (v.lengthSq() > 0.01 || m.position.y > 0.012) {
				v.y -= 9.8 * dt;
				m.position.addScaledVector(v, dt);
				m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt; m.rotation.z += spin.z * dt;
				if (m.position.y < 0.012) { m.position.y = 0.012; v.set(v.x * 0.4, -v.y * 0.3, v.z * 0.4); spin.multiplyScalar(0.5); if (Math.abs(v.y) < 0.4) { v.set(0, 0, 0); m.rotation.x = Math.PI / 2; } }
			}
			return this.life > 0;
		}, dispose() { scene.remove(m); } };
		this.casings.push(fx);
		if (this.casings.length > 40) this.casings.shift().life = 0; // не копим сотни гильз
		this.fx.push(fx);
	},

	/** Куда долетит пуля из from по направлению (dx, dz): до первой стены или на землю в конце дальности. */
	bulletEnd(from, dx, dz, range) {
		const { N, blocked, cell } = level.nav;
		for (let t = 0.6; t < range; t += 0.25) {
			const x = from.x + dx * t, z = from.z + dz * t;
			const [gx, gz] = cell(x, z);
			if (gx < 0 || gz < 0 || gx >= N || gz >= N) break;
			if (!blocked[gz * N + gx]) continue;
			// клетка занята (с запасом под радиус): уточняем точку по настоящим коллайдерам
			for (let k = t; k < t + 0.9; k += 0.05) {
				const c = level.nav.colliderAt(from.x + dx * k, from.z + dz * k);
				if (c) return { pos: new THREE.Vector3(from.x + dx * k, from.y, from.z + dz * k), wall: true, collider: c };
			}
		}
		return { pos: new THREE.Vector3(from.x + dx * range, 0.03, from.z + dz * range), wall: false };
	},

	/**
	 * Бочка, в которую стоит выстрелить: в пределах дальности и на виду, у неё толпа (топтун и рубер — за двоих),
	 * а стрелок дальше 5 м (взрыв сам не заденет). Иначе null.
	 */
	barrelTarget(from, range) {
		let best = null, bd = range;
		for (const b of this.barrels) {
			const d = Math.hypot(b.pos.x - from.x, b.pos.z - from.z);
			if (!b.alive || d > bd || d < 5) continue;
			let crowd = 0;
			for (const e of this.enemies) if (e.alive && Math.hypot(e.pos.x - b.pos.x, e.pos.z - b.pos.z) < 3.2) crowd += e.type === 'runner' ? 1 : 2;
			// на виду — до точки чуть не доходя бочки (сама бочка занимает клетки сетки)
			const k = (d - 0.9) / d, near = { x: from.x + (b.pos.x - from.x) * k, z: from.z + (b.pos.z - from.z) * k };
			if (crowd >= 2 && lineOfSight(from, near)) { best = b; bd = d; }
		}
		return best;
	},

	/** Пуля упёрлась в препятствие: бочка с горючим получает урон, на стене дома остаётся след. */
	hitObstacle(hit, dmg, from) {
		const c = hit.collider;
		if (!c) return;
		const barrel = this.barrels.find((b) => b.collider === c);
		if (barrel) barrel.damage(dmg, from);
		else if (c.wall) this.bulletHole(hit.pos, c);
	},

	/** След пули на стене: точка на грани коллайдера стены, обращённый наружу (последние 120 следов). */
	bulletHole(p, c) {
		const dx = p.x - c.x, dz = p.z - c.z, lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
		let nx = 0, nz = 0, px = lx, pz = lz;
		if (Math.abs(lx) / c.hx > Math.abs(lz) / c.hz) { nx = Math.sign(lx) || 1; px = nx * (c.hx + 0.004); } else { nz = Math.sign(lz) || 1; pz = nz * (c.hz + 0.004); }
		const wx = c.x + px * c.c + pz * c.s, wz = c.z - px * c.s + pz * c.c; // из системы коллайдера в мир
		const nwx = nx * c.c + nz * c.s, nwz = -nx * c.s + nz * c.c;
		holeGeo ??= new THREE.PlaneGeometry(0.16, 0.16);
		holeMat ??= new THREE.MeshStandardMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
		const m = new THREE.Mesh(holeGeo, holeMat);
		const y = Math.max(0.3, p.y + (Math.random() - 0.5) * 0.16);
		m.position.set(wx, y, wz);
		m.lookAt(wx + nwx, y, wz + nwz);
		m.rotateZ(Math.random() * Math.PI * 2);
		m.scale.setScalar(0.8 + Math.random() * 0.5);
		scene.add(m);
		const fx = { mesh: m, life: 120, update(dt) { this.life -= dt; return this.life > 0; }, dispose() { scene.remove(m); } };
		this.holes = (this.holes ?? []).filter((f) => f.life > 0);
		this.holes.push(fx);
		if (this.holes.length > 120) this.holes.shift().life = 0;
		this.fx.push(fx);
	},

	/** Попадание пули мимо цели: в стену — искры и крошка, в землю — фонтанчик пыли. */
	impact(pos, wall, size = 1) {
		const mat = new THREE.SpriteMaterial({ map: softDotTexture(wall ? '230,220,190' : '150,130,100'), transparent: true, opacity: 0.6, depthWrite: false });
		for (let i = 0; i < 4; i++) {
			const s = new THREE.Sprite(mat);
			s.position.copy(pos);
			s.scale.setScalar((0.12 + Math.random() * 0.12) * size);
			const v = new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 1.4, (Math.random() - 0.5) * 1.5);
			scene.add(s);
			this.fx.push({ life: 0.5, update(dt) { this.life -= dt; v.y -= 4 * dt; s.position.addScaledVector(v, dt); s.scale.multiplyScalar(1 + dt * 1.5); mat.opacity = Math.max(0, this.life); return this.life > 0; }, dispose() { scene.remove(s); } });
		}
		if (wall) {
			const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture('255,220,140'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
			spark.position.copy(pos);
			spark.scale.setScalar(0.35 * size);
			scene.add(spark);
			this.fx.push({ life: 0.08, update(dt) { this.life -= dt; return this.life > 0; }, dispose() { scene.remove(spark); spark.material.dispose(); } });
		}
	},

	tracer(from, to) {
		const g = new THREE.BufferGeometry().setFromPoints([from, to]);
		const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8 }));
		scene.add(l);
		this.fx.push({ life: 0.08, update(dt) { this.life -= dt; l.material.opacity = this.life * 10; return this.life > 0; }, dispose() { scene.remove(l); g.dispose(); l.material.dispose(); } });
	},

	/** Перезагрузка кластера, пока герой внутри. */
	reloadDeath() {
		$('flash').classList.remove('show'); void $('flash').offsetWidth; $('flash').classList.add('show');
		Sfx.rumble(2);
		this.player.die('reload');
	},

	/**
	 * Признаки скорой перезагрузки (последняя минута): кислый запах, муть сгущается и желтеет,
	 * по краям экрана — болезненная дымка, гул.
	 */
	reloadFx(left) {
		const k = clamp01(1 - left / WARN);
		this.sourK = k;
		scene.fog.near = THREE.MathUtils.lerp(38, 5, k ** 0.8);
		scene.fog.far = THREE.MathUtils.lerp(95, 30, k);
		scene.fog.color.copy(FOG).lerp(FOG_SOUR, k);
		scene.background.copy(SKY).lerp(SKY_SOUR, k);
		$('sour').style.opacity = (k * 0.75).toFixed(3);
	},

	updateCluster(dt) {
		const reloaded = advance(this.world, dt);
		if (NODES[this.loc].kind !== 'cluster') return;
		if (reloaded.includes(this.loc)) { this.reloadDeath(); return; }
		const left = timeLeft(this.world, this.loc);
		this.reloadFx(left);
		const stage = left < 10 ? 3 : left < 30 ? 2 : left < WARN ? 1 : 0;
		if (stage > this.warnStage) {
			this.warnStage = stage;
			if (stage === 1) this.banner('Кислый запах', 'Кластер скоро перезагрузится — уходи к выходу!');
			if (stage === 2) { this.toast('Муть сгущается — меньше 30 секунд!', 'warn'); Sfx.rumble(0.6); Sfx.thunder(0.7); }
			if (stage === 3) { this.toast('Сейчас перезагрузится!', 'warn'); Sfx.rumble(1.2); Sfx.thunder(1); }
		}
		if (stage >= 2) {
			this.rumbleT = (this.rumbleT ?? 0) - dt;
			if (this.rumbleT <= 0) { this.rumbleT = stage === 3 ? 1.2 : 3; Sfx.rumble(stage === 3 ? 1 : 0.5); }
		}
	},

	/** Переход к выходу из локации: открыть карту, когда герой зашёл в зону выхода. */
	updateExit() {
		const p = this.player;
		if (!p.alive) return;
		// у указателя на дороге — подсказка, куда ведёт; у края кластера (в мути) — ближайший выход
		const ex = level.exitAt(p.pos) ?? (level.atEdge(p.pos) ? level.nearestExit(p.pos) ?? {} : null);
		if (ex && this.exitArmed && !p.equipping) {
			this.exitArmed = false;
			this.cancelSearch();
			this.worldMap.open(ex.to ?? null);
		} else if (!level.exitAt(p.pos, 1.2) && !level.atEdge(p.pos, 1.2)) this.exitArmed = true;
		// подошёл к мути впервые за визит — подсказка, что дальше выход
		if (!this.edgeHint && level.atEdge(p.pos, 5)) { this.edgeHint = true; this.toast('Впереди муть — дальше выход на карту Улья'); }
	},

	over(reason) {
		document.body.classList.remove('low-hp');
		this.state = 'dead';
		this.inventory.close();
		this.trade.close();
		this.worldMap.close();
		this.locationMap.close();
		this.partyWindow.close();
		// при перезагрузке кластера пропадают и наёмники, что были с героем; съели — они вытащат героя
		const lostMercs = reason === 'reload' ? this.party.map((m) => MERCS[m.id].name) : [];
		if (reason === 'reload') this.roster = this.roster.filter((m) => !m.out); // оставленные в стабе живы
		const lost = CONSUMABLES.filter((k) => (this.bag[k] ?? 0) > 0).map((k) => `${ITEMS[k].name[0].toLowerCase()}${ITEMS[k].name.slice(1)} ×${this.bag[k]}`);
		clearTimeout(this.overTimer);
		this.overTimer = setTimeout(() => {
			$('go-title').textContent = reason === 'reload' ? 'Кластер перезагрузился' : 'Тебя сожрали';
			$('go-sub').textContent = reason === 'reload' ? 'Ты не успел уйти: Улей подменил кластер свежей копией вместе с тобой.' : 'Заражённые оказались быстрее.';
			$('go-stats').innerHTML = `Убито: <b>${this.kills}</b>${lost.length ? `<br>Пропадёт из рюкзака: ${lost.join(', ')}` : ''}${lostMercs.length ? `<br>Наёмники остались в кластере: ${lostMercs.join(', ')}` : ''}`;
			$('gameover').classList.remove('hidden');
			$('hud').classList.add('hidden');
			$('search').classList.add('hidden');
		}, reason === 'reload' ? 1400 : 2200);
	},

	hudT: 0,
	hudThrottled() { if (this.time - this.hudT > 0.25) this.hud(); },
	hud() {
		const p = this.player;
		if (!p) return;
		this.hudT = this.time;
		$('hp-fill').style.width = `${(p.hp / p.maxHp) * 100}%`;
		const hpk = clamp01(p.hp / p.maxHp);
		$('avatar-wrap').style.setProperty('--hp', `${(hpk * 100).toFixed(1)}%`);
		$('avatar-wrap').classList.toggle('low', hpk < 0.3 && p.alive);
		$('hp-text').textContent = p.maxHp > 100 && p.maxHp < 1000 ? `${Math.ceil(p.hp)} / ${p.maxHp}` : Math.ceil(p.hp);
		$('spores').textContent = this.bag.spore ?? 0;
		$('peas').textContent = this.bag.peas ?? 0;
		$('kills').textContent = this.kills;
		$('loc-name').textContent = NODES[this.loc].short;
		this.hudTimer();
		const W = p.W;
		$('weapon-name').textContent = W.name;
		// патроны: в магазине / в запасе
		const ammo = $('ammo');
		if (W.ammo) {
			const spare = this.bag[W.ammo] ?? 0, empty = p.ammo === 0 && spare === 0;
			// счётчик вздрагивает на каждый выстрел
			if (this.shownAmmo !== undefined && p.ammo < this.shownAmmo && this.shownWeapon === p.weapon) { ammo.classList.remove('pulse'); void ammo.offsetWidth; ammo.classList.add('pulse'); }
			this.shownAmmo = p.ammo; this.shownWeapon = p.weapon;
			ammo.innerHTML = p.reloading > 0 ? 'перезарядка…' : empty ? '<b>0</b> · нет патронов' : `<b>${p.ammo}</b> / ${spare}`;
			ammo.classList.toggle('empty', empty);
		} else if (W.durability) {
			// у топора не патроны, а прочность: столько ударов ещё выдержит
			const left = this.kit.wear[p.weapon] ?? W.durability;
			ammo.innerHTML = `прочность <b>${left}</b>/${W.durability}`;
			ammo.classList.toggle('empty', left <= W.durability * 0.2);
		} else {
			ammo.innerHTML = 'без оружия';
			ammo.classList.add('empty');
		}
		const zh = this.bag.zhivchik ?? 0;
		$('heal-count').textContent = zh;
		$('btn-heal').classList.toggle('off', zh === 0);
		const gr = this.bag.grenade ?? 0;
		$('grenade-count').textContent = gr;
		$('btn-grenade').classList.toggle('off', gr === 0);
		this.hudParty();
		// иконки меняем только при смене оружия: перерисовка кнопки под пальцем теряет отпускание
		const other = p.hold === 'melee' ? this.kit.gear.gun : this.kit.gear.melee;
		const key = `${p.weapon}|${other}`;
		const icon = (w) => (w && this.icons[w] ? `<img src="${this.icons[w]}" alt="">` : '');
		if (this.icons.weapon !== key) {
			this.icons.weapon = key;
			$('btn-weapon').innerHTML = icon(other);
			$('btn-weapon').classList.toggle('off', !other);
			$('btn-attack').innerHTML = `${icon(p.weapon) || '✊'}<span class="badge" id="attack-ammo"></span><span class="wear" id="attack-wear"><i></i></span>`;
			if (this.icons[p.weapon]) $('weapon-icon').src = this.icons[p.weapon];
		}
		const badge = $('attack-ammo');
		badge.textContent = W.ammo ? p.ammo : '';
		badge.style.display = W.ammo ? '' : 'none';
		badge.classList.toggle('empty', p.ammo === 0);
		// полоска прочности топора на кнопке атаки
		const wear = $('attack-wear'), frac = W.durability ? (this.kit.wear[p.weapon] ?? W.durability) / W.durability : 0;
		wear.style.display = W.durability ? '' : 'none';
		wear.firstChild.style.width = `${frac * 100}%`;
		wear.classList.toggle('low', frac <= 0.2);
		$('btn-reload').classList.toggle('off', !W.ammo);
	},

	/** Таймер перезагрузки в шапке (в стабе — «безопасно»). */
	hudTimer() {
		const el = $('loc-timer');
		if (NODES[this.loc].kind !== 'cluster') { el.textContent = 'безопасно'; el.className = 'safe'; return; }
		const left = timeLeft(this.world, this.loc);
		const text = clock(left);
		if (el.textContent !== text) el.textContent = text;
		el.className = left < 30 ? 'danger' : left < WARN ? 'warn' : '';
	},
};
window.__game = game;

// ---------- Кадр ----------
const clock3 = new THREE.Clock();
const camOffset = new THREE.Vector3();
const camTarget = new THREE.Vector3();
// ?sim=N — N шагов логики по 1/30 с на кадр (для автотестов на медленном программном рендере)
const SIM_STEPS = +(new URLSearchParams(location.search).get('sim') || 0);
// Замер производительности: FPS, время логики и отрисовки (CPU), вызовы отрисовки, треугольники.
// Показывается по ?fps=1 или галочке в меню. На слабом телефоне разрешение снижается само.
const perf = { fps: 60, logic: 0, draw: 0, calls: 0, tris: 0, low: 0, high: 0, scale: 1, shown: false, t: 0 };
const BASE_RATIO = renderer.getPixelRatio();
game.perf = perf;
/** Для отладки и тестов: сколько всего в видеопамяти. */
game.gpuInfo = () => ({ ...renderer.info.memory, programs: renderer.info.programs?.length ?? 0, ratio: renderer.getPixelRatio() });
function frame() {
	const raw = clock3.getDelta(), real = Math.min(0.05, raw);
	const t0 = performance.now();
	if (game.state !== 'menu' && SIM_STEPS) {
		for (let i = 0; i < SIM_STEPS; i++) update(1 / 30);
	} else {
		update(real);
	}
	const t1 = performance.now();
	post.render(real);
	const t2 = performance.now();
	const k = 0.08;
	perf.fps += ((raw > 0 ? 1 / raw : 60) - perf.fps) * k;
	perf.logic += (t1 - t0 - perf.logic) * k;
	perf.draw += (t2 - t1 - perf.draw) * k;
	perf.calls = renderer.info.render.calls;
	perf.tris = renderer.info.render.triangles;
	adaptResolution(raw);
	if (perf.shown && (perf.t += raw) > 0.5) {
		perf.t = 0;
		$('perf').textContent = `${Math.round(perf.fps)} FPS · логика ${perf.logic.toFixed(1)} мс · кадр ${perf.draw.toFixed(1)} мс · ${perf.calls} вызовов · ${(perf.tris / 1000).toFixed(0)}k треуг. · ×${renderer.getPixelRatio().toFixed(2)}`;
	}
}

/** Динамическое разрешение: держим кадр плавным, снижая чёткость, если FPS проседает. */
function adaptResolution(raw) {
	if (SIM_STEPS || game.state !== 'play' || game.paused || raw > 0.25) return;
	if (perf.fps < 34) { perf.low += raw; perf.high = 0; } else if (perf.fps > 56) { perf.high += raw; perf.low = 0; } else { perf.low = perf.high = 0; }
	let r = renderer.getPixelRatio();
	// слабая видеокарта: сначала отключаем самое дорогое — затенение в углах, потом снижаем чёткость
	if (perf.low > 2.5 && post.passes.ao?.enabled) { post.passes.ao.enabled = false; perf.low = 0; return; }
	if (perf.low > 2.5 && r > 0.75) r = Math.max(0.75, r - 0.25);
	else if (perf.high > 6 && r < BASE_RATIO) r = Math.min(BASE_RATIO, r + 0.25);
	else return;
	perf.low = perf.high = 0;
	renderer.setPixelRatio(r);
	renderer.setSize(view.w, view.h);
	post.setSize(view.w, view.h);
}

function update(dt) {
	if (game.state === 'menu') {
		// облёт локации на фоне меню
		const t = performance.now() / 1000 * 0.05;
		camera.position.set(Math.sin(t) * 38, 26, Math.cos(t) * 38);
		camera.lookAt(0, 0, 0);
		sun.position.set(25, 40, 15); sun.target.position.set(0, 0, 0);
		level.update(dt, performance.now() / 1000);
		spores.update(dt, camTarget.set(0, 0, 0), performance.now() / 1000);
		return;
	}
	const input = game.input;
	const windows = [game.inventory, game.trade, game.worldMap, game.locationMap, game.partyWindow];
	if (input.consume('inventory') && game.state === 'play' && !windows.slice(1).some((w) => w.isOpen)) game.inventory.toggle();
	if (input.consume('map') && game.state === 'play' && (game.locationMap.isOpen || !game.paused)) game.locationMap.toggle();
	if (input.consume('escape')) for (const w of windows) w.close();
	if (game.paused || game.state === 'travel') return; // открыто окно или идём по дороге
	game.time += dt;
	if (game.state === 'play') {
		if (input.consume('heal')) game.drink();
		if (input.consume('grenade')) game.throwGrenade();
		if (input.consume('search')) game.act();
		if (input.consume('switch')) game.player.switchWeapon();
		if (input.consume('reload')) game.player.reload();
	}
	game.player.update(dt, input); // там же спуск: тап — один выстрел, удержание — серия
	// кольцо перезарядки на кнопке ⟳
	const rl = game.player.reloading > 0 ? 1 - game.player.reloading / game.player.W.reload : 0;
	if (rl !== game.shownReload) { game.shownReload = rl; $('btn-reload').style.setProperty('--p', `${(rl * 100).toFixed(1)}%`); $('btn-reload').classList.toggle('busy', rl > 0); }
	if (game.state === 'play') {
		game.updateSearch(dt, input);
		game.updateCluster(dt);
		game.updateExit();
		game.minimap.update(dt, game.player);
		game.hudTimerT = (game.hudTimerT ?? 0) - dt;
		if (game.hudTimerT <= 0) {
			game.hudTimerT = 0.25;
			game.hudTimer();
			// фон: ветер над кластером (в стабе тише), в доме — глуше
			Sfx.ambient('wind', NODES[game.loc].kind === 'cluster' ? 0.22 : 0.1);
			Sfx.indoor(!!level.buildingAt(game.player.pos));
			// мало здоровья: экран тускнеет, края пульсируют, слышно сердце
			const low = game.player.alive && game.player.hp < game.player.maxHp * 0.3;
			document.body.classList.toggle('low-hp', low);
			if (low && (game.heartT = (game.heartT ?? 0) - 0.25) <= 0) { game.heartT = 0.9; Sfx.heartbeat(); }
		}
	}

	game.flowTimer -= dt;
	if (game.flowTimer <= 0 && game.enemies.length) { game.updateFlow(); game.flowTimer = 0.3; }
	game.enemies = game.enemies.filter((e) => { const keep = e.update(dt); if (!keep) e.dispose(); return keep; });
	for (const n of game.npcs) n.update(dt);
	game.mercs = game.mercs.filter((m) => { const keep = m.update(dt); if (!keep) m.dispose(); return keep; });

	// подбор предметов в рюкзак
	for (const pk of game.pickups) {
		pk.t += dt;
		if (pk.ground) pk.glow.material.opacity = 0.35 + 0.25 * Math.sin(pk.t * 3);
		else {
			pk.mesh.position.y = 0.3 + Math.sin(pk.t * 3) * 0.08;
			pk.mesh.rotation.y += dt * 1.5;
		}
		if (game.player.alive && Math.hypot(pk.mesh.position.x - game.player.pos.x, pk.mesh.position.z - game.player.pos.z) < 1.3) {
			pk.taken = true;
			scene.remove(pk.mesh);
			game.take(pk.kind, pk.value);
		}
	}
	game.pickups = game.pickups.filter((p) => !p.taken);
	game.fx = game.fx.filter((f) => { const keep = f.update(dt); if (!keep) f.dispose(); return keep; });
	flashes.update(dt);
	level.update(dt, game.time);
	spores.update(dt, game.player.pos, game.time, game.sourK ?? 0);
	level.occlude(game.player.pos);

	// камера сверху под углом, как в LDoE
	const p = game.player.pos;
	const portrait = camera.aspect < 1;
	camOffset.set(0, portrait ? 16 : 11.5, portrait ? 10.5 : 8.5).multiplyScalar(game.zoom ?? 1);
	camTarget.lerp(tmpV.copy(p).setY(0.8), 1 - Math.exp(-dt * 6));
	camera.position.copy(camTarget).add(camOffset);
	if (game.shake > 0) {
		game.shake = Math.max(0, game.shake - dt * 2.5);
		camera.position.x += (Math.random() - 0.5) * game.shake * 0.4;
		camera.position.z += (Math.random() - 0.5) * game.shake * 0.4;
	}
	camera.lookAt(camTarget.x, camTarget.y - 0.6, camTarget.z + 0.8);
	sun.position.set(p.x + 22, 27, p.z + 13);
	sun.target.position.set(p.x, 0, p.z);
	// крыша дома, где герой, исчезает; здания между камерой и героем — полупрозрачные
	level.updateView(p, camera.position, dt);
	$('hurt').style.opacity = Math.max(0, parseFloat($('hurt').style.opacity || 0) - dt * 1.5);
}

game.toast = (text, kind = '') => {
	const t = document.createElement('div');
	t.className = `toast ${kind}`;
	t.textContent = text;
	$('toasts').appendChild(t);
	setTimeout(() => t.remove(), 1600);
};

game.post = post;
game.inventory = new Inventory(game);
game.trade = new Trade(game);
game.worldMap = new WorldMap(game);
game.minimap = new Minimap(game);
game.partyWindow = new PartyWindow(game);
$('party-bar').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (game.state === 'play' && !game.paused) game.partyWindow.open({ hiring: game.nearStation()?.id === 'mercs' }); });
game.locationMap = new LocationMap(game);
$('btn-inv').addEventListener('click', (e) => { e.currentTarget.blur(); if (game.state === 'play') game.inventory.toggle(); });
$('btn-map').addEventListener('click', (e) => { e.currentTarget.blur(); if (game.state === 'play' && !game.paused) game.locationMap.open(); });
$('minimap').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (game.state === 'play' && !game.paused) game.locationMap.open(); });
$('search').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); game.act(); });
for (const id of ['btn-inv', 'btn-map']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());
// сохраняем, когда вкладку прячут (телефон заблокировали, переключились)
document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });

// снимаем фокус с кнопки, иначе пробел (атака) нажимает её снова и перезапускает игру
// на телефоне — полноэкранный горизонтальный режим (нужно нажатие пользователя)
const press = (id, fn) => { $(id).onclick = (e) => { e.currentTarget.blur(); goLandscape(); fn(); }; };
// настройки в меню: качество графики (применяется перезапуском страницы) и счётчик FPS
$('opt-quality').value = prefs.quality ?? 'auto';
$('opt-quality').onchange = (e) => { prefs.quality = e.target.value; savePrefs(); location.reload(); };
perf.shown = params.get('fps') === '1' || !!prefs.fps;
$('opt-fps').checked = perf.shown;
$('perf').classList.toggle('hidden', !perf.shown);
$('opt-fps').onchange = (e) => { prefs.fps = perf.shown = e.target.checked; savePrefs(); $('perf').classList.toggle('hidden', !perf.shown); };
press('btn-new', () => game.newGame());
press('btn-continue', () => game.continueGame());
press('btn-respawn', () => game.respawn());
boot().catch((e) => { console.error(e); $('loadtext').textContent = `Ошибка загрузки: ${e.message}`; });
