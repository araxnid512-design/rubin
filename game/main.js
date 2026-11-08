// «Улей. Кластер-17» — игра в духе Last Day on Earth по мотивам вселенной «Стикс».
// Вид сверху. Иммунный ходит по кластерам Улья: они перезагружаются каждые 10–12 минут вместе со всем,
// что внутри, — надо успеть обыскать дома и уйти. Между кластерами — карта мира, в стабе «Полис» —
// торговец (оружие, патроны, живчики за спораны) и лекарь.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildLevel, resolveCollisions, PLAY } from './level.js';
import { rollHorde } from './horde.js';
import { tickHorde, hordeBroken, hordeText } from './migrant.js';
import { planRaid, greedCheck, raidSize, RAID_POWER, RAID_TIME, MASSACRE } from './raids.js';
import { QuestWindow, QUEST_ACTIVE, questProgress, questReady, questText, refreshQuests, rewardText } from './quests.js';
import { EXT_GUNS, EXT_AIM, EXT_ACCURACY, EXT_DAMAGE, EXT_ARMOR, EXT_HP, CMD_HP, CMD_ARMOR, CMD_GUN, EXT_DROP_AMMO, EXT_DROP_SPORE, EXT_DROP_MED, EXT_DROP_NADE, EXT_DROP_GUN, tickExt, extText } from './ext.js';
import { MUR_GUNS, MUR_AIM, MUR_ACCURACY, MUR_DAMAGE, MUR_SHOOTERS, MUR_TURN, MUR_REST, LEAVE_BEFORE, tickMurs, storeLoot, hireMurs, BOSS_HP, BOSS_ARMOR, BOSS_GUN, MUR_NADE_SHARE, MUR_NADE_GAP, MUR_FLANK_GAP, MUR_DROP_AMMO, MUR_DROP_SPORE, MUR_REP, CAMP_GRUDGE, STANCE, murStance, murOffend } from './murs.js';
import { setAnisotropy, softDotTexture } from './textures.js';
import { createMarks } from './marks.js';
import { createFire } from './dressing.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { view, onResize, goLandscape } from './screen.js';
import { WEAPONS, AMMO, MOUNTS, CLIPS, EQUIP, makeGrenade, REMOVED, realId } from './weapons.js';
import { loadTripoWeapons } from './tripo-weapons.js';
import { gunStats, decorateGun, addMod, cantMod, MODS, ModsWindow } from './mods.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ITEMS, plural, makeItemMesh, GLOW, CONSUMABLES, RESOURCES } from './items.js';
import { WORK, RECIPES, CAR, MARKETS, REFUGEE_PRICE, WAGE, normalizeEconomy, tickEconomy, sendCaravan, newPerson, peopleCap, workersOn, idlePeople, priceOf, sellValue, buyCost, powered, rollResources } from './economy.js';
import { CraftWindow } from './craft.js';
import { createIconFactory } from './icons.js';
import { leftHandIK, handGrasp } from './hand-ik.js';
import { loadEnvProps } from './env-props.js';
import { createSpores } from './atmosphere.js';
import { drawPlan, Minimap, LocationMap } from './minimap.js';
import { createPost } from './post.js';
import { createMuzzleFlashes } from './muzzle.js';
import { createParticles, createChunks, rgb } from './particles.js';
import { OFFLINE } from './assets.js';
import { clothVariants, dressZombie, bodyVariation } from './variety.js';
import { MERCS, CLASSES, MAX_PARTY, ROOM_BEDS, BASE_BEDS, MERC_HEAL, newMerc, PartyWindow, BASE_POSTS, BASE_POSTS_BARRACKS, TRIP_WORK, resolveTrip, RANKS, RANK_BONUS, XP_KILL, XP_SORTIE, XP_TRIP, rankOf, mercMaxHp, fullAmmo, KIT_FULL } from './mercs.js';
import { Inventory } from './inventory.js';
import { Trade, PEA_RATE, PEARL_PRICE, sellPrice, SELLABLE, packOf } from './trade.js';
import { BUILDINGS, raid as raidBase, cantBuy, build as buildOnBase, cantUpgrade, upgrade as upgradeOnBase, level as baseLevel, tickBase, collect as collectStock, perks as basePerks, defense as baseDefense, plunder as plunderBase } from './base.js';
import { TerminalWindow, stockText } from './terminal.js';
import { StashWindow, newStash, normalizeStash, CURRENCY, STORABLE } from './stash.js';
import { IntelWindow, INTEL_PRICE, TOPICS, intelText, topicText } from './intel.js';
import { BUILD } from './version.js';
import { WorldMap } from './worldmap.js';
import { NODES, WARN, RAGE, newWorld, normalizeWorld, advance, timeLeft, travelTime, pathTime, shortestPath, travelCost, clock, approx, saveGame, loadGame, clearSave } from './world.js';
import { EQUIP_TIMES, HERO_GAIT, HERO_GAIT8, DIRS8, DIR_SPEED } from '../src/hero-animations.js';
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
renderer.toneMappingExposure = 1.16;
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
// капли крови, крошка, пыль, дымок — одним мешем на все (game/particles.js), а не спрайтом на каждую
const particles = createParticles(scene, camera, QUALITY === 'low' ? 500 : 900);
// ошмётки при расчленении и комья земли от взрыва — тоже по одному мешу на все (раньше — меш на каждый кусок)
const gore = createChunks(scene, new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ color: 0x5a0e0a, roughness: 0.45 }), 160);
const debris = createChunks(scene, new THREE.DodecahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ color: 0x4a3f30, roughness: 1 }), 120);
// споры в воздухе (на низком качестве — меньше)
const spores = createSpores(scene, { count: QUALITY === 'low' ? 120 : 260 });
// следы боя — кровь, дырки от пуль, гарь (game/marks.js): держатся до перезагрузки кластера
const marks = createMarks(scene);

// ---------- Загрузка ----------
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); // модели оружия сжаты meshopt (scripts/shrink-weapons.mjs)
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
	progress(0.02, 'Загружаем технику и мебель…');
	await frameWait();
	// модели предметов — до сборки локации: на их места строитель ставит метки (game/env-props.js); не загрузились —
	// предметы будут процедурными, игра идёт
	try { await loadEnvProps(loadModel); } catch (e) { console.warn('модели предметов не загрузились', e); }
	progress(0.05, 'Строим кластер…');
	await frameWait();
	level = buildLevel(scene, { quality: QUALITY, id: saved?.world?.at ?? 'zarechny', base: saved?.world?.base, variant: saved?.world?.clusters?.[saved?.world?.at]?.reloads ?? 0 });
	game.level = level;
	game.planLevel();
	progress(0.35, 'Загружаем иммунного…');
	const player = await loadModel('player');
	// заражённые — модели Tripo по картинкам пользователя с клипами Tripo (scripts/build-zombies.mjs): пустыш (бегун),
	// лотерейщик (часть бегунов), топтун, рубер; не загрузилась модель — старая процедурная (runner/stomper/ruber.glb)
	const tripoZ = async (name, old, text, p) => {
		progress(p, text);
		try { return zombieModel(await loadModel(name)); } catch (e) { console.warn(`модель ${name} не загрузилась — старая`, e); return old && loadModel(old); }
	};
	const runner = await tripoZ('z_pustysh', 'runner', 'Загружаем бегунов…', 0.55);
	const lottery = await tripoZ('z_lottery', null, 'Загружаем лотерейщиков…', 0.65);
	const stomper = await tripoZ('z_stomper', 'stomper', 'Загружаем топтунов…', 0.75);
	const ruber = await tripoZ('z_ruber', 'ruber', 'Загружаем руберов…', 0.83);
	assets = { player, runner, lottery: lottery ?? runner, stomper, ruber };
	progress(0.86, 'Загружаем оружие…');
	await loadTripoWeapons(loadModel, Object.keys(WEAPONS).filter((id) => id !== 'fists' && !WEAPONS[id].heavy)); // у тяжёлого оружия моделей Tripo нет
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

/**
 * Открытые ссылки на скачиваемую версию и приложение для Android (релиз «game» на GitHub, обновляется сам —
 * .github/workflows/offline-release.yml). В приложении (window.__APK) обновление — новый APK.
 */
const APK = !!window.__APK;
/** Тот же файл, открытый на сайте игры (araxnid512-design.github.io/rubin/ulei/play/): всегда последняя версия. */
const SITE = OFFLINE && !APK && /^https?:$/.test(location.protocol);
const SITE_PAGE = 'https://araxnid512-design.github.io/rubin/ulei/';
const RELEASE = 'https://github.com/araxnid512-design/rubin/releases/download/game/';
const PUBLIC_FILE = APK ? 'ulei-cluster17.apk' : 'ulei-cluster17.html';
const PUBLIC_DOWNLOAD = RELEASE + PUBLIC_FILE;
const publicLink = (text) => `<a href="${PUBLIC_DOWNLOAD}" target="_blank" rel="noopener">${text}</a>`;
/** Когда собрана версия: «30 октября 2026 г., 15:31» — по часам того, кто играет. */
const builtAt = (t) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const VERSION = `${builtAt(BUILD.time)} · ${BUILD.sha}`;

/**
 * Скачанная версия сверяет себя со свежим файлом в релизе «game» на GitHub (api.github.com отвечает и странице
 * с диска). Файл там новее этой сборки — в меню кнопка «Вышла новая версия». Нет сети — молча ничего.
 */
async function checkUpdate() {
	try {
		const r = await fetch('https://api.github.com/repos/araxnid512-design/rubin/releases/tags/game', { cache: 'no-store' });
		if (!r.ok) return;
		const a = (await r.json()).assets?.find((x) => x.name === PUBLIC_FILE);
		// своя сборка выкладывается через несколько минут после неё самой (APK собирается дольше) — новее та,
		// что позже на полчаса
		if (!a || Date.parse(a.updated_at) - Date.parse(BUILD.time) < 30 * 60e3) return;
		const el = $('update');
		el.href = PUBLIC_DOWNLOAD;
		el.querySelector('small').textContent = `от ${builtAt(a.updated_at)} — ${APK ? 'скачай APK и установи поверх' : 'скачай и замени этот файл'}: сохранение останется`;
		el.classList.remove('hidden');
	} catch { /* без сети */ }
}

function showMenu() {
	const saved = loadGame();
	// скачать одним файлом — на опубликованной странице (https; файл download/ulei-cluster17.html публикуется рядом,
	// собирает его scripts/build-offline.mjs); в скачанной версии — её сборка и проверка, нет ли новее
	if (SITE) {
		$('offline-note').innerHTML = `<a href="${SITE_PAGE}">Скачать игру для Android (APK)</a> — работает без интернета.`;
		$('offline-note').classList.remove('hidden');
		$('version').textContent = `Версия от ${VERSION}`;
	} else if (OFFLINE) {
		$('offline-note').innerHTML = APK
			? `Приложение для Android, сборка от ${VERSION}. Новую версию — ${publicLink('скачай APK')} и установи поверх: сохранение останется.`
			: `Скачанная версия, сборка от ${VERSION}. Новую — ${publicLink('скачай по открытой ссылке')} и замени этот файл: сохранение останется.`;
		$('offline-note').classList.remove('hidden');
		if (!showMenu.checked) { showMenu.checked = true; checkUpdate(); }
	} else {
		$('download').classList.toggle('hidden', location.protocol !== 'https:');
		$('version').textContent = `Версия от ${VERSION}`;
	}
	$('btn-continue').classList.toggle('hidden', !saved);
	$('menu-save').textContent = saved ? `Сохранение: ${NODES[saved.world.at]?.short ?? '—'} · споранов ${saved.bag?.spore ?? 0}` : '';
	$('menu').classList.remove('hidden');
}

// Скачать игру одним файлом. В окне просмотра claude.ai браузер сам файлы из страницы не скачивает — файл
// отдаёт возможность downloads (зритель подтверждает сохранение). Если её здесь нет или сохранить не вышло —
// ссылка «открыть файл отдельно» (новая вкладка, там браузер скачает сам). Вне claude.ai — обычная ссылка.
const downloadsReady = window.claude?.use?.('downloads').catch(() => null) ?? null;
$('download-link').addEventListener('click', async (e) => {
	if (!downloadsReady) return; // обычная страница: ссылка с download
	e.preventDefault();
	const link = $('download-link'), label = link.querySelector('b'), note = $('download-note'), text = label.textContent;
	const url = new URL(link.getAttribute('href'), location.href).href;
	const direct = (why) => { note.innerHTML = `${why} ${publicLink('Скачать по открытой ссылке')} — браузер скачает файл сам.`; };
	label.textContent = '⏳ Готовим файл…';
	try {
		const downloads = await downloadsReady;
		if (!downloads) { direct('Здесь сохранить через Claude нельзя.'); return; }
		const blob = await (await fetch(url)).blob();
		await downloads.save({ filename: 'ulei-cluster17.html', data: blob });
		note.textContent = 'Готово: файл ulei-cluster17.html в загрузках — открой его в браузере.';
	} catch (err) {
		if (err?.code === 'declined') note.textContent = 'Сохранение отменено — нажми ещё раз и подтверди в окне Claude.';
		else if (err?.code === 'rate_limited') note.textContent = 'Окно сохранения уже открыто — подтверди его или попробуй через минуту.';
		else direct('Сохранить не вышло.');
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
	I.trader = stab[0]; I.medic = stab[1]; I.recruiter = stab[2]; I.informant = stab[3];
	for (const [id, D] of Object.entries(MERCS)) I[`merc_${id}`] = iconFactory.portrait(assets.player, { tint: D.tint, gear: {} });
	if (I.trader) $('trade-avatar').src = I.trader;
	$('btn-heal').insertAdjacentHTML('afterbegin', `<img src="${I.medkit}" alt="">`);
	$('btn-grenade').insertAdjacentHTML('afterbegin', `<img src="${I.grenade}" alt="">`);
}

/** Портреты торговца, лекаря и вербовщика по их форме из описания стаба. */
function buildPortraits() {
	const tints = [[0.75, 0.7, 0.62], [0.95, 0.95, 0.92], [0.8, 0.75, 0.7], [0.42, 0.4, 0.36]];
	return tints.map((tint) => iconFactory.portrait(assets.player, { tint, gear: {} }));
}

// ---------- Утилиты ----------
const tmpV = new THREE.Vector3();
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
/** Человек — герой или наёмник (по ним муры целятся дольше и бьют слабее). */
const isHuman = (a) => a === game.player || a instanceof Merc;
function turnTowards(current, target, maxStep) {
	let d = target - current;
	while (d > Math.PI) d -= Math.PI * 2;
	while (d < -Math.PI) d += Math.PI * 2;
	return current + Math.max(-maxStep, Math.min(maxStep, d));
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const casingGeo = {}, casingMat = {}; // общие для всех гильз
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3(), tmpV4 = new THREE.Vector3(); // для частиц (пятна от капель)
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
let blobMat = null;
const pickupProto = {}; // образцы предметов на земле по видам (game.spawnPickup)
const shellParts = {};
/** Снаряд гранатомёта: rocket — граната ПГ-7В с огнём маршевого двигателя, lob — ВОГ-25 (крупнее настоящего — видно). */
function shellMesh(kind) {
	const g = new THREE.Group();
	if (kind === 'rocket') {
		shellParts.olive ??= new THREE.MeshStandardMaterial({ color: 0x55663a, roughness: 0.5, metalness: 0.2 });
		shellParts.body ??= mergeGeometries([
			new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.02),
			new THREE.CylinderGeometry(0.008, 0.03, 0.12, 10).rotateX(Math.PI / 2).translate(0, 0, 0.13),
			new THREE.CylinderGeometry(0.013, 0.021, 0.04, 8).rotateX(Math.PI / 2).translate(0, 0, -0.05),
			new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8).rotateX(Math.PI / 2).translate(0, 0, -0.13),
		].map((q) => q.toNonIndexed()));
		g.add(new THREE.Mesh(shellParts.body, shellParts.olive));
		shellParts.flame ??= new THREE.SpriteMaterial({ map: softDotTexture('255,190,90'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
		const f = new THREE.Sprite(shellParts.flame);
		f.position.z = -0.22;
		f.scale.setScalar(0.42);
		g.add(f);
		g.scale.setScalar(1.3);
	} else {
		shellParts.vogMat ??= new THREE.MeshStandardMaterial({ color: 0x3a3e30, roughness: 0.5, metalness: 0.5 });
		shellParts.vog ??= mergeGeometries([
			new THREE.CylinderGeometry(0.02, 0.02, 0.05, 10).rotateX(Math.PI / 2),
			new THREE.SphereGeometry(0.02, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, 0.025),
		].map((q) => q.toNonIndexed()));
		g.add(new THREE.Mesh(shellParts.vog, shellParts.vogMat));
		g.scale.setScalar(1.8);
	}
	return g;
}
let wreckMat = null; // остовы бочек

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
	// стоящий вплотную к машине или стене — в «занятой» клетке (сетка с запасом на радиус): первые (последние) полметра
	// пути от такой точки не считаем — иначе боец у машины не видит заражённого в шаге от себя и не стреляет
	// (только вблизи, до 3,5 м: на расстоянии — как прежде, чтобы укрытие за машиной оставалось укрытием)
	const [ax, az] = cell(a.x, a.z), [bx, bz] = cell(b.x, b.z), near = d < 3.5;
	const t0 = near && blocked[az * N + ax] ? 0.55 / (d || 1) : 0, t1 = near && blocked[bz * N + bx] ? 1 - 0.55 / (d || 1) : 1;
	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		if (t < t0 || t > t1) continue;
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
				// свои материалы, чтобы вспыхивать красным при попадании; светлый ободок по контуру (post.js)
				o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
				for (const m of [o.material].flat()) if (m.isMeshStandardMaterial) m.defines = { ...m.defines, USE_RIM: '' };
			}
		});
		this.root.add(this.model);
		scene.add(this.root);
		// люди (скелет Mixamo): ноги поворачиваются отдельно от корпуса (updateLegs)
		this.legsOn = !!this.model.getObjectByName('mixamorigSpine');
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
		// стоя (и стреляя) корпус ушёл от ног далеко — вместо стойки ноги переступают (клип разворота с тем же положением
		// рук); клип переступания не перезапускается с каждым выстрелом — иначе ноги дёргаются на месте
		let turn = false;
		if (this.turning && TURN_OF[name] && this.actions[TURN_OF[name]]) { name = TURN_OF[name]; timeScale = (this.legRate ?? LEG_TURN) / TURN_CLIP; once = false; turn = true; }
		const a = this.actions[name];
		if (!a) return null;
		a.timeScale = timeScale;
		if (this.current === name && (!restart || turn)) return a;
		const prev = this.current && this.actions[this.current];
		// шаг → шаг (в прицеле в другую сторону, шаг → бег): новый клип — с той же фазы шага, иначе при смешивании
		// ноги из разных фаз дают «строевой» подъём колена и скольжение
		const phase = prev && !once && LOCO.test(name) && LOCO.test(this.current) ? prev.time / prev.getClip().duration : null;
		a.reset();
		a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
		a.clampWhenFinished = once;
		if (phase != null) a.time = (phase % 1) * a.getClip().duration;
		a.play();
		if (prev && prev !== a) a.crossFadeFrom(prev, fade, false);
		this.current = name;
		return a;
	}

	hitFlash() { this.flash = 1; }

	/**
	 * Ход человека (герой, наёмник, мур, внешник): корпус смотрит по root.rotation.y, ноги идут по ходу dir (мировое
	 * направление). В прицеле (aim) с автоматом или пистолетом — клип из набора 8 направлений относительно корпуса
	 * (AimWalk*: шаг вбок и спиной вперёд — своими шагами, ствол на цели); остаток угла (до ±22,5°) доворачивают ноги
	 * (модель), позвоночник скручивается встречно — грудь и ствол смотрят по корпусу. Без прицела — обычный шаг/бег,
	 * ноги — по ходу. Темп клипа — под скорость (м/с), стопы не скользят.
	 */
	locomote(clips, speed, dx, dz, run, aim) {
		this.legsOn = true;
		this.moving = true;
		const set = aim && AIM_SET[clips.walk];
		const rel = wrapAngle(Math.atan2(dx, dz) - this.root.rotation.y);
		if (set && this.actions[`${set.prefix}F`]) {
			let i = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
			// запас 12° у границы соседних направлений: пока ход не ушёл явно, клип прежний (корпус доворачивает к цели —
			// угол хода к корпусу гуляет, клипы BR → R → B менялись бы каждые полсекунды)
			const prevI = this.aimDir;
			if (prevI != null && prevI !== i && Math.abs(wrapAngle(rel - prevI * (Math.PI / 4))) < Math.PI / 8 + 0.21) i = prevI;
			this.aimDir = i;
			const d = DIRS8[i];
			this.legTarget = wrapAngle(rel - i * (Math.PI / 4));
			const clip = `${set.prefix}${d}`;
			const natural = HERO_GAIT8[set.gait][d][0];
			this.play(clip, { fade: 0.22, timeScale: Math.max(0.5, Math.min(1.8, speed / natural)) });
			return clip;
		}
		// ноги по ходу; если ход за спиной корпуса — корпус всё равно повернёт к ходу (игра), ноги сразу по ходу
		this.aimDir = null;
		this.legTarget = Math.abs(rel) < LEG_MAX ? rel : 0;
		const clip = run ? clips.run : clips.walk;
		this.play(clip, { timeScale: speed / HERO_GAIT[clip] });
		return clip;
	}

	/**
	 * Ноги относительно корпуса: стоя ноги стоят на месте, пока корпус поворачивается (позвоночник скручивается), а
	 * когда разворот больше TURN_START — переступают (клип Turn*) и догоняют корпус; на ходу — к углу хода.
	 */
	updateLegs(dt) {
		const yaw = this.root.rotation.y;
		if (this.prevYaw === undefined) this.prevYaw = yaw;
		const dYaw = wrapAngle(yaw - this.prevYaw);
		// корпус повернул — ноги остались, где стояли; рывок больше 75° за кадр (поставили в локацию, повернули
		// извне) — ноги вместе с корпусом
		let off = Math.abs(dYaw) > 1.3 ? 0 : (this.legOff ?? 0) - dYaw;
		this.prevYaw = yaw;
		// в стрельбе (стойка с прицелом, выстрел, шаг в прицеле) к врагу поворачивается всё тело: ноги — вместе с корпусом
		const combat = COMBAT_CLIP.test(this.current ?? '');
		this.legRate = combat ? LEG_TURN_COMBAT : LEG_TURN;
		if (this.moving) {
			const want = combat ? 0 : this.legTarget ?? 0;
			off += Math.max(-dt * 12, Math.min(dt * 12, wrapAngle(want - off)));
			this.turning = false;
		} else if (this.alive !== false) {
			if (Math.abs(off) > (combat ? 0.07 : TURN_START)) this.turning = true;
			if (this.turning) {
				off -= Math.sign(off) * Math.min(Math.abs(off), dt * this.legRate);
				if (Math.abs(off) < 0.04) this.turning = false;
			}
		} else off *= Math.exp(-dt * 6);
		if (Math.abs(off) > LEG_MAX) off = Math.sign(off) * LEG_MAX; // дальше ноги тянутся за корпусом
		this.legOff = wrapAngle(off);
		this.moving = false;
		this.model.rotation.y = this.legOff;
		// позвоночник — встречно: грудь, руки и оружие смотрят по корпусу
		if (Math.abs(this.legOff) > 1e-3) {
			this.spineBones ??= ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2'].map((n) => this.model.getObjectByName(n)).filter(Boolean);
			const a = -this.legOff / this.spineBones.length;
			for (const b of this.spineBones) b.quaternion.multiply(tmpQ.setFromAxisAngle(UP, a));
		}
	}

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
		if (this.legsOn) this.updateLegs(dt);
		if (this.recoil > 0.003) this.applyRecoil(dt);
		// левая кисть — на цевье именно этой модели ствола (у новых моделей цевьё у каждой своё; у заражённых — ничего)
		leftHandIK(this.model, this.ik ??= {});
		handGrasp(this.model, this.ik); // пальцы — на рукояти и цевье именно этой модели (game/grasp.js)
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
		if (rig.tripo) {
			// заражённый Tripo: оси костей свои — толчок вокруг осей тела (вперёд-назад, вбок к удару, голова мотается)
			const A = rig.tripo, B = this.zb, tw = this.recoilTwist;
			bodyRot(B.chest, A.chest, 0.15 * r * L.x, 0.06 * r * tw, -0.15 * r * L.z);
			bodyRot(B.spine, A.spine, 0.06 * r * L.x, 0, -0.06 * r * L.z);
			bodyRot(B.head, A.head, 0.22 * r * L.x, 0.12 * r * tw, -0.22 * r * L.z);
			return;
		}
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
const UP = new THREE.Vector3(0, 1, 0);
// ход в прицеле: набор клипов 8 направлений (src/hero-animations.js, AIM_WALK) по клипу шага в руках; скорость — HERO_GAIT8
const AIM_SET = { WalkRifle: { prefix: 'AimWalkRifle_', gait: 'WalkRifle' }, WalkPistol: { prefix: 'AimWalkPistol_', gait: 'WalkPistol' } };
// стойка → разворот на месте с тем же положением рук (ноги переступают)
const TURN_OF = { Idle: 'Turn', IdleRifle: 'TurnRifle', AimRifle: 'TurnAimRifle', ShootRifle: 'TurnAimRifle', IdlePistol: 'TurnPistol', AimPistol: 'TurnAimPistol', Shoot: 'TurnAimPistol' };
// клипы хода — между ними фаза шага сохраняется (Actor.play)
const LOCO = /^(Walk|Run|AimWalk)/;
// стоя ноги переступают за корпусом, когда он ушёл дальше TURN_START (рад, ~20°: иначе при стрельбе ноги смотрят в одну
// сторону, а корпус — в другую), со скоростью LEG_TURN (рад/с; клип переступания запечён под TURN_CLIP — темп по ней);
// дальше LEG_MAX (~80°) позвоночник не скручивается — ноги тянутся за корпусом сразу
const TURN_START = 0.35, LEG_TURN = 9, TURN_CLIP = 6, LEG_MAX = 1.4;
// в стрельбе ноги не отстают: поворачиваются вместе с корпусом (быстрое переступание), шаг в прицеле — без остатка угла
const LEG_TURN_COMBAT = 14;
const COMBAT_CLIP = /^(Aim|Shoot|TurnAim)/;
// корпус к цели поворачивается быстро, но не мгновенно (рад/с): 180° — за ~0,25 с
const BODY_TURN = 12;
// кости для толчка: у героя и наёмников — скелет Mixamo, у заражённых — простой (k — во сколько раз сильнее)
const HERO_KICK = { k: 1, bones: { chest: 'mixamorigSpine2', spine: 'mixamorigSpine1', hand: 'mixamorigRightHand' } };
const ZOMBIE_KICK = { k: 1.7, bones: { chest: 'Chest', spine: 'Spine', head: 'Head' } };
const BACK = { x: -1, z: 0 };

/** С чем начинают: целый пожарный топор и Glock 17 с полным магазином, патроны в запасе, живчик. */
const startKit = () => ({ gear: { melee: 'fireaxe', gun: 'glock17' }, owned: ['fireaxe', 'glock17'], mags: { glock17: WEAPONS.glock17.mag }, wear: { fireaxe: WEAPONS.fireaxe.durability } });

/**
 * Старое сохранение → новые стволы: убранное оружие и патроны (ПМ, обрез, МР-133, «Вектор», ВСС, ПКМ, SCAR-H, PM-63,
 * простой топор; 9×18 и 9×39) становятся ближайшими новыми (REMOVED в weapons.js) — везде: в наборе, рюкзаке,
 * хранилище, тайниках и на земле кластеров. Совпавшие записи складываются (патроны), у прочности и магазина — большее.
 */
function migrateSave(s) {
	if (!s) return s;
	const walk = (v) => {
		if (Array.isArray(v)) {
			const out = v.map((x) => walk(typeof x === 'string' ? realId(x) : x));
			// список id (набор) — без повторов
			return out.every((x) => typeof x === 'string') ? [...new Set(out)] : out;
		}
		if (v && typeof v === 'object') {
			const out = {};
			for (const [k, x] of Object.entries(v)) {
				const nk = realId(k), nx = walk(typeof x === 'string' ? realId(x) : x);
				if (nk in out && typeof out[nk] === 'number' && typeof nx === 'number') out[nk] = /^ammo/.test(nk) || k in REMOVED && /^ammo/.test(k) ? out[nk] + nx : Math.max(out[nk], nx);
				else out[nk] = nx;
			}
			return out;
		}
		return v;
	};
	return walk(s);
}

/** Набор из старого сохранения: прочность топоров, кулаки, если топора нет. */
function normalizeKit(kit) {
	kit.wear ??= {};
	kit.mags ??= {};
	kit.mods ??= {}; // доработки стволов в мастерской (game/mods.js)
	for (const id of kit.owned) if (WEAPONS[id]?.durability && kit.wear[id] == null) kit.wear[id] = WEAPONS[id].durability;
	const melee = kit.gear.melee;
	if (!melee || (melee !== 'fists' && !kit.owned.includes(melee))) kit.gear.melee = kit.owned.find((w) => WEAPONS[w].slot === 'melee') ?? 'fists';
	return kit;
}
const START_BAG = { ammo919: 17, medkit: 1, zhivchik: 3, spore: 0, peas: 0 }; // живчик — на дорогу (3 перехода), аптечка — лечение
const SEARCH_TIME = 1.1; // секунды на обыск
const SEARCH_REACH = 1.25; // как близко надо подойти к мебели
const REST_TIME = 120; // отдых у лекаря, секунд мира

/**
 * Что лежит в тайнике: { ammo919: [min, max, шанс], zhivchik: шанс, ... } → [[предмет, количество]]; убранное — новым
 * (REMOVED). danger — пояс кластера (game/world.js, ZONES): в Глубине (3) изредка, в Чёрной зоне (4) чаще в тайник
 * добавляется редкое — крупнокалиберные патроны, выстрелы к гранатомётам, а в Чёрной зоне бывает и сам гранатомёт.
 */
const ZONE_LOOT = {
	1: { zhivchik: [1, 1, 0.07] },
	2: { zhivchik: [1, 2, 0.08] },
	3: { zhivchik: [1, 2, 0.1], ammo127: [3, 6, 0.04], vog25: [2, 4, 0.04], rocket: [1, 1, 0.025], grenade: 0.03 },
	4: { zhivchik: [1, 3, 0.12], ammo127: [4, 10, 0.09], vog25: [2, 6, 0.08], rocket: [1, 2, 0.07], grenade: 0.05, rg6: 0.012, ksvk: 0.01, rpg7: 0.008 },
};
// живчик в описаниях тайников (аптечные шкафчики, врачи) — это лечение: теперь аптечка; живчик на дорогу — по поясу (ZONE_LOOT)
const LOOT_AS = { zhivchik: 'medkit' };
function rollLoot(spec, danger = 1, loc = null) {
	const out = [];
	const roll = (table, as = null) => {
		for (const [k, v] of Object.entries(table)) {
			const kind = realId(as?.[k] ?? k);
			if (Array.isArray(v)) { if (Math.random() < v[2]) out.push([kind, v[0] + Math.floor(Math.random() * (v[1] - v[0] + 1))]); }
			else if (Math.random() < v) out.push([kind, 1]);
		}
	};
	roll(spec, LOOT_AS);
	if (ZONE_LOOT[danger] && Object.keys(spec).length) roll(ZONE_LOOT[danger]);
	// ресурсы базы (game/economy.js): у каждой локации свой уклон — бензин на нефтебазе, химия в больнице…
	if (loc && Object.keys(spec).length) out.push(...rollResources(loc));
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
		this.lastHitBy = HIT_BY;
		this.hp -= dmg;
		game.impact(this.pos.clone().setY(0.55), true, 0.6);
		if (this.hp > 0) return;
		this.alive = false;
		let t = 0.08 + Math.random() * 0.18; // искра — и рвануло
		game.fx.push({ life: 1, update: (dt) => { t -= dt; if (t <= 0) { this.blow(); return false; } return true; }, dispose() {} });
	}

	/** Смятый чёрный остов: после взрыва и при возвращении в кластер до его перезагрузки. */
	wreck() {
		const m = this.b.mesh;
		this.alive = false;
		wreckMat ??= new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.9, metalness: 0.3 });
		m.material = wreckMat;
		m.scale.set(1.12, 0.42, 0.95);
		m.position.y = 0.18;
		m.rotation.x = (Math.random() - 0.5) * 0.5; m.rotation.z = (Math.random() - 0.5) * 0.5;
	}

	blow() {
		byWho(this.lastHitBy, () => game.explode(this.pos.clone().setY(0.5)));
		this.wreck();
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
// Кто нанёс попадание — для счёта «Убито» и заданий (засчитываются только герой, его наёмники и часовые базы):
// ставится на время выстрела, удара, взрыва; damage() у заражённых, людей и бочек запоминает его в lastHitBy.
let HIT_BY = null;
function byWho(who, fn) { const prev = HIT_BY; HIT_BY = who ?? null; try { return fn(); } finally { HIT_BY = prev; } }
/** Свой: герой, наёмник, часовой базы — или неизвестно кто (вызов напрямую, без стрелка). */
const heroSide = (a) => !a || a === game.player || a instanceof Merc || a instanceof Sentry;

function fireShot(shooter, W, gun, target, opts) { return byWho(shooter, () => fireShotNow(shooter, W, gun, target, opts)); }
function fireShotNow(shooter, W, gun, target, { player = false, accuracy = 1, damage = 1 } = {}) {
	if (W.proj) { fireShell(shooter, W, gun, target, { player, damage }); return; }
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
	if (target && target.alive && Math.random() < Math.max(0.4, chance) * accuracy) {
		if (W.pierce > 1) { pierceThrough(shooter, W, target, damage, from); return; }
		game.tracer(from, target.pos.clone().setY(1.2 * (target.scale ?? 1)));
		target.damage(W.damage * damage, pos, W.damage > 80 ? 0.6 : 0.25, W.ap);
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

/**
 * Крупнокалиберная пуля (КСВК): попала в цель — и прошла насквозь, бьёт ещё до pierce − 1 целей на той же линии
 * (каждая следующая — слабее), пока не упрётся в стену. Бронебойная (W.ap): костяную броню и бронежилеты не замечает.
 */
function pierceThrough(shooter, W, first, mul, from) {
	const pos = shooter.pos;
	const ox0 = first.pos.x - pos.x, oz0 = first.pos.z - pos.z, d0 = Math.hypot(ox0, oz0) || 1;
	const dx = ox0 / d0, dz = oz0 / d0;
	const end = game.bulletEnd(from, dx, dz, W.range);
	const lim = Math.hypot(end.pos.x - pos.x, end.pos.z - pos.z);
	const behind = [];
	const spare = heroSide(shooter); // свои пули мимо муров в мире
	for (const e of game.bandits.length ? [...game.enemies, ...game.bandits] : game.enemies) {
		if (!e.alive || e === first || e === shooter || (spare && e.faction && !game.hostile(e))) continue;
		const ox = e.pos.x - pos.x, oz = e.pos.z - pos.z, t = ox * dx + oz * dz;
		if (t <= d0 || t > lim) continue;
		if ((ox - dx * t) ** 2 + (oz - dz * t) ** 2 > (e.radius + 0.2) ** 2) continue;
		behind.push([t, e]);
	}
	behind.sort((a, b) => a[0] - b[0]);
	first.damage(W.damage * mul, pos, 0.9, W.ap);
	let k = 0.75;
	for (const [, e] of behind.slice(0, W.pierce - 1)) { e.damage(W.damage * mul * k, pos, 0.7, W.ap); k *= 0.75; }
	// трассер — насквозь, до стены или конца дальности; в стене — след
	game.tracer(from, end.pos.clone().setY(end.wall ? from.y : 1.0));
	if (end.wall) { game.impact(end.pos, true, 1.3); game.hitObstacle(end, W.damage, pos); }
}

/**
 * Выстрел гранатомёта: РПГ-7 — реактивная граната летит прямо, с дымным следом, и рвётся у первой цели или стены;
 * РГ-6 — ВОГ-25 навесом к цели. Сзади РПГ бьёт струя газов. Полёт и взрыв — game.shell.
 */
function fireShell(shooter, W, gun, target, { player = false, damage = 1 } = {}) {
	gun.updateMatrixWorld();
	const from = gun.localToWorld(gun.userData.muzzle.clone());
	const dir = new THREE.Vector3(0, -1, 0).transformDirection(gun.matrixWorld);
	game.muzzleFlash(gun, from, dir, W.flash ?? 1);
	game.smoke(from, 2);
	if (gun.userData.breech) game.backblast(gun.localToWorld(gun.userData.breech.clone()), dir);
	game.cycleGun(gun);
	if (gun.userData.round) gun.userData.round.visible = false; // граната ушла — труба пустая до перезарядки
	if (gun.userData.drum) gun.userData.drum.rotation.y += Math.PI / 3; // барабан — на следующую камору
	shooter.kick(0.35 + W.kick * 2.2, false);
	if (player) game.shake = Math.min(1, game.shake + W.kick);
	const pos = shooter.pos;
	const base = target ? angleTo(pos, target.pos) : shooter.root.rotation.y;
	const a = base + (Math.random() - 0.5) * (W.spread ?? 0);
	const dist = target ? Math.hypot(target.pos.x - pos.x, target.pos.z - pos.z) : W.range * 0.8;
	game.shell(W, from, a, dist, { own: player || game.mercs.includes(shooter), mul: damage, by: shooter });
}

/** Картечь: дробины веером, каждая — в первого заражённого на своей линии; урон падает с дистанцией. */
function firePellets(shooter, W, from, target) {
	const pos = shooter.pos;
	const base = target ? angleTo(pos, target.pos) : shooter.root.rotation.y;
	const hits = new Map(), spare = heroSide(shooter); // своя картечь мимо муров в мире
	for (let i = 0; i < W.pellets; i++) {
		const a = base + (Math.random() - 0.5) * W.spread;
		const dx = Math.sin(a), dz = Math.cos(a);
		let best = null, bt = W.range;
		for (const e of game.bandits.length ? [...game.enemies, ...game.bandits] : game.enemies) {
			if (!e.alive || e === shooter || (spare && e.faction && !game.hostile(e))) continue;
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

/**
 * УАЗ героя (машина из гаража базы): кузов, кабина с окнами, запаска, колёса; сломанный — с поднятым капотом и чёрным
 * дымом нет (дешевле): просто ржавее. Начало — центр машины на земле, перед — к +Z.
 */
function makeUaz(broken = false) {
	const g = new THREE.Group(), mat = (o) => new THREE.MeshStandardMaterial(o);
	const body = mat({ color: broken ? 0x5a4a36 : 0x4a5a3a, roughness: 0.7, metalness: 0.3 });
	const dark = mat({ color: 0x1a1d1e, roughness: 0.15, metalness: 0.5 }), tire = mat({ color: 0x18181a, roughness: 0.9 });
	const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
	add(new THREE.BoxGeometry(1.8, 0.75, 4.0), body, 0, 0.85, 0);
	add(new THREE.BoxGeometry(1.74, 0.8, 2.3), body, 0, 1.6, -0.45);
	add(new THREE.BoxGeometry(1.6, 0.5, 0.05), dark, 0, 1.68, 0.71);
	for (const x of [-0.88, 0.88]) add(new THREE.BoxGeometry(0.05, 0.46, 1.9), dark, x, 1.66, -0.45);
	add(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14).rotateZ(Math.PI / 2), tire, 0, 1.0, -2.1).rotation.y = Math.PI / 2;
	for (const [x, z] of [[-0.86, 1.25], [0.86, 1.25], [-0.86, -1.25], [0.86, -1.25]]) add(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 14).rotateZ(Math.PI / 2), tire, x, 0.4, z);
	if (broken) add(new THREE.BoxGeometry(1.7, 0.05, 1.0), body, 0, 1.5, 1.6).rotation.x = -0.9; // капот поднят
	return g;
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
	get W() { return gunStats(this.weapon, this.kit.mods); } // с доработками мастерской
	get clips() { return CLIPS[this.W.anim]; }
	get ammo() { return this.kit.mags[this.weapon] ?? 0; }
	set ammo(v) { this.kit.mags[this.weapon] = v; }

	/** 3D-модель оружия (одна на id). */
	gun(id) { return (this.models[id] ??= decorateGun(WEAPONS[id].make(), this.kit.mods?.[id])); }

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
	/** Пуля мура — тот же удар (fireShot зовёт damage), но гибель — «застрелили». */
	damage(dmg, from, knock) { this.hurt(dmg, from, knock, 'shot'); }

	/** cause — от чего гибель: eaten (заражённые), shot (пуля), blast (взрыв). */
	hurt(dmg, from, knock, cause = 'eaten') {
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
		if (this.hp <= 0) this.die(cause);
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
			if (target) this.face(angleTo(this.pos, target.pos), 0.6); // доворот к удару — быстро, но не мгновенно
			this.play('Melee', { once: true, fade: 0.06, restart: true, timeScale: W.speed });
			this.cooldown = W.cooldown;
			this.busy = 0.58 / W.speed;
			Sfx.swing();
			game.noise(this.pos, W.noise, true);
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
			if (game.time - (this.emptyToast ?? -9) > 2.5) { this.emptyToast = game.time; game.toast(`${ITEMS[W.ammo].name} кончились — бери топор`, 'warn'); }
			game.hud();
			return;
		}
		// цель — та же, что держит прицел (aimPick): корпус не мечется между заражёнными от выстрела к выстрелу
		const target = this.aimPick(W, true);
		// корпус к цели — быстро, но плавно; выстрел — когда ствол смотрит на цель (патрон уходит сразу)
		if (target) this.face(angleTo(this.pos, target.pos), 0.5);
		const turnLeft = target ? Math.abs(wrapAngle(this.faceYaw - this.root.rotation.y)) / BODY_TURN : 0;
		// из прицела отдача начинается сразу, из низкой готовности ствол вскидывается за 0.07 с; на ходу в прицеле — клип
		// хода (ствол уже на цели), отдача — толчком (kick)
		const c = this.clips;
		const aiming = this.current === c.shoot || this.current === c.aim || this.aimWalking;
		// на ходу — клип хода (ствол уже на цели), отдача — толчком: клип выстрела стоя заморозил бы ноги посреди шага
		const walking = this.aimWalking || (this.moveMag ?? 0) > 0.12;
		if (!walking) this.play(c.shoot, { once: true, fade: aiming ? 0.03 : 0.07, restart: true });
		this.cooldown = W.cooldown;
		this.busy = W.anim === 'rifle' ? 0.14 : 0.25;
		this.aim = 0.9;
		this.ammo--;
		game.noise(this.pos, W.noise, true); // выстрел слышно издалека
		this.pending.push({ t: Math.max(aiming ? 0.03 : 0.06, turnLeft + 0.02), fn: () => this.shotHit(W, this.weapon, target) });
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
		byWho(this, () => best.damage(W.damage, this.pos, 0.45));
		Sfx.chop();
		if (W.durability) game.wearOut(id); // топор тупится от каждого удара по заражённому
	}

	/** Выстрел — в момент вскидки ствола: звук, вспышка и пуля вместе. */
	shotHit(W, id, target) {
		Sfx.gun(id, shotKind(W), undefined, { supp: W.supp });
		fireShot(this, W, this.gun(id), target, { player: true, damage: game.basePerks().gunDamage }); // тир на базе — +10 %
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
		if ((game.bag[W.ammo] ?? 0) <= 0) { Sfx.dry(); game.toast(`В запасе нет: ${ITEMS[W.ammo].name.toLowerCase()}`, 'warn'); return; }
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
		const round = this.models.rpg7?.userData.round;
		if (round) round.visible = (this.kit.mags.rpg7 ?? 0) > 0; // граната в трубе РПГ — пока заряжен
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
		this.moveMag = mag;
		const c = this.clips;
		// в прицеле (после выстрела ствол ещё держится, спуск зажат) корпус смотрит на цель; шагом — ноги идут, куда
		// ведёт стик (клип направления относительно корпуса), бегом прицел не держат — корпус по ходу
		const aiming = this.hold === 'gun' && !this.equipping && (this.aim > 0 || input.held('attack'));
		if (aiming) {
			this.aimT = (this.aimT ?? 0) - dt;
			if (this.aimT <= 0 || !this.aimTarget?.alive) { this.aimPick(this.W); this.aimT = 0.3; }
			if (this.aimTarget) this.face(angleTo(this.pos, this.aimTarget.pos), 0.15);
		} else this.aimTarget = null;
		// в прицеле с целью корпус смотрит только на цель: на ходу — шаг в прицеле в нужную сторону (боком, спиной),
		// не бег — иначе корпус дёргается между целью и направлением хода
		const locked = !!(aiming && this.aimTarget);
		const walkAim = locked && !!AIM_SET[c.walk];
		this.aimWalking = false;
		if (this.busy > 0 && !(walkAim && mag > 0.12)) {
			// во время удара почти стоим на месте
			if (mag > 0.1) this.pos.addScaledVector(tmpV.set(mv.x, 0, mv.y).normalize(), dt * 0.6 * mag);
		} else if (mag > 0.12) {
			// шаг 1.1–1.7 м/с, бег 3.6–5 м/с; анимация ускоряется вместе с героем, ноги не скользят
			const run = mag > 0.55 && !locked;
			let speed = run ? 3.6 + (1.4 * (mag - 0.55)) / 0.45 : walkAim ? 1.1 + 1.1 * Math.min(1, (mag - 0.12) / 0.88) : 1.1 + (0.6 * Math.min(1, (mag - 0.12) / 0.43));
			const dir = tmpV.set(mv.x, 0, mv.y).normalize();
			// в прицеле боком и спиной вперёд человек идёт медленнее (DIR_SPEED — так же подогнан шаг клипов)
			if (walkAim) speed *= dirSpeed(wrapAngle(Math.atan2(dir.x, dir.z) - this.root.rotation.y));
			this.pos.addScaledVector(dir, speed * dt);
			if (run && (this.stepDust = (this.stepDust ?? 0) + speed * dt) > 1.1) { this.stepDust = 0; game.dust(this.pos); }
			// шаги слышно: асфальт, трава, грунт или пол — по тому, что под ногами
			if ((this.stride = (this.stride ?? 0) + speed * dt) > (run ? 1.05 : 0.68)) { this.stride = 0; Sfx.step(level.surface(this.pos), run); }
			if (!locked) this.face(Math.atan2(dir.x, dir.z), 0.1);
			this.locomote(c, speed, dir.x, dir.z, run, walkAim);
			this.aimWalking = walkAim;
		} else if (this.reloading > 0) {
			if (this.current !== c.reload) this.playReload(0.15);
		} else if (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning()) {
			// после выстрела ствол ещё немного в прицеле, потом плавно опускается
			const aim = this.hold === 'gun' && this.aim > 0;
			this.play(aim ? c.aim : c.idle, { fade: this.current === c.shoot ? 0.05 : 0.25 });
		}
		// корпус — к цели или по ходу: быстро, но плавно (ноги догоняют — updateLegs)
		if (this.faceT > 0) { this.faceT -= dt; this.root.rotation.y = turnTowards(this.root.rotation.y, this.faceYaw, dt * BODY_TURN); }
		resolveCollisions(this.pos, this.radius, level.colliders);
	}

	/** Повернуть корпус к yaw (рад) в ближайшие t секунд — со скоростью BODY_TURN. */
	face(yaw, t) { this.faceYaw = yaw; this.faceT = Math.max(this.faceT ?? 0, t); }

	/**
	 * Цель прицела — одна для поворота корпуса и для выстрела. Держится, пока жива, видна и в дальности; на другую
	 * переключается, только если та заметно ближе (на 40 %) или это бочка с горючим у толпы — иначе при двух
	 * заражённых на равном расстоянии корпус мечется между ними. shot — выбор для выстрела (гранатомёт целит по толпе).
	 */
	aimPick(W, shot = false) {
		const cur = this.aimTarget, range = W.range;
		const dist = (t) => Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
		const barrel = game.barrelTarget(this.pos, range);
		const blast = W.proj && shot ? game.blastTarget(this.pos, W) : null;
		if (barrel || blast) return (this.aimTarget = barrel ?? blast);
		// берём цель до дальности +1 м, держим до +2 м: на границе дальности цель не теряется и не находится снова каждые 0,3 с
		const near = game.nearestEnemy(this.pos, range + (shot ? 0 : 1), true);
		const sight = cur?.alive && lineOfSight(this.pos, cur.pos);
		if (sight) this.lostAt = null; else this.lostAt ??= game.time;
		// пропала из виду меньше чем на 0,6 с (угол машины, столб) — держим (пуля упрётся в препятствие): иначе корпус
		// дёргается туда-сюда между целью и направлением хода
		const keep = cur?.alive && !(cur instanceof FuelBarrel) && dist(cur) <= range + (shot ? 0 : 2) && (sight || game.time - this.lostAt < 0.6);
		if (!keep || (near && near !== cur && dist(near) < dist(cur) * 0.6)) { this.aimTarget = near; this.lostAt = null; }
		return this.aimTarget;
	}
}

/** Доля скорости хода «вперёд» по направлению относительно корпуса (DIR_SPEED, между соседними — линейно). */
function dirSpeed(rel) {
	const f = ((rel / (Math.PI / 4)) % 8 + 8) % 8, i = Math.floor(f) % 8, t = f - Math.floor(f);
	return DIR_SPEED[DIRS8[i]] + (DIR_SPEED[DIRS8[(i + 1) % 8]] - DIR_SPEED[DIRS8[i]]) * t;
}

/** Шанс чёрной жемчужины в споровом мешке рубера. */
const PEARL_CHANCE = 0.25;
/** Чёрная жемчужина: на сколько навсегда растёт здоровье и до какого предела. */
const PEARL_HP = 20, MAX_HP_CAP = 200;
/** Красная жемчужина (с элиты — изредка, со скребера — всегда): здоровье навсегда +RED_PEARL_HP, свой предел выше; торговец — RED_PEARL_PRICE. */
const RED_PEARL_HP = 40, RED_HP_CAP = 300, RED_PEARL_ELITE = 0.12, RED_PEARL_PRICE = 600;
/** Как быстро гаснет толчок от попадания (1/с): весь отъезд тела = сила толчка. */
const PUSH_DECAY = 9;
/**
 * Заражённые Tripo (scripts/build-zombies.mjs): клипы Tripo человеческие (обычные шаг, бег, разворот, удар, падение),
 * поэтому повадки заражённого — добавкой поверх клипа, по тому, как это выглядит у живых «зомби» в кино и играх:
 *   • бегун (пустыш, лотерейщик): корпус наклонён вперёд, голова свёрнута набок (у каждого — на свою сторону и угол),
 *     руки тянутся к добыче, походка неровная — корпус переваливается, темп у каждого свой; бег рывками — скорость
 *     (и с ней темп клипа, стопы не скользят) то прибавляет, то проседает;
 *   • топтун: тяжёлый медленный шаг, корпус подан вперёд и раскачивается из стороны в сторону, руки висят;
 *   • рубер и элита: мощные, ссутуленные, голова втянута и задрана вперёд, руки чуть вперёд; на рывке — ниже к земле.
 * Разворот к цели — на месте клипом Turn (ноги переступают), удар — Attack (замах двумя руками сверху и рубящий
 * удар вниз), попадание — Hurt, смерть — падение на бок по ходу удара (Death — на левый, DeathR — на правый).
 * Повороты добавки — вокруг осей тела в покое (лево +X, верх +Y, вперёд +Z), пересчитанных в оси каждой кости.
 * lean — наклон корпуса, град. (run — ещё на бегу); head — кивок головы; reach — руки вперёд в погоне; sway — раскачка
 * корпуса за шагом; tilt — голова набок (наибольший угол); turn — во сколько раз быстрее клипа разворачивается.
 */
const POSTURE = {
	runner: { lean: 9, run: 10, head: 6, reach: 38, sway: 3.5, tilt: 14, turn: 1.6, lurch: 0.18 },
	stomper: { lean: 11, run: 4, head: 8, reach: 0, sway: 6, tilt: 6, turn: 1, lurch: 0 },
	ruber: { lean: 14, run: 12, head: -10, reach: 14, sway: 3, tilt: 4, turn: 1.25, lurch: 0 },
	elite: { lean: 16, run: 12, head: -10, reach: 16, sway: 3, tilt: 3, turn: 1.35, lurch: 0 },
	skreber: { lean: 20, run: 14, head: -14, reach: 20, sway: 4, tilt: 2, turn: 1.2, lurch: 0 },
};
const TRIPO_BONES = { waist: 'Waist', spine: 'Spine01', chest: 'Spine02', neck: 'NeckTwist01', head: 'Head', armL: 'L_Upperarm', armR: 'R_Upperarm' };
const _zq = new THREE.Quaternion();
/** Поворот кости поверх клипа вокруг осей тела в покое (ax — оси в осях кости), углы в радианах. */
function bodyRot(bone, ax, x, y, z) {
	if (!bone) return;
	if (x) bone.quaternion.multiply(_zq.setFromAxisAngle(ax.x, x));
	if (y) bone.quaternion.multiply(_zq.setFromAxisAngle(ax.y, y));
	if (z) bone.quaternion.multiply(_zq.setFromAxisAngle(ax.z, z));
}
/**
 * Модель заражённого Tripo: клипы-двойники (Stomp — шаг топтуна, Charge — бег рубера), оси тела в осях костей (для
 * осанки и толчка от пули), скорости клипов и момент удара — из файла (scene.extras). Старая модель — как есть.
 */
function zombieModel(gltf) {
	const s = gltf.scene, by = (n) => gltf.animations.find((c) => c.name === n);
	if (!s.getObjectByName('L_Forearm')) return gltf;
	for (const [alias, src] of [['Stomp', 'Walk'], ['Charge', 'Run']]) if (!by(alias) && by(src)) { const c = by(src).clone(); c.name = alias; gltf.animations.push(c); }
	s.updateMatrixWorld(true);
	const axes = {};
	for (const [k, n] of Object.entries(TRIPO_BONES)) {
		const b = s.getObjectByName(n);
		if (!b) continue;
		const q = b.getWorldQuaternion(new THREE.Quaternion()).invert();
		axes[k] = { name: n, x: new THREE.Vector3(1, 0, 0).applyQuaternion(q), y: new THREE.Vector3(0, 1, 0).applyQuaternion(q), z: new THREE.Vector3(0, 0, 1).applyQuaternion(q) };
	}
	const x = s.userData ?? {};
	gltf.userData.tripo = { axes, gait: x.gait ?? { Walk: 1, Run: 3.5 }, hit: x.hit ?? { Attack: 1.2 }, turn: x.turn || 2.5, lunge: x.lunge ?? null };
	return gltf;
}
const D2R = Math.PI / 180;
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

const ENEMY_TYPES = {
	// move — клип погони; его скорость (ZOMBIE_GAIT) подгоняется под настоящую, чтобы ноги не скользили
	// heavy — во сколько раз хуже отлетает от ударов; stagger — на сколько замирает от попадания;
	// sight — с какого расстояния замечает героя; armor — сколько урона срезает броня с каждого попадания
	runner: { hp: 60, speed: 3.4, scale: 1, radius: 0.36, damage: 8, range: 1.25, hitTime: 0.72, attackAnim: 1, move: 'Run', score: 1, heavy: 1, stagger: 0.3 },
	stomper: { hp: 220, speed: 2.0, scale: 1.08, radius: 0.5, damage: 22, range: 1.55, hitTime: 0.85, attackAnim: 0.85, move: 'Stomp', score: 3, heavy: 3, stagger: 0.08 },
	// рубер: следующая за топтуном стадия — зверь на четырёх лапах в костяной броне, с пастью собаки-обезьяны;
	// ревёт, бросается рывками (charge — скорость галопа), бьёт броском с укусом; gait — скорости его клипов
	ruber: { hp: 520, speed: 2.6, charge: 6.4, scale: 1.12, radius: 0.58, damage: 34, knock: 1.6, range: 2.0, hitTime: 0.5, attackAnim: 1, attack: 'Attack', move: 'Walk', gait: RUBER_GAIT, score: 5, heavy: 5, stagger: 0.03, sight: 18, armor: 8, roar: true },
	// элита: высшая стадия — рубер-переросток, почти чёрный, в толстой броне; быстрее и злее, рывки длиннее,
	// раны затягивает (regen, ед./с — через 4 с без попаданий); рёв поднимает всех вокруг. Модель — рубера
	elite: { hp: 1400, speed: 3.0, charge: 8.2, scale: 1.34, radius: 0.72, damage: 48, knock: 2.2, range: 2.3, hitTime: 0.45, attackAnim: 1.15, attack: 'Attack', move: 'Walk', gait: RUBER_GAIT, score: 12, heavy: 8, stagger: 0.01, sight: 22, armor: 14, roar: true, regen: 10, model: 'ruber' },
	// скребер (2026-11-08): высшая стадия после элиты, логово — «Провал»; огромный, в костяных наростах, тёмно-багровый.
	// Каждый удар — по земле (slam, м): задевает всех вокруг вполсилы и сбивает с ног; рёв зовёт бегунов из мути (call);
	// раны затягивает быстрее элиты. С него — красная жемчужина
	skreber: { hp: 4200, speed: 3.2, charge: 9.0, scale: 1.8, radius: 0.95, damage: 64, knock: 3.0, range: 2.9, hitTime: 0.5, attackAnim: 1.05, attack: 'Attack', move: 'Walk', gait: RUBER_GAIT, score: 30, heavy: 14, stagger: 0.004, sight: 28, armor: 22, roar: true, regen: 16, slam: 4.8, call: 5, model: 'ruber' },
};

class Enemy extends Actor {
	constructor(type, pos, hp) {
		const T = ENEMY_TYPES[type];
		// бегуны двух видов: пустыш и лотерейщик (модели разные, повадки одни)
		const key = type === 'runner' && assets.lottery !== assets.runner && Math.random() < 0.35 ? 'lottery' : (T.model ?? type);
		const gltf = assets[key];
		super(gltf, { scale: T.scale });
		this.type = type;
		this.T = T;
		this.kind = key;
		// модель Tripo: скорости клипов (м/с при темпе 1 — ступни не скользят), момент удара, разворот, осанка
		this.tz = gltf.userData.tripo ?? null;
		const g = this.tz?.gait;
		this.gait = g ? { Walk: g.Walk, Run: g.Run, Stomp: g.Walk, Charge: g.Charge ?? g.Run } : (T.gait ?? ZOMBIE_GAIT);
		// удар: темп клипа такой, чтобы удар пришёлся на hitTime (у броска Tripo — не быстрее двух раз: захват виден)
		this.atkTs = this.tz ? Math.min(2, this.tz.hit.Attack / (T.hitTime / T.attackAnim)) : T.attackAnim;
		this.strikeAt = this.tz ? this.tz.hit.Attack / this.atkTs : T.hitTime / T.attackAnim;
		// клип погони: рубер Tripo гонится бегом громилы (его шаг для 2,6 м/с слишком медленный)
		this.move = this.tz && T.charge ? 'Run' : T.move;
		if (this.tz) {
			this.zb = Object.fromEntries(Object.entries(this.tz.axes).map(([k, a]) => [k, this.model.getObjectByName(a.name)]));
			const P = POSTURE[type];
			this.tilt = (Math.random() < 0.5 ? -1 : 1) * P.tilt * (0.35 + Math.random() * 0.65) * D2R;
			this.leanVar = 0.75 + Math.random() * 0.5;
			this.lurchPh = Math.random() * 6;
		}
		// у каждого свой рост и сложение, одежда и оттенок кожи
		const body = bodyVariation();
		this.model.scale.set(T.scale * body.s * body.w, T.scale * body.s, T.scale * body.s * body.w);
		dressZombie(this, clothSets[type], { recolor: type !== 'ruber' && type !== 'elite' && type !== 'skreber' });
		// элита — почти чёрная, с багровым отливом и тлеющими глазами; скребер — тёмно-багровый, глаза горят, тело тлеет
		if (type === 'elite') this.model.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) { m.color?.multiply(new THREE.Color(0.34, 0.27, 0.3)); if (/eye/i.test(m.name)) m.emissive?.setRGB(0.9, 0.12, 0.05); } });
		if (type === 'skreber') this.model.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) { m.color?.multiply(new THREE.Color(0.62, 0.22, 0.2)); m.emissive?.setRGB(0.09, 0.0, 0.0); if (/eye/i.test(m.name)) m.emissive?.setRGB(1.0, 0.25, 0.05); } });
		this.maxHp = T.hp;
		this.scale = T.scale * body.s;
		// длина шага — по масштабу модели вдоль хода (сложение w растягивает и его): с ним темп клипа — без скольжения
		this.strideScale = T.scale * body.s * body.w;
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
		this.kickRig = this.tz ? { k: 1.7, tripo: this.tz.axes } : ZOMBIE_KICK;
		// стая (game/horde.js): у бегуна может быть вожак, у топтуна и рубера — свои бегуны
		this.leader = null;
		this.followers = type === 'runner' ? null : [];
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
			if (!this.tz) this.root.rotation.y = angleTo(this.pos, game.foeFor(this.pos).pos); // Tripo — доворачивается в рёве
			this.play('Roar', { once: true, fade: 0.15, restart: true });
			Sfx.roar(game.ear(this.pos));
			if (this.type === 'elite' && !game.eliteWarned) { game.eliteWarned = true; game.banner('Элита!', 'Высшая стадия заражённого: толстая броня, длинные рывки, раны затягивает. Не стой на месте — и не отпускай её отдышаться'); }
			if (this.type === 'skreber') { game.banner('Скребер!', 'Хозяин Провала: броня, которую не пробить пистолетом, удар по земле сбивает с ног всех вокруг, рёв зовёт стаю. Бей издалека и не стой рядом'); game.skreberCall(this); }
			const near = clamp01(1 - this.pos.distanceTo(game.player.pos) / 20);
			game.shake = Math.min(1, game.shake + near * 0.35);
			for (const o of game.enemies) if (o !== this && o.state === 'idle' && o.pos.distanceTo(this.pos) < 18) setTimeout(() => o.alert(), 400 + Math.random() * 700);
			this.rallyPack();
			return;
		}
		this.state = 'chase';
		if (Math.random() < 0.6) Sfx.growl(this.type, game.ear(this.pos));
		for (const o of game.enemies) if (o !== this && o.state === 'idle' && o.pos.distanceTo(this.pos) < 6 && Math.random() < 0.6) setTimeout(() => o.alert(), 300 + Math.random() * 900);
		this.rallyPack();
	}

	/** Стая поднимается вся: заметил кто-то из бегунов — вожак и остальные за ним, заметил вожак — все свои. */
	rallyPack() {
		const lead = this.leader?.alive ? this.leader : this;
		if (!lead.followers?.length) return;
		for (const o of [lead, ...lead.followers]) if (o !== this && o.alive && o.state === 'idle') setTimeout(() => o.alert(), 150 + Math.random() * 600);
	}

	/**
	 * Сильный собирает стаю: бродячие бегуны рядом пристают к топтуну или руберу — чем опаснее кластер,
	 * тем больше стая (до 3 + 2 × опасность). Проверка раз в несколько секунд.
	 */
	gather(dt) {
		this.gatherT = (this.gatherT ?? 2 + Math.random() * 3) - dt;
		if (this.gatherT > 0) return;
		this.gatherT = 3 + Math.random() * 3;
		this.followers = this.followers.filter((o) => o.alive && o.leader === this);
		const max = 3 + 2 * (NODES[game.loc]?.danger ?? 1);
		for (const o of game.enemies) {
			if (this.followers.length >= max) break;
			if (o.type !== 'runner' || !o.alive || o.state !== 'idle' || o.leader?.alive) continue;
			if (Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) < 10) { o.leader = this; this.followers.push(o); }
		}
	}

	idle(dt, p, dist) {
		if (p.alive && (dist < 3.5 || (dist < (this.T.sight ?? 13) && lineOfSight(this.pos, p.pos)))) { this.alert(); return; }
		// в стае бегун бродит вокруг вожака и догоняет, если отстал; вожак водит стаю по кластеру
		if (this.leader && !this.leader.alive) this.leader = null;
		const lead = this.leader;
		if (lead) this.home.copy(lead.pos);
		if (this.followers && !lead) this.gather(dt);
		const behind = lead && Math.hypot(lead.pos.x - this.pos.x, lead.pos.z - this.pos.z) > 7;
		if (behind && !this.wander) this.wanderTimer = 0;
		this.wanderTimer -= dt;
		if (!this.wander && this.wanderTimer <= 0) {
			if (behind || Math.random() < 0.5) {
				const roam = this.followers?.length && Math.random() < 0.55;
				for (let i = 0; i < 8; i++) {
					const a = Math.random() * Math.PI * 2, r = roam ? 6 + Math.random() * 8 : 1.5 + Math.random() * (lead ? 3 : 5);
					const x = this.home.x + Math.cos(a) * r, z = this.home.z + Math.sin(a) * r;
					if (Math.abs(x) > PLAY - 4 || Math.abs(z) > PLAY - 4 || level.nav.blockedAt(x, z, 0.5)) continue;
					this.wander = new THREE.Vector3(x, 0, z);
					if (roam) this.home.copy(this.wander); // стая переходит на новое место
					break;
				}
			}
			this.wanderTimer = 3 + Math.random() * 6;
		}
		if (this.wander) {
			const dir = tmpV.set(this.wander.x - this.pos.x, 0, this.wander.z - this.pos.z);
			if (dir.length() < 0.4) { this.wander = null; this.play('Idle', { fade: 0.4 }); return; }
			dir.normalize();
			const speed = behind ? 1.3 : this.type === 'runner' ? 0.55 : 0.6;
			this.pos.addScaledVector(dir, speed * dt);
			this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 2.5);
			this.play('Walk', { fade: 0.4, timeScale: speed / (this.gait.Walk * this.strideScale) });
			resolveCollisions(this.pos, this.radius, level.colliders);
		} else {
			this.play('Idle', { fade: 0.4 });
		}
	}

	damage(dmg, from, knock, ap = false) {
		if (!this.alive) return;
		this.lastHitBy = HIT_BY;
		const T = this.T;
		const dir = new THREE.Vector3().subVectors(this.pos, from).setY(0).normalize();
		// костяная броня рубера: срезает часть урона с каждого попадания — слабые пули и картечь почти не берут
		if (T.armor) {
			const cut = Math.min(dmg * 0.7, T.armor * (ap ? 0.25 : 1)); // бронебойная 12,7 кость почти не держит
			dmg -= cut;
			if (cut > dmg * 0.5) game.impact(this.pos.clone().setY(1.3 * this.scale).addScaledVector(dir, -this.radius), true, 0.7); // искры от кости
		}
		this.hp -= dmg;
		this.hitAt = game.time;
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
		// отшатывание: лёгкие — от каждого попадания (не чаще трёх раз в секунду), тяжёлые — только от сильного удара;
		// удар и рывок не прерываются
		if (this.hp > 0 && this.actions.Hurt && this.state !== 'attack' && this.state !== 'roar' && !(this.charging > 0) && game.time - (this.hurtAt ?? -9) > 0.35 && (T.heavy <= 1 || dmg >= 40)) {
			this.hurtAt = game.time;
			this.play('Hurt', { once: true, fade: 0.06, restart: true, timeScale: T.heavy <= 1 ? 1.5 : 2.2 });
		}
		this.alert();
		Sfx.flesh(game.ear(this.pos));
		if (this.hp <= 0) this.die();
	}

	die() {
		this.alive = false;
		this.state = 'dead';
		this.timer = 0;
		this.charging = 0;
		let clip = 'Death';
		const d = this.lastHit?.dir;
		if (this.tz && d && this.actions.DeathR) {
			// бок, на который падать, — тот, что ближе к направлению удара; остаток угла тело докручивает, пока валится
			const ry = this.root.rotation.y, left = d.x * Math.cos(ry) - d.z * Math.sin(ry) >= 0;
			clip = left ? 'Death' : 'DeathR';
			this.deathTurn = wrapAngle(Math.atan2(d.x, d.z) + (left ? -Math.PI / 2 : Math.PI / 2) - ry);
		}
		this.play(clip, { once: true, fade: 0.08, timeScale: this.tz ? 1.35 : 1 });
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
		if ((h.dmg >= 45 || h.blast) && Math.random() < (h.blast ? 0.6 : 0.35)) parts.push(this.tz ? (Math.random() < 0.5 ? 'L_Forearm' : 'R_Forearm') : (Math.random() < 0.5 ? 'Forearm.L' : 'Forearm.R'));
		for (const name of parts) {
			const bone = this.model.getObjectByName(name);
			if (!bone) continue;
			bone.scale.setScalar(0.01);
			game.stump(bone, h.dir, name === 'Head' ? 1 : 0.6);
		}
		if (parts.length) { this.gored = parts; Sfx.gib(game.ear(this.pos)); }
	}

	/** Осанка заражённого поверх клипа Tripo (см. POSTURE). */
	posture() {
		const P = POSTURE[this.type], A = this.tz.axes, B = this.zb;
		const cur = this.current, run = cur === 'Run' || cur === 'Charge';
		const hunt = this.state === 'chase' || this.state === 'attack';
		const a = this.actions[cur], ph = a ? (a.time / a.getClip().duration) * Math.PI * 2 : 0;
		const moving = cur === 'Walk' || cur === 'Run' || cur === 'Stomp' || cur === 'Charge';
		const lean = (P.lean + (run ? P.run : 0)) * this.leanVar * (cur === 'Death' || cur === 'DeathR' ? 0 : 1) * D2R;
		const sway = moving ? P.sway * Math.sin(ph) * D2R : 0;
		bodyRot(B.waist, A.waist, 0, 0, sway * 0.6);
		bodyRot(B.spine, A.spine, lean * 0.55, 0, -sway);
		bodyRot(B.chest, A.chest, lean * 0.45, 0, 0);
		// голова: смотрит вперёд (не в землю при наклоне), свёрнута набок
		bodyRot(B.head, A.head, P.head * D2R - lean * 0.6, 0, this.tilt);
		if (P.reach && hunt && cur !== 'Attack' && cur !== 'Hurt') {
			const r = -P.reach * D2R * (run ? 1 : 0.7);
			bodyRot(B.armL, A.armL, r, 0, 0);
			bodyRot(B.armR, A.armR, r * 0.85, 0, 0);
		}
	}

	update(dt) {
		// элита затягивает раны, если по ней не попадали 4 с
		if (this.T.regen && this.alive && this.hp < this.maxHp && game.time - (this.hitAt ?? -9) > 4) this.hp = Math.min(this.maxHp, this.hp + this.T.regen * dt);
		// цель — ближайший живой: герой или наёмник (выбор раз в полсекунды, чтобы не дёргался)
		this.foeT = (this.foeT ?? 0) - dt;
		if (this.foeT <= 0 || !this.foe?.alive) { this.foe = game.foeFor(this.pos); this.foeT = 0.5; }
		const p = this.foe;
		const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
		// далеко от камеры — не анимируем и не рисуем (экономия на телефонах)
		const near = inView(this.pos);
		this.model.visible = near;
		if (near) { super.update(dt); if (this.tz && this.alive) this.posture(); }
		if (this.deathTurn) {
			const step = Math.max(-dt * 2.6, Math.min(dt * 2.6, this.deathTurn));
			this.root.rotation.y += step;
			this.deathTurn = Math.abs(this.deathTurn - step) < 1e-3 ? 0 : this.deathTurn - step;
		}
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
		// кисляк: озверевшие замечают героя издалека
		if (this.state === 'idle' && game.rage > 0 && dist < 16 + 30 * game.rage) this.alert();
		if (this.state === 'idle') { this.idle(dt, p, dist); return true; }
		if (this.state === 'roar') {
			this.timer += dt;
			this.root.rotation.y = turnTowards(this.root.rotation.y, angleTo(this.pos, p.pos), dt * (this.tz ? 3.5 : 2));
			if (this.timer > this.actions.Roar.getClip().duration - 0.2) { this.state = 'chase'; this.chargeCd = 0; }
			return true;
		}

		if (this.state === 'attack') {
			this.timer += dt;
			const a = this.actions[this.T.attack ?? 'Attack'];
			// бросок (клип Tripo): тело уходит вперёд на шаг — ход таза из клипа вынут, двигаем здесь (не ближе вплотную)
			const L = this.tz?.lunge;
			if (L && this.timer > L.t0 / this.atkTs && this.timer < L.t1 / this.atkTs && dist > this.radius + 0.55) {
				const v = (L.d * this.scale) / ((L.t1 - L.t0) / this.atkTs);
				this.pos.addScaledVector(tmpV.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)), Math.min(v * dt, dist - this.radius - 0.55));
				resolveCollisions(this.pos, this.radius, level.colliders);
			}
			if (!this.hitDone && this.timer >= this.strikeAt) {
				this.hitDone = true;
				if (p.alive && dist < this.T.range + 0.6) byWho(this, () => p.hurt(p.dry ? p.hp : this.T.damage * (1 + 0.3 * (game.rage ?? 0)), this.pos, this.T.knock)); // боец без патронов не отобьётся; в кисляк — злее
				if (this.T.knock) { const near = clamp01(1 - dist / 12); game.shake = Math.min(1, game.shake + near * 0.4); Sfx.thud(); }
				// скребер бьёт по земле: всех вокруг (кроме цели) — вполсилы и с ног
				if (this.T.slam) game.slam(this, p);
			}
			// во время выпада тело немного продвигается вперёд
			if (this.timer < 0.9) this.root.rotation.y = turnTowards(this.root.rotation.y, angleTo(this.pos, p.pos), dt * 4);
			if (this.timer > a.getClip().duration / this.atkTs - 0.15) this.state = 'chase';
			return true;
		}

		// бросок с захватом (клип Tripo) начинается издалека: шаг-рывок покрывает остаток (стопы не едут)
		const reach = this.T.range + (this.tz?.lunge ? Math.min(0.8, this.tz.lunge.d * this.scale * 0.6) : 0);
		if (p.alive && dist < reach && this.state !== 'attack' && (dist < this.T.range + 0.4 || lineOfSight(this.pos, p.pos))) {
			this.state = 'attack';
			this.timer = 0;
			this.hitDone = false;
			this.charging = 0;
			this.play(this.T.attack ?? 'Attack', { once: true, fade: 0.12, restart: true, timeScale: this.atkTs });
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
		// цель далеко сбоку или за спиной — сначала разворот на месте (клип Turn: ноги переступают), потом ход
		if (this.actions.Turn && !charging) {
			const want = Math.atan2(dir.x, dir.z), off = wrapAngle(want - this.root.rotation.y);
			// своё поле pivoting: turning читает Actor.play (подмена стойки клипом переступания у людей)
			if (Math.abs(off) > (this.pivoting ? 0.3 : 1.75)) {
				this.pivoting = true;
				const k = POSTURE[this.type].turn * (1 + 0.25 * (game.rage ?? 0)), rate = this.tz.turn * k;
				this.root.rotation.y = turnTowards(this.root.rotation.y, want, rate * dt);
				this.play('Turn', { fade: 0.15, timeScale: k });
				resolveCollisions(this.pos, this.radius, level.colliders);
				return true;
			}
			this.pivoting = false;
		}
		if (charging) {
			// на рывке несётся туда, куда смотрит, и лишь медленно доворачивает
			this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 1.6);
			dir.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
		}
		let speed = (charging ? this.T.charge : this.T.speed * this.speedVar) * (1 + 0.35 * (game.rage ?? 0)); // в кисляк — быстрее
		// бег рывками: скорость (и темп клипа) то прибавляет, то проседает — неровно, у каждого свой ритм
		const lurch = this.tz ? POSTURE[this.type].lurch : 0;
		if (lurch && !charging) {
			this.lurchPh += dt * (4.2 + 1.8 * Math.sin(this.lurchPh * 0.37));
			speed *= 1 + lurch * Math.sin(this.lurchPh) * (0.6 + 0.4 * Math.sin(this.lurchPh * 0.53));
		}
		this.pos.addScaledVector(dir, speed * dt);
		if (!charging) this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 6);
		const move = charging ? 'Charge' : this.actions[this.move] ? this.move : 'Walk';
		this.play(move, { timeScale: speed / (this.gait[move] * this.strideScale) });
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
 * Часовой базы (на вышке, в пулемётном гнезде, у ворот): стоит на месте и бьёт заражённых в своей дальности
 * (spec.sentry: range, cooldown — пауза между выстрелами, burst — патронов в очереди). На вышке видит поверх
 * препятствий, на земле — только если цель на виду.
 */
class Sentry extends Npc {
	constructor(spec) {
		super(spec);
		this.cfg = spec.sentry;
		// часового можно ранить (налёт муров или внешников на базу): выбыл — до следующего прихода на базу;
		// наёмник на посту ранен по-настоящему (его здоровье — в отряде), убит — погиб
		this.merc = spec.merc ? game.merc(spec.merc) : null;
		this.alive = true;
		this.maxHp = this.merc ? mercMaxHp(this.merc) : 150;
		this.hp = this.merc ? this.merc.hp : this.maxHp;
		this.radius = 0.38;
		this.scale = 1;
		this.gunId = spec.gun;
		this.W = WEAPONS[spec.gun];
		this.gunObj = this.model.getObjectByName('GripR')?.children.at(-1);
		this.cool = Math.random();
		this.burstLeft = 0;
	}

	/** Попадание налётчика: ранен; убит — выбыл (наёмник на посту — погиб). */
	damage(dmg, from) {
		if (!this.alive) return;
		this.hp -= dmg;
		this.hitFlash?.();
		if (this.merc) this.merc.hp = Math.max(0, this.hp);
		game.blood(this.pos.clone().setY(1.2 + this.pos.y), 6, from ? new THREE.Vector3().subVectors(this.pos, from).setY(0).normalize() : new THREE.Vector3(0, 0, 1));
		if (this.hp > 0) return;
		this.alive = false;
		this.play('Death', { once: true, fade: 0.1 });
		Sfx.death('human', game.ear(this.pos));
		if (this.merc) {
			game.roster = game.roster.filter((m) => m !== this.merc);
			game.syncGuards();
			game.banner(`${MERCS[this.merc.id].name} погиб`, 'Убит на посту, защищая базу');
		} else game.toast('Часовой базы выбыл — ранен', 'warn');
	}

	hurt(dmg, from) { this.damage(dmg, from); }

	update(dt) {
		this.model.visible = inView(this.pos);
		if (this.model.visible) Actor.prototype.update.call(this, dt);
		if (!this.alive) return;
		if ((this.scanT = (this.scanT ?? 0) - dt) <= 0) {
			this.scanT = 0.4;
			const high = this.pos.y > 1, r = this.cfg.range;
			let best = null, bd = r;
			for (const e of game.bandits.length ? [...game.enemies, ...game.bandits] : game.enemies) {
				if (!e.alive || (e.faction && !game.hostile(e))) continue;
				const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
				if (d < bd && (high || lineOfSight(this.pos, e.pos))) { bd = d; best = e; }
			}
			this.target = best;
		}
		const t = this.target;
		if (!t?.alive) {
			this.root.rotation.y = turnTowards(this.root.rotation.y, this.ry0, dt * 2);
			if (this.current !== 'IdleRifle' && (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning())) this.play('IdleRifle', { fade: 0.3 });
			return;
		}
		this.root.rotation.y = turnTowards(this.root.rotation.y, angleTo(this.pos, t.pos), dt * 6);
		if ((this.cool -= dt) > 0) { if (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning()) this.play('AimRifle', { fade: 0.2 }); return; }
		const W = this.W;
		this.burstLeft = this.burstLeft > 0 ? this.burstLeft - 1 : (this.cfg.burst ?? 1) - 1;
		this.cool = this.burstLeft > 0 ? W.auto : this.cfg.cooldown + Math.random() * 0.4;
		this.play('ShootRifle', { once: true, fade: 0.04, restart: true });
		Sfx.gun(this.gunId, shotKind(W), game.ear(this.pos));
		if (this.gunObj?.userData.muzzle) fireShot(this, W, this.gunObj, t, { accuracy: 0.8 });
		else byWho(this, () => t.damage(W.damage * 0.8, this.pos, 0.3));
	}
}

/**
 * Наёмник: идёт за героем (сзади слева или справа), сам выбирает цель и стреляет из своего постоянного оружия;
 * перезаряжается из своего запаса патронов. Сам не лечится — нужен живчик от героя (или медик отряда).
 * Управлять им нельзя: в отряде он ходит за героем, а в стабе — стоит у своей койки в комнате героя; снарядить
 * (патроны, живчик) и взять с собой можно только там. Кончились патроны — отбиться нечем: первая же атака
 * заражённого для него последняя.
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
		// своё место: койка в комнате героя (в стабе) или место у казармы на базе
		this.home = game.homeSpot(state);
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
	/** Полное здоровье — по званию (game/mercs.js mercMaxHp). */
	get maxHp() { return mercMaxHp(this.state); }
	/** Звание: точность выше на RANK_BONUS.acc за ступень, перезарядка короче на RANK_BONUS.reload. */
	get rank() { return rankOf(this.state); }

	/** Патронов нет ни в магазине, ни в запасе: отбиться нечем. */
	get dry() { return this.state.mag <= 0 && this.state.ammo <= 0; }

	/** Точка в строю: первые двое — сзади-слева и сзади-справа, третий и четвёртый — шире и дальше; снайпер — дальше, медик — ближе (по классу). */
	spot() {
		const p = game.player, row = this.slot >> 1, side = this.slot % 2 ? 1 : -1;
		const a = p.root.rotation.y + Math.PI + side * (0.65 + row * 0.5), k = this.C.keep + row * 1.3;
		return tmpV2.set(p.pos.x + Math.sin(a) * k, 0, p.pos.z + Math.cos(a) * k);
	}

	/** Поставить рядом с героем (приход в локацию, отстал). */
	place() {
		const s = this.spot();
		this.pos.set(s.x, 0, s.z);
		resolveCollisions(this.pos, this.radius, level.colliders);
		this.root.rotation.y = game.player.root.rotation.y;
	}

	/** Пуля мура — тот же удар (fireShot зовёт damage). */
	damage(dmg, from, knock) { this.hurt(dmg, from, knock); }

	hurt(dmg, from, knock = 0.2) {
		if (!this.alive) return;
		this.state.hp -= dmg;
		this.hitFlash();
		if (from) { tmpV.subVectors(this.pos, from).setY(0).normalize().multiplyScalar(Math.min(knock, 1)); this.pos.add(tmpV); resolveCollisions(this.pos, this.radius, level.colliders); }
		if (this.state.hp <= 0) {
			this.state.hp = 0;
			this.alive = false;
			this.play('Death', { once: true, fade: 0.1 });
			game.mercDied(this, this.dry);
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
			// цель держится, пока жива, видна и в дальности; другая — только если ближе на 40 % (иначе в толпе боец
			// вертелся всем телом от цели к цели — до 800° за 6 с)
			const next = this.pickTarget(W.range), cur = this.target; // та же дальность, что у героя с этим оружием
			const dist = (a) => Math.hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z);
			const keep = cur?.alive && (!cur.faction || game.hostile(cur)) && dist(cur) < W.range + 1 && lineOfSight(this.pos, cur.pos);
			this.target = keep && !(next && next !== cur && dist(next) < dist(cur) * 0.6) ? cur : next;
		}
		// заражённый прёт и уже близко — отходим, не прекращая огня: лицом к нему, шагом назад в прицеле, к герою
		const close = this.threat(C.retreat ?? 3);
		const t = close ?? this.target;
		const follow = !close && dP > (t ? 12 + C.keep - 2.3 : C.keep + 1.1);
		let shooting = false;
		if (t && !follow) {
			shooting = true;
			this.root.rotation.y = turnTowards(this.root.rotation.y, angleTo(this.pos, t.pos), dt * (close ? 12 : 8));
			const facing = Math.abs(((angleTo(this.pos, t.pos) - this.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35;
			// пулемётчик сначала встаёт и упирает приклад; пятясь — бьёт от бедра
			const ready = !C.plant || this.planted > 0.45 || !!close;
			if (st.mag <= 0) {
				if (st.ammo > 0 && this.reloading <= 0) this.startReload();
				else if (st.ammo <= 0 && !this.warned) { this.warned = true; game.toast(`${this.def.name}: патроны кончились — без них не отобьётся!`, 'warn'); }
			} else if (this.cooldown <= 0 && this.reloading <= 0 && facing && ready) this.fire(t);
		}
		// строй: держится сзади героя; во время стрельбы стоит
		const s = this.spot();
		const dS = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
		// отход: прочь от заражённого с уклоном к герою, в обход стен; некуда — стоит и стреляет
		const back = close ? this.retreatDir(close, p, dP) : null;
		if (back || (!close && ((!shooting && dS > 0.9) || follow))) {
			let dir = back;
			if (!dir) dir = lineOfSight(this.pos, s) ? tmpV.set(s.x - this.pos.x, 0, s.z - this.pos.z).normalize() : game.flowDir(this.pos);
			dir ??= tmpV.set(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z).normalize();
			const run = !back && (dP > 6 || dS > 4);
			// пятится шагом в прицеле (бегун всё равно догонит — но под огнём), догоняет героя бегом
			const speed = back ? 2.1 : (run ? 4.6 : Math.min(1.7, 0.6 + dS)) * (C.plant ? 0.88 : 1); // с пулемётом — тяжелее
			this.walk(dir, speed, run, !shooting, dt);
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

	/** Заражённый, который прёт на бойца и уже ближе r (на виду): от него отходят, стреляя. Люди (муры) — не в счёт. */
	threat(r) {
		// тот же, что прошлый раз, пока он ближе r × 1,3 и новый не ближе вдвое — иначе двое у бойца дёргали корпус туда-сюда
		const prev = this.lastThreat;
		const dPrev = prev?.alive && prev.state !== 'idle' ? Math.hypot(prev.pos.x - this.pos.x, prev.pos.z - this.pos.z) : Infinity;
		let best = null, bd = r;
		for (const e of game.enemies) {
			if (!e.alive || e.state === 'idle') continue;
			const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
			if (d < bd && lineOfSight(this.pos, e.pos)) { bd = d; best = e; }
		}
		if (best && best !== prev && dPrev < r * 1.3 && bd > dPrev * 0.5) best = prev;
		else if (!best && dPrev < r * 1.3) best = prev;
		this.lastThreat = best;
		return best;
	}

	/**
	 * Куда пятиться от заражённого: прочь от него, к герою (далеко от героя — сильнее к нему), в обход стен и машин —
	 * пробует отклонения ±35°, ±70°, ±100°; всё занято — null (стоит и стреляет).
	 */
	retreatDir(threat, p, dP) {
		let bx = this.pos.x - threat.pos.x, bz = this.pos.z - threat.pos.z;
		const bl = Math.hypot(bx, bz) || 1, k = dP > 8 ? 1.4 : 0.4;
		bx = bx / bl + ((p.pos.x - this.pos.x) / (dP || 1)) * k;
		bz = bz / bl + ((p.pos.z - this.pos.z) / (dP || 1)) * k;
		const base = Math.atan2(bx, bz);
		for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.75, -1.75]) {
			const a = base + off, dx = Math.sin(a), dz = Math.cos(a);
			if (!level.nav.blockedAt(this.pos.x + dx * 1.1, this.pos.z + dz * 1.1, 0.35)) return tmpV.set(dx, 0, dz);
		}
		return null;
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
		// стреляя (корпус к цели) — шагом в прицеле, ноги по ходу: шаг вбок и назад своими шагами
		if (this.reloading <= 0 || run) this.locomote(c, speed, dir.x, dir.z, run, !turn && !run);
		else this.moving = this.legsOn; // перезарядка на ходу: клип перезарядки, ноги — по ходу (не переступают)
	}

	/**
	 * Цель по классу: обычно — ближайший видимый заражённый. Снайпер сначала снимает тех, кто вцепился
	 * в героя, потом руберов и топтунов, потом самых дальних.
	 */
	pickTarget(reach) {
		if (this.C.prefer !== 'far') return game.nearestEnemy(this.pos, reach, true);
		const p = game.player;
		let best = null, score = -Infinity;
		for (const e of [...game.enemies, ...game.bandits]) {
			if (!e.alive || (e.faction && !game.hostile(e))) continue;
			const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
			if (d > reach || !lineOfSight(this.pos, e.pos)) continue;
			const onHero = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 3;
			const sc = (onHero ? 1000 : 0) + (e.type === 'bandit' ? 200 : e.type === 'ruber' ? 150 : e.type === 'stomper' ? 100 : 0) + d;
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
					else tr.who.state.hp = Math.min(tr.who.maxHp, tr.who.state.hp + MERC_HEAL);
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
		for (const m of game.mercs) if (!who && m !== this && m.alive && m.state.out && m.state.hp < m.maxHp * 0.5) who = m;
		if (!who && st.hp < this.maxHp * 0.5) { who = this; } // и себя, если некого больше
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
		const friends = [game.player, ...game.mercs.filter((m) => m.state.out), ...game.bandits.filter((b) => !game.hostile(b))].filter((a) => a.alive);
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
			game.launchGrenade(from, th.to, 0.5 + d / 22 + 0.3, false, this);
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
			this.locomote(c, speed, dir.x, dir.z, d > 4, false);
			if (d > 0.6) resolveCollisions(this.pos, this.radius, level.colliders);
		} else {
			const dP = p ? Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : 99;
			this.root.rotation.y = turnTowards(this.root.rotation.y, p?.alive && dP < 3.5 ? angleTo(this.pos, p.pos) : h.ry, dt * 3);
			if (this.reloading <= 0) this.play(c.idle, { fade: 0.3 });
		}
		return true;
	}

	startReload() {
		const T = this.W.reload * (1 - RANK_BONUS.reload * this.rank); // бывалый перезаряжается быстрее
		this.reloading = T;
		const c = this.clips.reload;
		this.play(c, { once: true, fade: 0.1, restart: true, timeScale: this.actions[c].getClip().duration / T });
		Sfx.reload(this.def.weapon, { dur: T, n: this.W.mag - this.state.mag, ...game.ear(this.pos) });
	}

	/** Выстрел; у автоматов — короткими очередями с паузами (бережёт патроны). */
	fire(target) {
		const W = this.W;
		this.state.mag--;
		// на ходу (пятится, выходит из-за угла) — клип хода не прерываем: клип выстрела стоя заморозил бы ноги посреди шага
		if (!LOCO.test(this.current ?? '')) this.play(this.clips.shoot, { once: true, fade: 0.04, restart: true });
		Sfx.gun(this.def.weapon, shotKind(W), game.ear(this.pos));
		game.noise(this.pos, W.noise, true);
		if (W.auto < 0.2) {
			// очередь по классу: штурмовик — 3–5, пулемётчик — 9–15; потом пауза
			const [b0, b1] = this.C.burst ?? [3, 5];
			this.burstLeft = this.burstLeft > 0 ? this.burstLeft - 1 : b0 - 1 + Math.floor(Math.random() * (b1 - b0 + 1));
			this.cooldown = this.burstLeft > 0 ? W.auto : (this.C.plant ? 0.6 : 0.45) + Math.random() * 0.4;
		} else this.cooldown = W.auto + Math.random() * 0.15;
		fireShot(this, W, this.gunObj, target, { accuracy: 1 + RANK_BONUS.acc * this.rank });
		game.hudThrottled();
	}
}

// ---------- Муры ----------

/** Здоровье мура и сколько он ждёт у тайника, пока выгребает его, с. */
const MUR_HP = 110, MUR_LOOT_TIME = 1.6;
/** Раненый (меньше этой доли здоровья) уходит за укрытие перевязаться — раз за бой, через MUR_PATCH с +45 % здоровья. */
const MUR_HURT = 0.35, MUR_PATCH = 3;

/** Свободна ли клетка сетки проходимости в точке (сетка уже с отступом от стен — тело помещается). */
function navFree(x, z) {
	if (Math.abs(x) > PLAY - 1 || Math.abs(z) > PLAY - 1) return false;
	const { N, blocked, cell } = level.nav, [gx, gz] = cell(x, z);
	return !blocked[gz * N + gx];
}

/** Ближайшая к (x, z) свободная точка в пределах 3 м (или сама точка). */
function freeNear(x, z) {
	if (navFree(x, z)) return [x, z];
	for (let r = 0.5; r <= 3; r += 0.5) for (let k = 0; k < 12; k++) {
		const a = (k / 12) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
		if (navFree(px, pz)) return [px, pz];
	}
	return [x, z];
}

/** Укрытие у точки: 1 — препятствие рядом со стороны цели (выглядывает из-за угла), 0,3 — рядом сбоку или сзади. */
function coverAt(x, z, tp) {
	const a = Math.atan2(tp.x - x, tp.z - z);
	let c = 0;
	for (let k = 0; k < 6; k++) {
		const ang = a + (k < 3 ? (k - 1) : 3 + (k - 4)) * (Math.PI / 3);
		if (!navFree(x + Math.sin(ang) * 0.9, z + Math.cos(ang) * 0.9)) c = Math.max(c, k < 3 ? 1 : 0.3);
	}
	return c;
}

/**
 * Мур — бандит из стаба «Карьер» (учёт — game/murs.js). Ходит отрядом (squad): на вылазке группа (вся куча или пара)
 * идёт к цели — тайнику или выходу — по полю путей и выгребает тайники; в «Карьере» стоит на посту (post).
 * Стреляет в ближайшего, кого видит на дальность своего ствола: заражённого, героя, наёмника. Заражённые бьют
 * и его. Патроны в запасе не кончаются — только перезарядка. Ранили — помнит, откуда (aggro), и идёт туда.
 */
class Bandit extends Actor {
	constructor(pos, weapon, squad, { post = null, boss = false, patrol = null, faction = 'murs' } = {}) {
		super(assets.player, { scale: boss ? 1.08 : 1 });
		this.type = 'bandit';
		// фракция: муры (бандиты «Карьера») или внешники (game/ext.js) — у внешников броня, стреляют лучше
		this.faction = faction;
		const ext = faction === 'ext';
		this.armor = boss ? (ext ? CMD_ARMOR : BOSS_ARMOR) : ext ? EXT_ARMOR : 1;
		this.aimRange = ext ? EXT_AIM : MUR_AIM;
		this.shotMod = ext ? { accuracy: EXT_ACCURACY, damage: EXT_DAMAGE } : { accuracy: MUR_ACCURACY, damage: MUR_DAMAGE };
		this.weapon = weapon;
		this.W = WEAPONS[weapon];
		this.clips = CLIPS[this.W.anim];
		this.squad = squad;
		this.post = post;
		// главарь: крупнее, в бронежилете (BOSS_ARMOR), больше здоровья; патрульный ходит по маршруту
		this.boss = boss;
		this.hp = this.maxHp = boss ? (ext ? CMD_HP : BOSS_HP) : ext ? EXT_HP : MUR_HP;
		this.patrol = patrol ? { pts: patrol, i: 0, flows: [] } : null;
		this.grenades = boss ? 2 : Math.random() < (ext ? 0.5 : MUR_NADE_SHARE) ? 1 : 0;
		// тактика (tactics): место у укрытия, обход (flank: ±1 — с какой стороны), перевязка, паника без главаря
		this.spot = null; this.spotT = Math.random(); this.flank = 0; this.healed = false; this.recover = 0;
		this.panicT = 0; this.shoutT = 0; this.lastSeenT = 0; this.throwT = 0;
		this.alive = true;
		this.radius = 0.38;
		this.scale = 1;
		this.mag = this.W.mag;
		this.cooldown = Math.random(); this.reloading = 0; this.burstLeft = 0; this.retarget = Math.random() * 0.4; this.timer = 0;
		this.offset = new THREE.Vector2((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3); // место в куче
		// муры — тёмная разношёрстная одежда, у каждого свой оттенок; внешники — одна серо-синяя форма, командир темнее
		const tint = ext ? (boss ? new THREE.Color(0.36, 0.4, 0.46) : new THREE.Color(0.6, 0.67, 0.78).multiplyScalar(0.94 + Math.random() * 0.12))
			: boss ? new THREE.Color(0.62, 0.3, 0.26) : new THREE.Color().setHSL(Math.random(), 0.18, 0.18 + Math.random() * 0.14).multiplyScalar(2.4);
		this.model.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) if (/Cloth|Gear/.test(m.name)) m.color.multiply(tint); });
		this.gunObj = this.W.make();
		this.model.getObjectByName('GripR')?.add(this.gunObj);
		this.pos.copy(pos);
		if (post) this.root.rotation.y = post.ry ?? 0;
		this.play(this.clips.idle);
	}

	/** Попадание (пуля, осколки, удар заражённого). from — откуда: туда мур и пойдёт разбираться. */
	damage(dmg, from, knock = 0.2, ap = false) {
		if (!this.alive) return;
		const by = this.lastHitBy = HIT_BY;
		// мура задел герой, его боец или часовой, а муры с ним не в ссоре — этот отряд (в «Карьере» — весь) в бой
		if (this.faction === 'murs' && (by === game.player || by instanceof Merc || by instanceof Sentry) && !game.hostile(this)) game.provokeMurs(this, by === game.player ? 'ты напал первым' : `${by.def?.name ?? 'твой боец'} задел мура`);
		dmg *= ap ? Math.max(this.armor, 0.85) : this.armor; // бронежилет главаря, внешников (12,7 — прошивает)
		this.hp -= dmg;
		this.hitFlash();
		if (from) {
			tmpV.subVectors(this.pos, from).setY(0).normalize().multiplyScalar(Math.min(knock, 1));
			this.pos.add(tmpV);
			resolveCollisions(this.pos, this.radius, level.colliders);
			this.aggro = { pos: from.clone(), t: 10 };
			this.squad?.alarm?.(from);
			this.spotT = 0; // под огнём — сразу искать укрытие
			// стрелял герой (или наёмник) — знает, кто и откуда: бой из-за укрытия (если в ссоре с героем)
			const shooter = !game.hostile(this) ? null : isHuman(by) && by.alive ? by : [game.player, ...game.mercs].find((a) => a?.alive && Math.hypot(a.pos.x - from.x, a.pos.z - from.z) < 1.5);
			if (shooter) { this.foe = shooter; (this.lastSeen ??= new THREE.Vector3()).copy(from); this.lastSeenT = Math.max(this.lastSeenT, 8); }
		}
		game.blood(this.pos.clone().setY(1.2), 8, from ? new THREE.Vector3().subVectors(this.pos, from).setY(0).normalize() : new THREE.Vector3(0, 0, 1));
		if (this.hp <= 0) {
			this.hp = 0;
			this.alive = false;
			this.play('Death', { once: true, fade: 0.1 });
			game.banditDied(this);
		} else if (this.reloading <= 0) this.play(this.clips.hit, { once: true, fade: 0.06, restart: true });
	}

	hurt(dmg, from, knock) { this.damage(dmg, from, knock); }

	update(dt) {
		const near = inView(this.pos);
		this.model.visible = near;
		if (near) super.update(dt);
		if (!this.alive) { this.timer += dt; return this.timer < 12; }
		const W = this.W, c = this.clips;
		this.cooldown -= dt;
		if (this.panicT > 0) this.panicT -= dt;
		// бросает гранату: замах, на 0,27 с граната летит
		if (this.throwT > 0) {
			this.throwT -= dt;
			if (this.nade && (this.nade.t -= dt) <= 0) { game.launchGrenade(this.pos.clone().setY(1.7), this.nade.to, 2.4, true, this); this.nade = null; }
			return true;
		}
		if (this.aggro && (this.aggro.t -= dt) <= 0) this.aggro = null;
		if (this.alarmT != null && (this.alarmT -= dt) <= 0) { this.aggro = { pos: this.alarmPos, t: 12 }; this.alarmT = null; }
		if (this.reloading > 0 && (this.reloading -= dt) <= 0) this.mag = W.mag;
		this.retarget -= dt;
		if (this.retarget <= 0 || (this.target && !this.target.alive)) { this.retarget = 0.4; this.target = this.panicT > 0 ? null : game.banditTarget(this); }
		const t = this.target;
		if (t && isHuman(t)) {
			// запомнил человека и где видел, передал своим
			this.foe = t;
			(this.lastSeen ??= new THREE.Vector3()).copy(t.pos);
			this.lastSeenT = 12;
			if ((this.shoutT -= dt) <= 0) { this.shoutT = 3; this.squad?.alarm?.(t.pos); }
		}
		// бой с человеком: за машиной, стеной, блоками — и стрельба из-за угла (coverFight); в обходе — tactics
		if (this.foe && (!this.foe.alive || this.lastSeenT <= 0)) { this.foe = null; this.pair = null; this.phase = null; }
		// (на него бежит заражённый — сначала отстреляться: из-за укрытия — только против людей)
		if (this.foe && this.panicT <= 0 && !this.flank && (!t || t === this.foe) && this.coverFight(dt, t)) return true;
		if (t) {
			this.looting = 0;
			// укрытия с углом рядом не нашлось (или идёт в обход) — держится у укрытия на дистанции ствола
			if (isHuman(t) && !this.pair && this.tactics(dt, t)) return true;
			// стоит и стреляет: очередями, с перезарядкой
			const ang = angleTo(this.pos, t.pos);
			this.root.rotation.y = turnTowards(this.root.rotation.y, ang, dt * 7);
			const facing = Math.abs(((ang - this.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35;
			// новая цель: по человеку сначала прицеливается секунду-две, по заражённому — почти сразу
			const human = isHuman(t);
			if (t !== this.aimAt) { this.aimAt = t; this.turnT = 0; this.aimT = human ? this.aimRange[0] + Math.random() * (this.aimRange[1] - this.aimRange[0]) : 0.3; }
			this.aimT -= dt;
			// по человеку — по очереди: разом стреляют не больше MUR_SHOOTERS, отстрелялся — отдыхает и уступает
			if (human) {
				if (this.turnT > 0 && (this.turnT -= dt) <= 0) this.aimT = MUR_REST[0] + Math.random() * (MUR_REST[1] - MUR_REST[0]);
				if (!(this.turnT > 0) && this.aimT <= 0 && game.bandits.filter((b) => b !== this && b.alive && b.faction === this.faction && b.aimAt === t && b.turnT > 0).length < MUR_SHOOTERS) {
					this.turnT = MUR_TURN[0] + Math.random() * (MUR_TURN[1] - MUR_TURN[0]);
				}
			}
			const ready = this.aimT <= 0 && (!human || this.turnT > 0);
			if (this.mag <= 0 && this.reloading <= 0) this.startReload();
			else if (this.cooldown <= 0 && this.reloading <= 0 && facing && ready) this.fire(t);
			if (this.reloading > 0) { if (this.current !== c.reload) this.play(c.reload, { once: true, fade: 0.15, timeScale: this.actions[c.reload].getClip().duration / W.reload }); }
			else if (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning()) this.play(c.aim, { fade: 0.2 });
			return true;
		}
		this.turnT = 0; // цели нет — очередь стрелять другим
		// главаря убили — бежит за укрытие от героя и пережидает; перезаряжается или перевязывается в укрытии — сидит там
		if (this.panicT > 0 && this.tactics(dt, game.player)) return true;
		if (this.holdCover(dt)) return true;
		// потерял человека из виду — идёт туда, где видел; засел в 5–14 м — выкурить гранатой
		if (this.lastSeenT > 0) {
			this.lastSeenT -= dt;
			if (!this.aggro) this.aggro = { pos: this.lastSeen.clone(), t: 8, human: true };
			if (this.tryGrenade()) return true;
		}
		// главарь от своей будки далеко не уходит
		if (this.boss && this.post && this.aggro && Math.hypot(this.aggro.pos.x - this.post.x, this.aggro.pos.z - this.post.z) > 9) this.aggro = null;
		// куда идти: к цели группы (тайник, выход), по маршруту патруля или к посту; раненый — туда, откуда стреляли
		const goal = this.aggro?.pos ?? this.squad?.goalFor?.(this) ?? this.patrolGoal() ?? (this.post ? tmpV2.set(this.post.x, 0, this.post.z) : null);
		const d = goal ? Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) : 0;
		if (!goal || d < (this.post && !this.aggro ? 0.5 : 1.2)) {
			if (this.patrol && !this.aggro) { this.patrol.i = (this.patrol.i + 1) % this.patrol.pts.length; return true; }
			if (this.post && !this.aggro) this.root.rotation.y = turnTowards(this.root.rotation.y, this.post.ry ?? 0, dt * 2);
			if (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning()) this.play(c.idle, { fade: 0.3 });
			this.squad?.arrived?.(this, dt);
			return true;
		}
		let dir = lineOfSight(this.pos, goal) ? tmpV.set(goal.x - this.pos.x, 0, goal.z - this.pos.z).normalize() : this.aggro ? game.flowDir(this.pos) : this.patrol ? this.patrolStep() : this.squad?.stepFor?.(this);
		if (!dir) dir = tmpV.set(goal.x - this.pos.x, 0, goal.z - this.pos.z).normalize();
		this.avoidOthers(dir);
		// за тем, где видели человека, — шагом, осторожно; на тревогу и на выход — бегом
		const run = (!!this.aggro && !this.aggro.human) || this.squad?.hurry;
		const speed = run ? 3.8 : 1.6;
		this.pos.addScaledVector(dir, speed * dt);
		this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 8);
		this.locomote(c, speed, dir.x, dir.z, run, false);
		resolveCollisions(this.pos, this.radius, level.colliders);
		return true;
	}

	/** Не наступает на своих: dir отталкивается от муров ближе 0,8 м (нормируется). */
	avoidOthers(dir) {
		for (const o of game.bandits) {
			if (o === this || !o.alive) continue;
			const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, r = Math.hypot(dx, dz);
			if (r < 0.8 && r > 1e-4) { dir.x += (dx / r) * (0.8 - r) * 2; dir.z += (dz / r) * (0.8 - r) * 2; }
		}
		return dir.normalize();
	}

	/** Точка маршрута патруля (обходят двор по кругу), пока нет тревоги. */
	patrolGoal() {
		if (!this.patrol || this.aggro) return null;
		const [x, z] = this.patrol.pts[this.patrol.i];
		return tmpV2.set(x, 0, z);
	}

	/** Шаг к точке маршрута в обход препятствий (поле путей к каждой точке — один раз). */
	patrolStep() {
		const P = this.patrol, [x, z] = P.pts[P.i];
		return flowStep(P.flows[P.i] ??= flowFrom(x, z), this.pos);
	}

	/**
	 * Бой с человеком: держится у укрытия на дистанции своего ствола (не лезет вплотную и не стоит в чистом поле),
	 * перезаряжается и перевязывается за укрытием, по команде (flank) обходит цель сбоку. Возвращает true, пока
	 * перебегает к месту (стрелять некогда); на месте стреляет как обычно.
	 */
	tactics(dt, t) {
		const hurt = this.hp < this.maxHp * MUR_HURT && !this.healed;
		const mode = hurt || this.reloading > 0 || this.panicT > 0 ? 'hide' : 'fire';
		if (this.spot && this.spot.mode !== mode) this.spot = null;
		if ((this.spotT -= dt) <= 0) {
			this.spotT = 1.4 + Math.random() * 1.2;
			if (!this.spot || !this.spotGood(this.spot, t)) this.spot = this.findSpot(t, mode);
		}
		const s = this.spot;
		if (!s) return false;
		const dx = s.x - this.pos.x, dz = s.z - this.pos.z, dd = Math.hypot(dx, dz);
		if (dd < 0.4) {
			s.reached = true;
			if (s.flank) this.flank = 0; // обошёл
			return false;
		}
		s.reached = false;
		if ((s.t = (s.t ?? 0) + dt) > 4) { this.spot = null; return false; } // не добежал — бросает
		const sp = 3.6, dir = this.avoidOthers(tmpV.set(dx / dd, 0, dz / dd));
		this.pos.addScaledVector(dir, Math.min(dd, sp * dt));
		this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 10);
		this.locomote(this.clips, sp, dir.x, dir.z, true, false);
		resolveCollisions(this.pos, this.radius, level.colliders);
		return true;
	}

	/**
	 * Бой из-за укрытия: место H за машиной, стеной, блоками или мешками (цели оттуда не видно, укрытие — между ними)
	 * и рядом угол P, откуда цель видна. Цикл: сидит за укрытием — перезаряжается (заранее, если магазин наполовину
	 * пуст), перевязывается, ждёт очереди; выглядывает из-за угла (боком, лицом к цели), целится и даёт очередь
	 * (MUR_TURN); прячется обратно. Разом выглядывают не больше MUR_SHOOTERS. Возвращает true, пока сам ведёт кадр;
	 * false — стоит на углу и цель видна (стреляет обычным порядком) или подходящего укрытия рядом нет.
	 */
	coverFight(dt, t) {
		const foe = this.foe, seen = t === foe, c = this.clips;
		if ((this.pairT = (this.pairT ?? 0) - dt) <= 0 || (this.pair && !this.pairGood(this.pair, foe))) {
			this.pairT = 2.5 + Math.random() * 1.5;
			if (!this.pair || !this.pairGood(this.pair, foe)) {
				this.pair = this.findCover(foe);
				this.phase = 'hide';
				this.phaseT = 0.4 + Math.random() * 1.0;
				if (!this.pair) this.pairT = 1 + Math.random() * 0.5; // не нашлось — скоро снова: подойдёт ближе, найдётся
			}
		}
		const P = this.pair;
		if (!P) return false;
		if (!seen) this.lastSeenT -= dt; // за укрытием не видно — помнит недолго
		const hurt = this.hp < this.maxHp * MUR_HURT && !this.healed;
		const out = this.phase === 'out' && !hurt && this.reloading <= 0;
		const gx = out ? P.px : P.hx, gz = out ? P.pz : P.hz;
		const dx = gx - this.pos.x, dz = gz - this.pos.z, dd = Math.hypot(dx, dz);
		const face = angleTo(this.pos, foe.pos);
		if (dd > 0.25) {
			// к углу и обратно за укрытие — приставным шагом в прицеле, лицом к цели (ноги — своими шагами вбок и назад);
			// издалека к укрытию — бегом
			const near = dd < 1.8, sp = near ? 1.4 : 3.6, dir = this.avoidOthers(tmpV.set(dx / dd, 0, dz / dd));
			this.pos.addScaledVector(dir, Math.min(dd, sp * dt));
			this.root.rotation.y = turnTowards(this.root.rotation.y, near ? face : Math.atan2(dir.x, dir.z), dt * 10);
			this.locomote(c, sp, dir.x, dir.z, !near, near);
			resolveCollisions(this.pos, this.radius, level.colliders);
			if ((P.stuck = (P.stuck ?? 0) + dt) > 5) { this.pair = null; this.pairT = 1; }
			P.at = null;
			return true;
		}
		P.stuck = 0;
		if (out) {
			// на углу: сразу смотрит, видна ли цель (полсекунды на то, чтобы заметить); стреляет; очередь вышла,
			// магазин пуст или цель ушла — обратно за укрытие
			if (P.at == null) { P.at = game.time; this.retarget = 0; }
			if ((!seen && game.time - P.at > 0.5) || this.mag <= 0 || !(this.turnT > 0)) { this.phase = 'hide'; this.phaseT = 1.2 + Math.random() * 1.6; P.at = null; return true; }
			if (!seen) { this.root.rotation.y = turnTowards(this.root.rotation.y, face, dt * 10); this.play(c.aim, { fade: 0.15 }); return true; }
			return false;
		}
		// за укрытием: лицом к цели; перезарядка (заранее, если магазин наполовину пуст), перевязка, ждёт очереди
		this.root.rotation.y = turnTowards(this.root.rotation.y, face, dt * 6);
		const idle = () => { if (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning()) this.play(c.aim, { fade: 0.25 }); return true; };
		if (this.reloading <= 0 && this.mag < this.W.mag * 0.5) this.startReload();
		if (this.reloading > 0) {
			if (this.current !== c.reload) this.play(c.reload, { once: true, fade: 0.15, timeScale: this.actions[c.reload].getClip().duration / this.W.reload });
			return true;
		}
		if (hurt) {
			if ((this.recover += dt) < MUR_PATCH) return idle();
			this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.45);
			this.healed = true;
		}
		// долго не видно цели — выкурить гранатой
		if (!seen && this.lastSeenT < 9 && this.tryGrenade()) return true;
		if ((this.phaseT -= dt) <= 0 && game.bandits.filter((b) => b !== this && b.alive && b.faction === this.faction && b.foe === foe && b.phase === 'out').length < MUR_SHOOTERS) {
			this.phase = 'out';
			this.aimAt = foe;
			this.aimT = 0.6 + Math.random() * 0.4; // ведёт цель из-за укрытия — на углу целится недолго
			this.turnT = MUR_TURN[0] + Math.random() * (MUR_TURN[1] - MUR_TURN[0]);
		}
		return idle();
	}

	/** Пара «укрытие + угол» ещё годится: из укрытия цели не видно, с угла видно и достаёт, цель не вплотную. */
	pairGood(P, foe) {
		const R = this.W.range, d = Math.hypot(foe.pos.x - P.px, foe.pos.z - P.pz);
		return d < R * 0.95 && d > Math.min(R * 0.3, 3) && !lineOfSight({ x: P.hx, z: P.hz }, foe.pos) && lineOfSight({ x: P.px, z: P.pz }, foe.pos);
	}

	/**
	 * Укрытие с углом: места H рядом (16 направлений × 4 расстояния и где стоит), откуда цели не видно и укрытие
	 * (машина, стена, блок) — между ними, вплотную; для каждого — угол P в 0,9–2,4 м, откуда цель видна. Лучше —
	 * ближе к себе, на ~70 % дальности ствола, угол поближе к укрытию; не толпятся. null — укрыться негде.
	 */
	findCover(foe) {
		const R = this.W.range, tp = foe.pos, leash = this.boss && this.post ? this.post : null;
		let best = null;
		const tryH = (hx, hz, travel) => {
			if (!navFree(hx, hz) || (travel > 0 && !lineOfSight(this.pos, { x: hx, z: hz }))) return;
			if (leash && Math.hypot(hx - leash.x, hz - leash.z) > 8) return;
			const d = Math.hypot(tp.x - hx, tp.z - hz);
			if (d > R * 1.1 || d < Math.min(R * 0.35, 4) || lineOfSight({ x: hx, z: hz }, tp)) return;
			if (coverAt(hx, hz, tp) < 1) return; // укрытие вплотную со стороны цели
			let v = -travel / 7 - Math.abs(d - R * 0.7) / R * 1.2;
			for (const o of game.bandits) {
				if (o === this || !o.alive) continue;
				const ox = o.pair?.hx ?? o.pos.x, oz = o.pair?.hz ?? o.pos.z;
				if (Math.hypot(ox - hx, oz - hz) < 1.6) v -= 1;
			}
			if (best && v - 0.3 <= best.v) return; // угол ищем только у тех, кто может победить
			let peek = null;
			for (const r of [0.9, 1.6, 2.4]) { // из-за середины машины — шаг к её концу
				for (let k = 0; k < 8; k++) {
					const a = (k / 8) * Math.PI * 2, px = hx + Math.sin(a) * r, pz = hz + Math.cos(a) * r;
					if (!navFree(px, pz) || !lineOfSight({ x: hx, z: hz }, { x: px, z: pz }) || !lineOfSight({ x: px, z: pz }, tp)) continue;
					if (Math.hypot(tp.x - px, tp.z - pz) > R * 0.95) continue;
					peek = [px, pz];
					break;
				}
				if (peek) break;
			}
			if (!peek) return;
			v -= Math.hypot(peek[0] - hx, peek[1] - hz) * 0.4;
			if (!best || v > best.v) best = { v, hx, hz, px: peek[0], pz: peek[1] };
		};
		tryH(this.pos.x, this.pos.z, 0);
		// кольца погуще: укрытие «вплотную» — полоса меньше метра у машины или стены
		for (const r of [1.5, 3, 4.5, 6]) for (let k = 0; k < 16; k++) {
			const a = (k / 16) * Math.PI * 2;
			tryH(this.pos.x + Math.sin(a) * r, this.pos.z + Math.cos(a) * r, r);
		}
		return best;
	}

	/** Место ещё годится: для стрельбы — цель видна и на своей дистанции; укрытие — цели оттуда не видно. */
	spotGood(s, t) {
		const see = lineOfSight(s, t.pos);
		if (s.mode === 'hide') return !see;
		const d = Math.hypot(t.pos.x - s.x, t.pos.z - s.z);
		return see && d < this.W.range * 0.95;
	}

	/**
	 * Лучшее место рядом (12 направлений × 3 расстояния; к месту — прямой путь). Для стрельбы: цель видна, дистанция
	 * ~70 % дальности ствола, рядом укрытие, в обходе — сбоку от цели; для укрытия: цели не видно (раненый — подальше).
	 * Не толпятся: чужое место ближе 1,8 м — хуже. null — и тут неплохо.
	 */
	findSpot(t, mode) {
		const R = this.W.range, tp = t.pos, far = this.flank ? [3, 6, 9] : [2.5, 4.5, 7];
		const leash = this.boss && this.post ? this.post : null; // главарь — у своей будки
		let px = 0, pz = 0;
		if (this.flank && this.flankAxis) { px = this.flankAxis.z * this.flank; pz = -this.flankAxis.x * this.flank; }
		const score = (x, z, travel) => {
			if (!navFree(x, z) || (travel > 0 && !lineOfSight(this.pos, { x, z }))) return null;
			if (leash && Math.hypot(x - leash.x, z - leash.z) > 8) return null;
			const d = Math.hypot(tp.x - x, tp.z - z), see = lineOfSight({ x, z }, tp);
			let v = -travel / 7, side = 0;
			if (mode === 'fire') {
				if (!see || d > R * 0.95 || d < Math.min(R * 0.4, 5)) return null;
				v += -Math.abs(d - R * 0.7) / R * 1.5 + coverAt(x, z, tp) * 1.2;
				if (px || pz) { side = ((x - tp.x) * px + (z - tp.z) * pz) / (d || 1); v += side * 2; }
			} else {
				if (see) return null;
				v += coverAt(x, z, tp) * 0.3 + (this.panicT > 0 || this.hp < this.maxHp * MUR_HURT ? d / R * 0.6 : 0);
			}
			for (const o of game.bandits) {
				if (o === this || !o.alive) continue;
				if (Math.hypot((o.spot?.x ?? o.pos.x) - x, (o.spot?.z ?? o.pos.z) - z) < 1.8) v -= 0.8;
			}
			return { v, side };
		};
		const here = score(this.pos.x, this.pos.z, 0);
		let best = null;
		for (const r of far) for (let k = 0; k < 12; k++) {
			const a = (k / 12) * Math.PI * 2, x = this.pos.x + Math.sin(a) * r, z = this.pos.z + Math.cos(a) * r;
			const sc = score(x, z, r);
			if (sc && (!best || sc.v > best.v)) best = { ...sc, x, z };
		}
		if (!best || (here && best.v < here.v + 0.4)) return null;
		return { x: best.x, z: best.z, mode, flank: best.side > 0.6 };
	}

	/** В укрытии: перезаряжается, перевязывается (раненый, раз за бой) или пережидает панику — с места не уходит. */
	holdCover(dt) {
		const s = this.spot, c = this.clips;
		if (!s || s.mode !== 'hide' || !s.reached) return false;
		const busy = () => { if (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning()) this.play(c.idle, { fade: 0.3 }); return true; };
		if (this.reloading > 0) {
			if (this.current !== c.reload) this.play(c.reload, { once: true, fade: 0.15, timeScale: this.actions[c.reload].getClip().duration / this.W.reload });
			return true;
		}
		if (this.hp < this.maxHp * MUR_HURT && !this.healed) {
			if ((this.recover += dt) < MUR_PATCH) return busy();
			this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.45);
			this.healed = true;
		}
		if (this.panicT > 0) return busy();
		this.spot = null;
		return false;
	}

	/** Засевшего (видели, а сейчас не видно) в 5–14 м — гранатой, если своих там нет и отряду пора (MUR_NADE_GAP). */
	tryGrenade() {
		if (!(this.grenades > 0) || this.reloading > 0 || this.panicT > 0 || game.time < (game[this.faction === 'ext' ? 'extNadeAt' : 'murNadeAt'] ?? 0)) return false;
		const p = this.lastSeen, d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
		if (d < 5 || d > 14 || !game.player.alive) return false;
		if (game.bandits.some((b) => b.alive && b.faction === this.faction && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 7)) return false;
		const boss = game.leaderOf(this.faction)?.alive, key = this.faction === 'ext' ? 'extNadeAt' : 'murNadeAt';
		game[key] = game.time + (boss ? MUR_NADE_GAP[0] : MUR_NADE_GAP[1]);
		this.grenades--;
		this.root.rotation.y = angleTo(this.pos, p);
		this.play('Melee', { once: true, fade: 0.06, restart: true, timeScale: 1.25 });
		Sfx.swing();
		this.throwT = 0.6;
		this.nade = { t: 0.27, to: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5)) };
		if (boss) game.bossShout(this.faction === 'ext' ? 'Граната! Выкурить его!' : 'Гранату ему!', this.faction);
		if (Math.hypot(p.x - game.player.pos.x, p.z - game.player.pos.z) < 10) game.toast('Граната! Беги из красного круга', 'warn');
		return true;
	}

	startReload() {
		this.reloading = this.W.reload;
		Sfx.reload(this.weapon, { dur: this.W.reload, n: this.W.mag, ...game.ear(this.pos) });
	}

	fire(target) {
		const W = this.W;
		this.mag--;
		// на ходу (пятится, выходит из-за угла) — клип хода не прерываем: клип выстрела стоя заморозил бы ноги посреди шага
		if (!LOCO.test(this.current ?? '')) this.play(this.clips.shoot, { once: true, fade: 0.04, restart: true });
		Sfx.gun(this.weapon, shotKind(W), game.ear(this.pos));
		game.noise(this.pos, W.noise);
		if (W.auto < 0.2) {
			this.burstLeft = this.burstLeft > 0 ? this.burstLeft - 1 : 2 + Math.floor(Math.random() * 3);
			this.cooldown = this.burstLeft > 0 ? W.auto : 0.9 + Math.random() * 0.7;
		} else this.cooldown = W.auto + 0.6 + Math.random() * 0.6;
		// по людям — хуже и слабее (MUR_ACCURACY, MUR_DAMAGE в game/murs.js), по заражённым — как обычно
		fireShot(this, W, this.gunObj, target, isHuman(target) ? this.shotMod : {});
	}
}

/**
 * Отряд муров на вылазке в кластере, где герой. Кучей — все к одной цели; парами — у каждой пары своя.
 * Цель — ближайший нетронутый тайник (подошли — выгребли за пару секунд), когда время вышло или тайников
 * не осталось — ближайший выход: там бойцы уходят. Ранили кого-то — поднимаются все, кто рядом.
 */
class RaidSquad {
	constructor(raid, members) {
		this.raid = raid;
		this.members = members;
		this.loot = raid.loot ?? (raid.loot = {});
		this.angry = !!raid.angry; // герой напал на отряд — в бою с ним до конца вылазки (и после прихода снова)
		const size = raid.mode === 'pairs' ? 2 : members.length;
		this.groups = [];
		for (let i = 0; i < members.length; i += size) this.groups.push({ members: members.slice(i, i + size), goal: null, flow: null, lootT: 0 });
		for (const g of this.groups) for (const b of g.members) b.group = g;
		this.leaving = false;
	}

	/** Цель группы: ближайший к ней тайник, к которому не идёт другая группа; нет — выход. */
	pick(g) {
		const alive = g.members.filter((b) => b.alive);
		if (!alive.length) return;
		const cx = alive.reduce((s, b) => s + b.pos.x, 0) / alive.length, cz = alive.reduce((s, b) => s + b.pos.z, 0) / alive.length;
		const taken = new Set(this.groups.map((o) => o !== g && o.goal?.c).filter(Boolean));
		let best = null, bd = Infinity;
		if (!this.leaving) {
			for (const c of level.containers) {
				if (c.searched || taken.has(c)) continue;
				const d = Math.hypot(c.ax - cx, c.az - cz);
				if (d < bd) { bd = d; best = c; }
			}
		}
		if (best) g.goal = { x: best.ax, z: best.az, c: best };
		else {
			const e = level.exits.reduce((a, b) => (Math.hypot(a.spawn.x - cx, a.spawn.z - cz) < Math.hypot(b.spawn.x - cx, b.spawn.z - cz) ? a : b));
			g.goal = { x: e.spawn.x, z: e.spawn.z, exit: true };
			this.hurry = true;
		}
		g.flow = flowFrom(g.goal.x, g.goal.z, g.flow);
		g.lootT = 0;
	}

	goalFor(b) {
		const g = b.group;
		if (!g.goal || (g.goal.c && g.goal.c.searched && !g.goal.mine)) this.pick(g);
		if (!g.goal) return null;
		// в куче каждый держит своё место рядом с целью; у тайника и выхода — точно к цели
		return g.members.length > 2 && !g.goal.c && !g.goal.exit ? tmpV2.set(g.goal.x + b.offset.x, 0, g.goal.z + b.offset.y) : tmpV2.set(g.goal.x, 0, g.goal.z);
	}

	stepFor(b) { return b.group.flow ? flowStep(b.group.flow, b.pos) : null; }

	/** Боец дошёл до цели: у тайника — выгребает, у выхода — уходит из кластера. */
	arrived(b, dt) {
		const g = b.group;
		if (!g.goal) return;
		if (g.goal.exit) { b.gone = true; return; }
		const c = g.goal.c;
		if (!c || c.searched) { this.pick(g); return; }
		if ((g.lootT += dt) < MUR_LOOT_TIME) return;
		for (const [kind, n] of c.items ?? []) this.loot[kind] = (this.loot[kind] ?? 0) + n;
		c.items = [];
		c.searched = true;
		c.spark.visible = false;
		g.goal.mine = true;
		this.pick(g);
	}

	/** Кого-то ранили: на звук идут все, кто ближе 25 м. */
	alarm(from) {
		for (const b of this.members) if (b.alive && !b.aggro && Math.hypot(b.pos.x - from.x, b.pos.z - from.z) < 25) b.aggro = { pos: from.clone(), t: 8 };
	}

	update() {
		// время вылазки вышло или кластер скоро перезагрузится (кислый запах) — все к выходам
		const sour = timeLeft(game.world, game.loc) < LEAVE_BEFORE;
		if (!this.leaving && (game.world.time >= this.raid.end || sour)) {
			this.leaving = true;
			for (const g of this.groups) this.pick(g);
			if (sour) game.toast('Муры уходят из кластера — чуют перезагрузку', 'warn');
		}
		for (const b of this.members) {
			if (!b.gone || b.left) continue;
			b.left = true;
			b.dispose();
			game.bandits = game.bandits.filter((o) => o !== b);
		}
		if (this.members.every((b) => !b.alive || b.left)) game.finishRaid();
	}
}

/**
 * Гарнизон «Карьера»: на постах — до 14 муров, остальные в казарме; убили часового — из дверей казармы
 * выходит следующий, пока муры не кончатся. Заметил героя один — вся стая идёт на звук.
 */
class Garrison {
	/** faction — чей гарнизон: муры «Карьера» или внешники форпоста (у них свои стволы). */
	constructor(reserve, door, faction = 'murs') {
		this.reserve = reserve;
		this.door = door;
		this.faction = faction;
		this.guns = faction === 'ext' ? EXT_GUNS : MUR_GUNS;
		this.t = 0;
		this.alerted = null;
	}

	/** Тревога расходится по «Карьеру» постепенно: кто ближе к месту — идёт сразу, дальние — позже. */
	alarm(from) {
		// первая тревога — сирена над «Карьером» и окрик главаря
		if (!this.alerted) { Sfx.siren(); game.bossShout(this.faction === 'ext' ? 'Контакт! Огонь на поражение!' : 'Тревога! Валите его!', this.faction); }
		this.alerted = from.clone();
		for (const b of game.bandits) {
			if (!b.alive || b.aggro || b.alarmT != null) continue;
			b.alarmT = Math.hypot(b.pos.x - from.x, b.pos.z - from.z) * 0.15;
			b.alarmPos = from.clone();
		}
	}

	update(dt) {
		// кто-то видит героя — поднимает всех
		if (game.bandits.some((b) => b.alive && b.target === game.player)) this.alarm(game.player.pos);
		const alive = game.bandits.filter((b) => b.alive && !b.boss && b.faction === this.faction).length;
		if (this.reserve <= 0 || alive >= 14 || (this.t -= dt) > 0) return;
		this.t = this.alerted ? 5 : 8;
		this.reserve--;
		const b = new Bandit(new THREE.Vector3(this.door.x + (Math.random() - 0.5), 0, this.door.z), this.guns[Math.floor(Math.random() * this.guns.length)], this, { faction: this.faction });
		if (this.alerted) b.aggro = { pos: game.hostile(b) ? game.player.pos.clone() : this.alerted.clone(), t: 12 };
		else b.post = { x: this.door.x + (Math.random() - 0.5) * 6, z: this.door.z + 3 + Math.random() * 3, ry: Math.random() * 6 };
		game.bandits.push(b);
	}
}

/**
 * Группа внешников на охоте в кластере, где герой. Они чуют иммунных: идут туда, где герой, — к точке рядом с ним
 * (раз в несколько секунд уточняют), по дороге бьют всех, кто попадётся: заражённых, муров, героя, наёмников.
 * Время охоты вышло — к ближайшему выходу, там уходят.
 */
class HuntSquad {
	constructor(hunt, members) {
		this.hunt = hunt;
		this.members = members;
		this.goal = null; this.flow = null; this.goalT = 0;
		this.leaving = false;
	}

	/** Новая цель: точка в 4–10 м от героя (точно не знают, где он), на свободном месте; уходят — ближайший выход. */
	pick() {
		const alive = this.members.filter((b) => b.alive && !b.left);
		if (!alive.length) return;
		if (this.leaving || !game.player?.alive) {
			if (this.goal?.exit) { this.goalT = 30; return; } // уже идут к выходу
			const cx = alive[0].pos.x, cz = alive[0].pos.z;
			const e = level.exits.reduce((a, b) => (Math.hypot(a.spawn.x - cx, a.spawn.z - cz) < Math.hypot(b.spawn.x - cx, b.spawn.z - cz) ? a : b));
			this.goal = { x: e.spawn.x, z: e.spawn.z, exit: true };
		} else {
			const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 6, p = game.player.pos;
			const [x, z] = freeNear(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r);
			this.goal = { x, z };
		}
		this.flow = flowFrom(this.goal.x, this.goal.z, this.flow);
		this.goalT = 8 + Math.random() * 4;
	}

	goalFor(b) {
		if (!this.goal) this.pick();
		if (!this.goal) return null;
		return this.goal.exit ? tmpV2.set(this.goal.x, 0, this.goal.z) : tmpV2.set(this.goal.x + b.offset.x * 0.6, 0, this.goal.z + b.offset.y * 0.6);
	}

	stepFor(b) { return this.flow ? flowStep(this.flow, b.pos) : null; }

	/** Уходят с охоты — бегом; ищут — шагом, осторожно. */
	get hurry() { return this.leaving; }

	/** Дошёл: у выхода — уходит; у точки поиска — ждёт новую. */
	arrived(b) { if (this.goal?.exit) b.gone = true; }

	/** Кого-то из группы ранили — идут на звук все. */
	alarm(from) { for (const b of this.members) if (b.alive && !b.aggro) b.aggro = { pos: from.clone(), t: 8 }; }

	update(dt) {
		// охота кончилась или кластер скоро перезагрузится — к выходу бегом
		const sour = timeLeft(game.world, game.loc) < LEAVE_BEFORE;
		if (!this.leaving && (game.world.time >= this.hunt.end || sour)) {
			this.leaving = true;
			this.pick();
			if (sour) game.toast('Внешники уходят из кластера — чуют перезагрузку', 'warn');
		}
		if ((this.goalT -= dt) <= 0) this.pick();
		for (const b of this.members) {
			if (!b.gone || b.left) continue;
			b.left = true;
			b.dispose();
			game.bandits = game.bandits.filter((o) => o !== b);
		}
		if (this.members.every((b) => !b.alive || b.left)) game.finishHunt();
	}
}

/**
 * Налёт муров или внешников на базу героя (месть за главаря, за пленных или набег за запасами): отряд выходит из мути
 * и бежит к центру базы (с воротами — через них), по дороге бьёт часовых, героя, наёмников. Всех положили — налёт
 * отбит; продержались 4 минуты — уходят с добычей.
 */
class AssaultSquad extends HuntSquad {
	constructor(raid, members) {
		super(raid, members);
		this.raid = raid;
	}

	pick() {
		const alive = this.members.filter((b) => b.alive && !b.left);
		if (!alive.length) return;
		if (this.leaving) { super.pick(); return; }
		// к терминалу, а если герой на базе — к нему
		const p = game.player?.alive && Math.max(Math.abs(game.player.pos.x), Math.abs(game.player.pos.z)) < 32 ? game.player.pos : { x: 0, z: 4 };
		const [x, z] = freeNear(p.x + (Math.random() - 0.5) * 6, p.z + (Math.random() - 0.5) * 6);
		this.goal = { x, z };
		this.flow = flowFrom(x, z, this.flow);
		this.goalT = 6 + Math.random() * 4;
	}

	get hurry() { return true; }

	update(dt) {
		if (!this.leaving && game.world.time >= this.hunt.end) { this.leaving = true; this.pick(); }
		if ((this.goalT -= dt) <= 0) this.pick();
		for (const b of this.members) {
			if (!b.gone || b.left) continue;
			b.left = true;
			b.dispose();
			game.bandits = game.bandits.filter((o) => o !== b);
		}
		if (this.members.every((b) => !b.alive || b.left)) game.finishAssault(this);
	}
}

// ---------- Игра ----------
const game = {
	barrels: [], // бочки с горючим текущей локации (FuelBarrel)
	marks, // следы боя текущей локации (game/marks.js)
	time: 0, shake: 0, kills: 0, state: 'menu', paused: false,
	bag: { ...START_BAG },
	kit: startKit(),
	world: newWorld(),
	loc: 'zarechny', from: null,
	icons: {},
	enemies: [], pickups: [], fx: [], npcs: [], mercs: [],
	bandits: [], raidSquad: null, garrison: null, // муры: отряд на вылазке здесь или гарнизон «Карьера» (и форпоста внешников)
	huntSquad: null, extBoss: null, // внешники: группа на охоте здесь, командир форпоста
	perks: { maxHp: 100 }, // что даёт съеденная чёрная жемчужина (навсегда)
	roster: [], // нанятые наёмники: { id, hp, mag, ammo, out } — out: идёт с героем, иначе ждёт в комнате в стабе
	/** Отряд — кто идёт с героем. */
	get party() { return this.roster.filter((m) => m.out); },
	/** Герой в стабе (там его комната с наёмниками). */
	get inStab() { return !!level?.room; },
	/** Герой в своей комнате в стабе: только здесь бойцов снаряжают и берут с собой. */
	get inRoom() { return !!level?.room && !!this.player && level.room.contains(this.player.pos); },
	player: null,
	flow: null, flowTimer: 0,
	exitArmed: false, warnStage: 0,
	input: new Input(),

	/** Новая игра: свежий иммунный в Заречном, до перезагрузки кластера 10 минут. */
	newGame() {
		clearSave();
		this.world = newWorld();
		this.bag = { ...START_BAG };
		this.kit = startKit();
		this.stash = newStash();
		this.roster = [];
		this.perks = { maxHp: 100 };
		this.kills = 0;
		this.begin();
		this.enter('zarechny', undefined);
		this.banner('Кластер «Заречный»', `Ты в Улье. Кластер перезагрузится через ${approx(timeLeft(this.world, 'zarechny'))} — обыщи дома и уходи к стабу по трассе на восток`);
	},

	/** Продолжить с сохранения. */
	continueGame() {
		const s = migrateSave(loadGame());
		if (!s) { this.newGame(); return; }
		this.world = normalizeWorld(s.world);
		this.bag = { ...START_BAG, ...s.bag };
		this.kit = normalizeKit(s.kit);
		this.stash = normalizeStash(s.stash);
		this.perks = { maxHp: 100, ...s.perks };
		// старые сохранения: был только отряд — все в нём идут с героем
		this.roster = (s.roster ?? (s.party ?? []).map((m) => ({ ...m, out: true }))).filter((m) => MERCS[m.id] && m.hp > 0).slice(0, ROOM_BEDS + BASE_BEDS.at(-1));
		// места — по дому (койка в комнате стаба или место на базе); занятое другим — ближайшее свободное
		this.roster.forEach((m, i) => {
			const home = this.homeOf(m), cap = home === 'base' ? BASE_BEDS.at(-1) : ROOM_BEDS;
			const taken = (b) => this.roster.some((o, j) => j < i && this.homeOf(o) === home && o.bed === b);
			if (!(m.bed >= 0 && m.bed < cap) || taken(m.bed)) m.bed = [...Array(cap).keys()].find((b) => !taken(b)) ?? 0;
		});
		this.syncGuards(); // кто на постах базы — по отряду из сохранения
		this.kills = 0;
		this.begin();
		this.enter(s.world.at, s.from ?? null);
		if (this.player && s.hp) this.player.hp = Math.max(1, s.hp);
		this.hud();
		const kind = NODES[this.loc].kind;
		this.banner(NODES[this.loc].name, kind === 'stab' ? 'Безопасно' : kind === 'murs' ? 'Логово муров — тебя заметят' : kind === 'ext' ? 'Форпост внешников — тебя заметят' : kind === 'base' ? this.baseGreeting() : `До перезагрузки ${approx(timeLeft(this.world, this.loc))}`);
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
		const raid = this.world?.murs?.raid;
		// сколько бойцов отряда уцелело — по самому отряду (после «Продолжить» отряда ещё нет: размер прежний)
		if (raid?.live) { raid.live = false; if (this.raidSquad) raid.size = this.raidSquad.members.filter((b) => b.alive && !b.left).length; }
		const hunt = this.world?.ext?.hunt;
		if (hunt?.live) { hunt.live = false; if (this.huntSquad) hunt.size = this.huntSquad.members.filter((b) => b.alive && !b.left).length; }
		for (const b of this.bandits) b.dispose();
		// налёт на базу не досмотрели (ушёл с базы) — налётчики считаются ушедшими с добычей
		if (this.assault) { const st = this.world.base; st.stock = {}; this.assault = null; }
		this.bandits = []; this.raidSquad = null; this.garrison = null; this.murBoss = null; this.huntSquad = null; this.extBoss = null;
		for (const p of this.pickups) scene.remove(p.mesh);
		for (const f of this.fx) f.dispose?.();
		particles.clear(); gore.clear(); debris.clear();
		marks.clear();
		this.enemies = []; this.pickups = []; this.fx = []; this.npcs = []; this.mercs = []; this.eliteWarned = false;
		this.searching = null;
		this.flow = null;
		// кластер после перезагрузки — другая копия: свои завалы на цикл (variant, game/changes.js)
		const variant = this.world.clusters[id]?.reloads ?? 0;
		if (level?.id !== id || level.variant !== variant || NODES[id].kind === 'base') {
			level?.dispose();
			level = buildLevel(scene, { quality: QUALITY, id, base: this.world.base, variant });
			this.level = level;
			this.planLevel();
		}
		this.barrels = level.barrels.map((b) => new FuelBarrel(b)); // целые; взорванные в этом цикле — см. populate
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
			this.player.maxHp = this.player.hp = this.heroMaxHp();
		}
		this.player.kit = this.kit;
		this.player.pos.copy(spot.pos);
		this.player.root.rotation.y = spot.ry;
		this.player.attachGear();
		camTarget.copy(spot.pos).setY(0.8);
		this.exitArmed = false;
		this.edgeHint = false;
		this.warnStage = 0;
		this.lairKills = 0;
		this.rage = 0;
		Sfx.drone?.(0);
		this.visited = new Set();
		this.inventory?.close();
		spores.density = NODES[id].kind === 'cluster' ? 1 : 0.35;
		this.updateMurs();
		if (NODES[id].kind === 'cluster') this.populate(this.world.clusters[id].saved);
		else if (NODES[id].kind === 'murs') this.populateMurs();
		else if (NODES[id].kind === 'ext') this.populateExt();
		else for (const n of level.npcs) this.npcs.push(n.sentry ? new Sentry(n) : new Npc(n));
		if (NODES[id].kind === 'base') this.baseWaveT = 150 + Math.random() * 120;
		const raid = this.world.murs.raid;
		if (raid?.at === id && NODES[id].kind === 'cluster' && !this.raidSquad) this.startLiveRaid(raid, true); // уже вышли в updateMurs — не дважды
		const hunt = this.world.ext.hunt;
		if (hunt?.at === id && NODES[id].kind === 'cluster' && !this.huntSquad) this.startLiveHunt(hunt, true);
		// задание «найди пропавшего» в этом кластере — его тело и жетон у одного из тайников
		for (const t of this.world.quests.active) if (t.kind === 'find' && t.at === id && !t.got) this.placeTag(t);
		// вылазка: кто зашёл с героем в кластер — вернувшись домой, получит опыт (XP_SORTIE); муры, нанятые на одну
		// вылазку, дома (в стабе, на базе, в «Карьере») уходят к своим
		const kind = NODES[id].kind;
		if (kind === 'cluster' || kind === 'ext') for (const st of this.party) st.sortie = true;
		if (kind === 'stab' || kind === 'base' || kind === 'murs') this.dropTempMercs('home');
		if (kind === 'stab' || kind === 'base') for (const st of this.party) if (st.sortie) { st.sortie = false; this.awardXp(st, XP_SORTIE, 'вылазка'); }
		if (kind === 'stab' || kind === 'base') this.resupplyMercs(true); // дома — патроны из казны базы
		// вернулись домой (в стаб или на базу): уцелевшие бойцы отряда, кто здесь живёт, расходятся по своим местам —
		// снова брать с собой там; живущие в другом месте идут дальше с героем
		const here = level.room ? 'stab' : level.mercSpots ? 'base' : null;
		const backSt = here ? this.party.filter((st) => this.homeOf(st) === here) : [];
		for (const st of backSt) st.out = false;
		const back = backSt.map((st) => MERCS[st.id].name);
		this.spawnMercs();
		this.placeCar(spot);
		if (back.length) this.toast(`${back.join(' и ')} — ${here === 'stab' ? `у ${back.length > 1 ? 'своих коек' : 'своей койки'} в твоей комнате` : 'на базе, у казармы'}`);
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
		const hordeHere = this.world.horde?.at === this.loc;
		if (saved) {
			// кочующая стая (h) с прошлого визита — только если она всё ещё здесь
			const list = saved.enemies.map((e) => (e.h && !hordeHere ? null : this.spawnEnemy(e.type, new THREE.Vector3(e.x, 0, e.z), e.hp)));
			saved.enemies.forEach((e, i) => {
				const me = list[i];
				if (!me) return;
				if (e.h) { me.horde = true; me.hordeLead = !!e.hl; }
				const L = list[e.lead];
				if (L?.followers) { me.leader = L; L.followers.push(me); }
			});
			if (hordeHere && !list.some((e) => e?.hordeLead) && !this.enemies.some((e) => e.alive && e.hordeLead)) this.spawnHorde(null);
			level.containers.forEach((c, i) => {
				const s = saved.containers[i];
				c.items = s ? s.items : rollLoot(c.loot, NODES[this.loc].danger ?? 1, this.loc);
				c.searched = s ? s.searched : false;
				c.spark.visible = !c.searched;
			});
			for (const p of saved.pickups) this.spawnPickup(p.kind, new THREE.Vector3(p.x, 0, p.z), p.value, { ground: p.ground });
			// кровь, дырки от пуль, гарь и взорванные бочки — как оставили (до перезагрузки кластера)
			marks.load(saved.marks);
			for (const i of saved.barrels ?? []) this.barrels[i]?.wreck();
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
		// где-нибудь в кластере, подальше от героя — место для бродячей стаи
		const anywhere = () => {
			for (let i = 0; i < 40; i++) {
				const x = (Math.random() * 2 - 1) * (PLAY - 6), z = (Math.random() * 2 - 1) * (PLAY - 6);
				if (Math.hypot(x - start.x, z - start.z) < 28) continue;
				const pos = free(x, z, 0.1);
				if (pos) return pos;
			}
			return null;
		};
		// состав — случайный на каждый цикл, по опасности кластера; стая встаёт вокруг своего вожака
		const leaders = new Map();
		for (const s of rollHorde(level.groups, NODES[this.loc].danger ?? 1, Math.random, level.half)) {
			const L = s.pack && !s.lead ? leaders.get(s.pack) : null;
			const pos = L ? free(L.pos.x, L.pos.z, 4) : s.at ? free(s.at[0], s.at[1], s.r) : anywhere();
			if (!pos) continue;
			const e = this.spawnEnemy(s.type, pos);
			if (s.lead) leaders.set(s.pack, e);
			else if (L) { e.leader = L; L.followers.push(e); }
		}
		// тайники в домах: что где лежит — заново на каждый цикл кластера
		for (const c of level.containers) {
			c.items = rollLoot(c.loot, NODES[this.loc].danger ?? 1, this.loc);
			c.searched = false;
			c.spark.visible = true;
		}
		// здесь уже побывали муры: часть заражённых перебита, часть тайников выгребена
		const mark = this.world.clusters[this.loc]?.raided;
		if (mark) this.applyMarkHere(mark);
		// здесь стоит кочующая стая (если уже пришла в updateMurs — не дважды)
		if (hordeHere && !this.enemies.some((e) => e.alive && e.hordeLead)) this.spawnHorde(null);
	},

	/** Следы вылазки муров в построенном кластере: убрать долю заражённых, выгрести долю тайников. */
	applyMarkHere(mark) {
		for (const e of this.enemies) if (e.alive && Math.random() < mark.kill) { marks.pool(e.pos, 1.6, true); e.alive = false; e.dispose(); }
		this.enemies = this.enemies.filter((e) => e.alive);
		for (const c of level.containers) if (!c.searched && Math.random() < mark.loot) { c.items = []; c.searched = true; c.spark.visible = false; }
	},

	// ---------- Муры (game/murs.js) ----------

	/** Учёт муров: пополнение, начало и конец вылазок — по времени мира. Отряд в кластер героя приходит вживую. */
	/** Строка при входе на базу: оборона, сколько построено, что накоплено. */
	baseGreeting() {
		const b = this.world.base, stock = stockText(b.stock);
		return `Твоя база: оборона ${baseDefense(b)}, построено ${b.built.length} из ${Object.keys(BUILDINGS).length}. ${stock ? `Накоплено: ${stock} — забери у терминала` : 'Постройки покупаются в терминале посреди площадки'}`;
	},

	/** Наибольшее здоровье героя: жемчуг (навсегда) и столовая на базе. */
	heroMaxHp() { return this.perks.maxHp + this.basePerks().maxHp; },

	/** Что дают постройки базы (game/base.js perks). */
	basePerks() { return basePerks(this.world?.base ?? { built: [] }); },

	/** Сколько наёмников можно взять на вылазку: 4, с казармой на базе — 6. */
	get partyMax() { return MAX_PARTY + this.basePerks().party; },

	/**
	 * База: доход построек копится, нападения, пока героя там нет (game/base.js tickBase); радиовышка — где муры,
	 * видно на карте Улья без информатора.
	 */
	updateBase() {
		const b = this.world?.base;
		if (!b) return;
		for (const ev of tickBase(b, this.world.time, NODES[this.loc]?.kind === 'base')) {
			const a = ev.attack;
			if (a) this.toast(a.held ? `На базу напали заражённые — отбились (сила ${a.power}, оборона ${a.def})` : `На базу напали — прорвались (сила ${a.power}, оборона ${a.def})${stockText(a.lost) ? `: растащили ${stockText(a.lost)}` : ''}`, a.held ? undefined : 'warn');
			// прорвались — наёмники на постах ранены, тяжело раненый погибает
			if (a && !a.held) {
				for (const st of this.roster.filter((m) => m.job?.kind === 'post')) {
					st.hp -= mercMaxHp(st) * (0.25 + Math.random() * 0.5);
					if (st.hp <= 0) { this.roster = this.roster.filter((m) => m !== st); this.toast(`${MERCS[st.id].name} погиб на посту, защищая базу`, 'warn'); }
				}
				this.syncGuards();
			}
		}
		this.resolveTrips();
		if (this.basePerks().radio && this.world.murs.raid) this.world.murs.raid.known = true;
		this.resupplyMercs();
		// экономика базы: работа жителей, генератор, содержание, беженцы, спрос, караваны (game/economy.js)
		for (const ev of tickEconomy(this.world, this.world.time, (id) => baseLevel(b, id), this.mursStance())) {
			if (ev.text) this.toast(ev.text, ev.warn ? 'warn' : undefined);
		}
	},

	/** Купить постройку в терминале: спораны — в счёт, постройка встаёт на место (локация перестраивается). */
	buyBuilding(id) {
		const b = this.world.base, B = BUILDINGS[id];
		const why = cantBuy(b, id, this.bag.spore ?? 0);
		if (why) { this.toast(`${B?.name ?? id}: ${why}`, 'warn'); return false; }
		this.bag.spore -= B.price;
		buildOnBase(b, id, this.world.time);
		if (id === 'garage') this.world.car ??= { at: 'base', fuel: CAR.tank / 2, cond: 100 }; // УАЗ на ходу, полбака
		Sfx.coins();
		this.rebuildBase();
		if (this.player) { this.player.maxHp = this.heroMaxHp(); this.player.hp = Math.min(this.player.hp, this.player.maxHp); }
		this.banner(`Построено: ${B.name}`, B.gives);
		this.hud();
		this.save();
		return true;
	},

	/** Улучшить постройку на уровень (терминал): спораны, перестройка на месте — с новыми деталями и часовыми. */
	upgradeBuilding(id) {
		const b = this.world.base, B = BUILDINGS[id];
		const why = cantUpgrade(b, id, this.bag.spore ?? 0);
		if (why) { this.toast(`${B?.name ?? id}: ${why}`, 'warn'); return false; }
		const up = B.up[baseLevel(b, id) - 1];
		this.bag.spore -= up.price;
		upgradeOnBase(b, id, this.world.time);
		Sfx.coins();
		this.rebuildBase();
		if (this.player) { const was = this.player.maxHp; this.player.maxHp = this.heroMaxHp(); this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, this.player.maxHp - was)); }
		this.banner(`${B.name}: уровень ${baseLevel(b, id)}`, up.gives);
		this.hud();
		this.save();
		return true;
	},

	/** Перестроить базу на месте (купили постройку): герой остаётся где стоял, жители — по новым постройкам. */
	rebuildBase() {
		if (NODES[this.loc]?.kind !== 'base' || !level) return;
		for (const n of this.npcs) n.dispose();
		this.npcs = [];
		level.dispose();
		level = buildLevel(scene, { quality: QUALITY, id: this.loc, base: this.world.base });
		this.level = level;
		this.planLevel();
		for (const n of level.npcs) this.npcs.push(n.sentry ? new Sentry(n) : new Npc(n));
		// встал там, где выросло здание, — к терминалу
		if (this.player && level.colliders.some((c) => { const dx = this.player.pos.x - c.x, dz = this.player.pos.z - c.z; return Math.abs(dx * c.c - dz * c.s) < c.hx + 0.3 && Math.abs(dx * c.s + dz * c.c) < c.hz + 0.3; })) this.player.pos.set(0, 0, 3);
		this.updateFlow();
	},

	/** Забрать накопленное постройками (теплица, ферма, мастерская, медпункт) — у терминала. */
	collectBase() {
		const b = this.world.base;
		const got = collectStock(b, (b.people?.length ?? 0) * WAGE * 2, RESOURCES);
		const text = stockText(got);
		if (!text) return;
		for (const [k, n] of Object.entries(got)) this.bag[k] = (this.bag[k] ?? 0) + n;
		Sfx.coins();
		this.toast(`Забрал с базы: ${text}`);
		this.hud();
		this.save();
	},

	// ---------- Экономика базы (game/economy.js) ----------

	/** Ресурсы: в рюкзаке + на складе базы (если герой на базе). */
	resHave(kind) { return (this.bag[kind] ?? 0) + (this.atBase ? this.world.base.stock[kind] ?? 0 : 0); },

	/** Сдать все ресурсы из рюкзака на склад базы (сырьё для жителей, караванов и верстака). */
	depositRes() {
		if (!this.atBase) return;
		const b = this.world.base, got = {};
		for (const r of RESOURCES) {
			const n = this.bag[r] ?? 0;
			if (n > 0) { b.stock[r] = (b.stock[r] ?? 0) + n; this.bag[r] = 0; got[r] = n; }
		}
		const text = stockText(got);
		if (!text) { this.toast('В рюкзаке ресурсов нет'); return; }
		Sfx.coins();
		this.toast(`Сдал на склад базы: ${text}`);
		this.hud();
		this.save();
	},

	/** Взять ресурс со склада базы в рюкзак (бензин — для машины, сырьё — на вылазку). */
	takeRes(kind, n = Infinity) {
		if (!this.atBase) return;
		const b = this.world.base, have = b.stock[kind] ?? 0, k = Math.min(have, n);
		if (k <= 0) return;
		b.stock[kind] = have - k;
		this.bag[kind] = (this.bag[kind] ?? 0) + k;
		this.toast(`Со склада: ${k} ${plural(k, ITEMS[kind].forms)}`);
		this.hud();
		this.save();
	},

	/** Положить свои спораны в казну базы (n — сколько; Infinity — все). */
	toTreasury(n) {
		const b = this.world.base, k = Math.min(n, this.bag.spore ?? 0);
		if (k <= 0) return;
		this.bag.spore -= k;
		b.treasury = (b.treasury ?? 0) + k;
		Sfx.coins();
		this.toast(`В казну базы: +${k} сп. (в казне ${b.treasury})`);
		this.resupplyMercs(true);
		this.hud();
		this.save();
	},

	/** Взять спораны из казны базы себе (только на базе). */
	fromTreasury(n) {
		if (!this.atBase) return;
		const b = this.world.base, k = Math.min(n, b.treasury ?? 0);
		if (k <= 0) return;
		b.treasury -= k;
		this.bag.spore = (this.bag.spore ?? 0) + k;
		Sfx.coins();
		this.toast(`Из казны базы: ${k} сп. (в казне ${b.treasury})`);
		this.hud();
		this.save();
	},

	/**
	 * Наёмники дома сами пополняют боекомплект — за счёт казны базы (герою патроны им покупать не надо): кто живёт в
	 * стабе или на базе и сейчас там (не в вылазке; на посту — тоже), а пока герой в стабе или на базе — и его отряд.
	 * Патроны — до полного (fullAmmo) по оптовой цене (80 % цены торговца), медику — перевязки, подрывнику — гранаты (KIT_FULL).
	 */
	resupplyMercs(force = false) {
		const b = this.world.base;
		if (!b || !this.roster.length) return;
		if (!force && this.world.time < (b.supplyAt ?? 0)) return;
		b.supplyAt = this.world.time + 20;
		const homeHere = NODES[this.loc]?.kind === 'stab' || NODES[this.loc]?.kind === 'base';
		const unit = (kind) => { const pk = packOf(kind); return pk ? (pk.price / pk.n) * 0.8 : 1; };
		let spent = 0, short = false;
		const who = [];
		for (const st of this.roster) {
			if (st.temp || st.job?.kind === 'trip' || (st.out && !homeHere)) continue;
			const D = MERCS[st.id], W = WEAPONS[D.weapon];
			let got = false;
			const need = fullAmmo(st.id) - (st.mag + st.ammo);
			if (need > 0) {
				const per = unit(W.ammo), can = Math.min(need, Math.floor((b.treasury ?? 0) / per));
				if (can > 0) { const cost = Math.ceil(can * per); b.treasury -= cost; spent += cost; st.ammo += can; got = true; }
				if (can < need) short = true;
			}
			for (const [field, item] of [['meds', 'medkit'], ['nades', 'grenade']]) {
				if (st[field] == null) continue;
				const lack = KIT_FULL[field] - st[field], per = unit(item) / 0.8;
				for (let i = 0; i < lack; i++) {
					if ((b.treasury ?? 0) < per) { short = true; break; }
					b.treasury -= Math.ceil(per); spent += Math.ceil(per); st[field]++; got = true;
				}
			}
			if (got) { who.push(D.name); const a = this.mercs.find((m) => m.state === st); if (a) a.warned = false; }
		}
		if (spent > 0) this.toast(`${who.join(', ')} пополнили боекомплект за счёт казны базы: −${spent} сп. (в казне ${b.treasury})`);
		if (short && this.world.time - (b.shortAt ?? -1e9) > 300) { b.shortAt = this.world.time; this.toast('Казне базы не хватает на патроны наёмникам — положи спораны в казну (терминал базы)', 'warn'); }
		if (spent > 0) { this.hudParty(); this.save(); }
	},

	/** Принять беженца жителем базы (за спораны). */
	acceptRefugee() {
		const b = this.world.base;
		if (!(b.refugees > 0)) { this.toast('Беженцев у ворот нет — приходят сами, бывает с караваном из «Полиса»', 'warn'); return; }
		if (b.people.length >= peopleCap(b, (id) => baseLevel(b, id))) { this.toast('Мест для жителей нет — улучши столовую или построй казарму', 'warn'); return; }
		if ((this.bag.spore ?? 0) < REFUGEE_PRICE) { this.toast('Не хватает споранов', 'warn'); return; }
		this.bag.spore -= REFUGEE_PRICE;
		b.refugees--;
		const p = newPerson(b);
		b.people.push(p);
		Sfx.coins();
		this.toast(`${p.name} теперь живёт на базе — поставь на работу в терминале`);
		this.hud();
		this.save();
	},

	/** Поставить жителя на работу (id постройки из WORK) или снять (job = null). */
	assignJob(pid, job) {
		const b = this.world.base, p = b.people.find((x) => x.id === pid);
		if (!p || p.job === 'caravan') return;
		if (job) {
			const W = WORK[job];
			if (!W || !b.built.includes(job)) return;
			if (workersOn(b, job) >= W.slots + (baseLevel(b, job) - 1)) { this.toast(`${W.name}: все места заняты`, 'warn'); return; }
		}
		p.job = job ?? null;
		this.save();
	},

	/** Отпустить жителя совсем. */
	releasePerson(pid) {
		const b = this.world.base, p = b.people.find((x) => x.id === pid);
		if (!p || p.job === 'caravan') return;
		b.people = b.people.filter((x) => x !== p);
		this.toast(`${p.name} ушёл с базы`);
		this.save();
	},

	/** Караван: продать со склада (mode 'sell') или купить (mode 'buy', платит герой) n штук ресурса kind на рынке market. */
	caravan(market, kind, n, mode = 'sell') {
		const b = this.world.base, M = MARKETS[market];
		if (!M || !RESOURCES.includes(kind) || !(n > 0)) return false;
		const trip = Math.round(2 * pathTime('base', market) * this.basePerks().travel);
		let r;
		if (mode === 'buy') {
			// покупает караван — за казну базы
			const cost = buyCost(this.world, market, kind, n);
			if ((b.treasury ?? 0) < cost) { this.toast(`В казне базы не хватает: нужно ${cost} сп., есть ${b.treasury ?? 0} — положи в казну в терминале`, 'warn'); return false; }
			r = sendCaravan(this.world, market, { buy: { [kind]: n } }, this.world.time, trip, this.mursStance());
			if (typeof r !== 'string') b.treasury -= cost;
		} else {
			n = Math.min(n, b.stock[kind] ?? 0);
			if (n <= 0) { this.toast('На складе этого нет', 'warn'); return false; }
			r = sendCaravan(this.world, market, { sell: { [kind]: n } }, this.world.time, trip, this.mursStance());
		}
		if (typeof r === 'string') { this.toast(`Караван: ${r}`, 'warn'); return false; }
		Sfx.coins();
		this.toast(`Караван ушёл в ${M.name}: ${mode === 'buy' ? `купить ${n} ${plural(n, ITEMS[kind].forms)}` : `продать ${n} ${plural(n, ITEMS[kind].forms)} — выручка ${r.pay} сп.`}; вернётся ${approx(r.back - this.world.time).replace('~', 'примерно через ')}`);
		this.hud();
		this.save();
		return true;
	},

	/** Верстак: сделать по рецепту id (ресурсы — из рюкзака, на базе — и со склада). */
	craft(id) {
		const R = RECIPES.find((x) => x.id === id), b = this.world.base;
		if (!R) return false;
		const lv = baseLevel(b, 'workshop');
		if (!lv) { this.toast('Верстак — в мастерской базы', 'warn'); return false; }
		if (lv < R.lv) { this.toast(`${R.name}: нужна мастерская ${R.lv}-го уровня`, 'warn'); return false; }
		const miss = Object.entries(R.need).filter(([k, n]) => this.resHave(k) < n);
		if (miss.length) { this.toast(`Не хватает: ${miss.map(([k, n]) => `${ITEMS[k].name.toLowerCase()} ${this.resHave(k)}/${n}`).join(', ')}`, 'warn'); return false; }
		for (const [k, n] of Object.entries(R.need)) {
			const fromBag = Math.min(this.bag[k] ?? 0, n);
			this.bag[k] = (this.bag[k] ?? 0) - fromBag;
			if (n > fromBag) b.stock[k] = (b.stock[k] ?? 0) - (n - fromBag);
		}
		for (const [k, n] of Object.entries(R.out)) this.bag[k] = (this.bag[k] ?? 0) + n;
		Sfx.reload();
		this.toast(`Верстак: ${R.name}`);
		this.hud();
		this.save();
		return true;
	},

	// ---------- Машина: УАЗ из гаража (game/economy.js, CAR) ----------

	/** Машина стоит в этой локации. */
	carHere() { const c = this.world?.car; return !!c && c.at === this.loc; },

	/** УАЗ в локации — у точки, где появился герой (сбоку от него); станция «Сесть за руль». */
	placeCar(spot) {
		if (this.carMesh) { scene.remove(this.carMesh); this.carMesh = null; }
		if (level.stations) level.stations = level.stations.filter((x) => x.id !== 'car');
		if (this.carCollider) { level.colliders = level.colliders.filter((x) => x !== this.carCollider); this.carCollider = null; }
		if (!this.carHere()) return;
		// место: сбоку от героя, на свободном месте
		const ry = spot.ry ?? 0, side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
		let x = spot.pos.x + side.x * 3.4, z = spot.pos.z + side.z * 3.4;
		if (level.nav.blockedAt(x, z, 1.4)) { x = spot.pos.x - side.x * 3.4; z = spot.pos.z - side.z * 3.4; }
		if (level.nav.blockedAt(x, z, 1.4)) [x, z] = freeNear(x, z);
		this.carMesh = makeUaz(this.world.car.cond <= 0);
		this.carMesh.position.set(x, 0, z);
		this.carMesh.rotation.y = ry;
		scene.add(this.carMesh);
		// коллайдер — чтобы не проходили насквозь (сетку навигации не трогаем: машина маленькая)
		const c = { x, z, hx: 2.1, hz: 0.95, rot: ry + Math.PI / 2, c: Math.cos(ry + Math.PI / 2), s: Math.sin(ry + Math.PI / 2), wall: false };
		level.colliders.push(c);
		this.carCollider = c;
		level.stations.push({ id: 'car', name: 'УАЗ', label: 'Сесть за руль', x: x - side.x * 1.6, z: z - side.z * 1.6, r: 2.0 });
	},

	/** Залить бензин из канистр (рюкзак, на базе — и склад) и починить деталями — сколько нужно. Возвращает текст. */
	serviceCar() {
		const c = this.world.car, b = this.world.base, out = [];
		const use = (kind) => {
			if ((this.bag[kind] ?? 0) > 0) { this.bag[kind]--; return true; }
			if (this.atBase && (b.stock[kind] ?? 0) > 0) { b.stock[kind]--; return true; }
			return false;
		};
		let cans = 0;
		while (c.fuel <= CAR.tank - CAR.can && use('fuel')) { c.fuel += CAR.can; cans++; }
		if (cans) out.push(`залил ${cans} ${plural(cans, ['канистру', 'канистры', 'канистр'])}`);
		let parts = 0;
		while (c.cond < 100 - CAR.fix * 0.5 && use('parts')) { c.cond = Math.min(100, c.cond + CAR.fix); parts++; }
		if (parts) out.push(`починил (${parts} ${plural(parts, ITEMS.parts.forms)})`);
		if (cans || parts) { Sfx.reload(); this.hud(); this.save(); if (this.carMesh && c.cond > 0) this.placeCar({ pos: this.player.pos.clone(), ry: this.carMesh.rotation.y }); }
		return `${out.length ? `${out.join(', ')}. ` : ''}Бак ${Math.round(c.fuel)}/${CAR.tank} л, состояние ${Math.round(c.cond)} %`;
	},

	/** Сесть за руль: заправить и починить, что можно, — и карта Улья в режиме «на машине». */
	driveCar() {
		if (!this.carHere()) return;
		const text = this.serviceCar();
		this.toast(`УАЗ: ${text}`);
		if (this.world.car.cond <= 0) { this.toast('Машина сломана — нужны детали (верстак, тайники, караван)', 'warn'); return; }
		this.worldMap.open(null, { car: true });
	},

	/** Медпункт базы: здоровье полное, бесплатно и без ожидания. */
	healFree() {
		const p = this.player;
		if (!p?.alive) return;
		if (p.hp >= p.maxHp) { this.toast('Медпункт: ты и так здоров'); return; }
		p.hp = p.maxHp;
		Sfx.drink();
		this.toast('Медпункт: перевязали, здоровье полное');
		this.hud();
	},

	/** Столовая базы: повар кормит горячим — +30 здоровья (2-й уровень — +45, 3-й — досыта), бесплатно. */
	eatCanteen() {
		const p = this.player;
		if (!p?.alive) return;
		if (p.hp >= p.maxHp) { this.toast('Повар: «Сытый? Заходи, как проголодаешься»'); return; }
		const add = Math.round(Math.min(this.basePerks().meal || 30, p.maxHp - p.hp)); // столовая 3-го уровня — досыта
		p.hp += add;
		Sfx.drink();
		this.toast(`Столовая: миска горячей каши — +${add} здоровья`);
		this.hud();
	},

	/** Радиорубка базы: радист пересказывает эфир муров — то же, что информатор, бесплатно; вылазка — на карте Улья. */
	radioIntel() {
		const murs = this.world.murs, ext = this.world.ext, both = this.basePerks().radioExt;
		if (murs.raid) murs.raid.known = true;
		if (both && ext.hunt) ext.hunt.known = true;
		// радиовышка 2-го уровня — слышно и внешников
		this.banner('Радист', intelText(murs, this.world.time).replace('Отметил тебе на карте.', 'Отметил на карте Улья.') + (both ? ` ${extText(ext, NODES, this.world.time, approx)}` : ''));
	},

	/** Мастерская базы: холодное оружие — снова целое. */
	/** Мастерская базы: поставить доработку k на ствол id (game/mods.js) — модель в руках пересобирается с ней. */
	buyMod(id, k) {
		const why = cantMod(this.kit, id, k, this.bag.spore ?? 0);
		if (why) { this.toast(`${MODS[k]?.name ?? k}: ${why}`, 'warn'); return false; }
		this.bag.spore -= MODS[k].price;
		addMod(this.kit, id, k);
		const p = this.player;
		if (p?.models[id]) { p.models[id].removeFromParent(); delete p.models[id]; p.attachGear(); }
		Sfx.reload('ak74', { dur: 1.2, n: 1 });
		this.toast(`${WEAPONS[id].name}: ${MODS[k].name.toLowerCase()} — поставлен`);
		this.hud();
		this.save();
		return true;
	},

	repairMelee() {
		const kit = this.kit, fixed = kit.owned.filter((id) => WEAPONS[id].durability && (kit.wear[id] ?? WEAPONS[id].durability) < WEAPONS[id].durability);
		if (!fixed.length) { this.toast('Мастерская: чинить нечего'); return; }
		for (const id of fixed) kit.wear[id] = WEAPONS[id].durability;
		Sfx.coins();
		this.toast(`Мастерская: ${fixed.map((id) => WEAPONS[id].name.toLowerCase()).join(', ')} — как новые`);
		this.hud();
		this.save();
	},

	/**
	 * Нападение на базу, пока герой там: стая заражённых выходит из мути с одной стороны и идёт на героя; часовые
	 * на вышках, пулемётчик и охрана бьют их (Sentry). Со стеной — только через ворота.
	 */
	spawnBaseWave({ horde = null } = {}) {
		const b = this.world.base, n = horde ? horde.size : Math.min(12, 5 + Math.floor(Math.random() * 4) + Math.min(4, b.attacks));
		const side = Math.floor(Math.random() * 4), t = (Math.random() - 0.5) * 60, far = 58;
		const at = [[t, -far], [far, t], [t, far], [-far, t]][side];
		let lead = null;
		for (let i = 0; i < n; i++) {
			// кочующая стая — с вожаком (рубер или элита): убьёшь его — стая распадётся
			const type = horde ? (i === 0 ? horde.lead ?? 'ruber' : Math.random() < 0.2 ? 'stomper' : 'runner') : i === 0 && b.attacks >= 2 ? 'stomper' : 'runner';
			const pos = new THREE.Vector3(at[0] + (Math.random() - 0.5) * 6, 0, at[1] + (Math.random() - 0.5) * 6);
			resolveCollisions(pos, 0.5, level.colliders);
			const e = this.spawnEnemy(type, pos);
			if (horde) { e.horde = true; if (i === 0) { lead = e; e.hordeLead = true; } else { e.leader = lead; lead.followers?.push(e); } }
			e.alert?.();
		}
		const dir = ['с севера', 'с востока', 'с юга', 'с запада'][side];
		if (horde) this.banner('Стая у базы!', `${dir[0].toUpperCase()}${dir.slice(1)} идёт стая «${horde.name}» — голов ${n}, водит ${horde.lead === 'elite' ? 'элита' : 'рубер'}. Убей вожака — разбегутся`);
		else this.banner('Нападение на базу!', `Из мути ${dir} идут заражённые — ${n}. Часовые на вышках прикроют`);
	},

	updateMurs() {
		const murs = this.world.murs, clusters = Object.keys(NODES).filter((id) => NODES[id].kind === 'cluster');
		const left = (id) => timeLeft(this.world, id); // сколько до перезагрузки: туда, где не успеют уйти, не ходят
		for (const ev of tickMurs(murs, this.world.time, clusters, this.loc, (id) => NODES[id].danger ?? 1, left)) {
			if (ev.started?.live && level) this.startLiveRaid(ev.started);
			if (ev.ended) this.markRaided(ev.ended.at, ev.summary.mark);
			if (ev.newBoss) this.toast(`У муров новый главарь — «${ev.newBoss}». Снова пойдут на вылазки`);
			if (ev.peace) this.toast('Муры остыли: война кончилась, снова нейтралитет — не стреляй первым', 'warn');
		}
		// внешники: охоты (game/ext.js) — в кластер героя приходят вживую
		for (const ev of tickExt(this.world.ext, this.world.time, clusters, this.loc, (id) => NODES[id].danger ?? 1, left)) {
			if (ev.started?.live && level) this.startLiveHunt(ev.started);
			if (ev.ended) this.markRaided(ev.ended.at, ev.summary.mark);
			if (ev.newCmd) this.toast(`У внешников новый командир — «${ev.newCmd}»`);
		}
		if (this.basePerks().radioExt && this.world.ext.hunt) this.world.ext.hunt.known = true;
		// налёты муров и внешников на базу (game/raids.js)
		greedCheck(this.world.murs, this.world.base, this.world.time, this.mursStance());
		for (const f of ['murs', 'ext']) {
			const st = this.world[f], r = st.baseRaid;
			if (r && this.world.time >= r.due && !this.assault) { st.baseRaid = null; this.baseRaidDue(f, r); }
		}
		// доска заданий: раз в 20 минут — новые предложения (game/quests.js)
		refreshQuests(this.world.quests, this.world.time, !!this.world.horde.at);
		// кочующая стая с вожаком (game/migrant.js)
		const h = this.world.horde;
		for (const ev of tickHorde(h, this.world.time, this.loc)) {
			const to = ev.spawned ?? ev.moved?.to;
			if (to === 'base') this.hordeAtBase(ev.moved?.from);
			else if (to === this.loc && level && NODES[to].kind === 'cluster') {
				this.spawnHorde(ev.moved?.from ?? null);
				this.banner('Стая!', `В кластер ${ev.moved ? 'пришла' : 'сбилась'} большая стая — голов ${h.size}, водит ${h.lead === 'elite' ? 'элита' : 'рубер'} «${h.name}». Убьёшь вожака — разбегутся`);
			}
			// радио базы слышит, что стая идёт к базе
			if (h.to === 'base' && this.basePerks().radio && h.at !== 'base') this.toast(`Радист базы: стая «${h.name}» идёт в нашу сторону — у базы будет примерно через ${approx(Math.max(0, h.next - this.world.time))}`, 'warn');
		}
	},

	// ---------- Доска заданий (game/quests.js) ----------

	/** Взять поручение с доски (не больше трёх разом). */
	takeQuest(id) {
		const q = this.world.quests, t = q.offers.find((o) => o.id === id);
		if (!t || q.active.length >= QUEST_ACTIVE) return;
		q.offers = q.offers.filter((o) => o !== t);
		q.active.push(t);
		Sfx.reload();
		this.toast(`Задание взято: ${questText(t)}`);
		if (t.kind === 'find' && t.at === this.loc) this.placeTag(t);
		this.save();
	},

	/** Сдать выполненное: «принеси» — вещи из рюкзака; награда — в рюкзак. */
	turnInQuest(id) {
		const q = this.world.quests, t = q.active.find((o) => o.id === id);
		if (!t || !questReady(t, this.bag)) return;
		if (t.kind === 'fetch') this.bag[t.item] -= t.n;
		for (const [k, n] of Object.entries(t.reward)) this.bag[k] = (this.bag[k] ?? 0) + n;
		q.active = q.active.filter((o) => o !== t);
		q.done++;
		Sfx.coins();
		this.toast(`Задание сдано: ${rewardText(t.reward)}`);
		this.hud();
		this.save();
	},

	/** Отказаться от взятого. */
	dropQuest(id) {
		const q = this.world.quests;
		q.active = q.active.filter((o) => o.id !== id);
		this.save();
	},

	/** Событие для заданий: убит заражённый (e), мур или внешник, вожак стаи, подобран жетон. */
	questEvent(kind, e = null) {
		const q = this.world?.quests;
		if (!q?.active.length) return;
		const ev = kind === 'kill' ? { kind, type: e.type, at: this.loc } : kind === 'bandit' ? { kind, faction: e.faction } : { kind, at: this.loc };
		for (const t of questProgress(q, ev)) this.banner('Задание выполнено', `${questText(t)} — сдай на доске заданий (база или «Полис»)`);
	},

	/** Жетон пропавшего для задания «найди»: тело у одного из тайников кластера, подальше от входа. */
	placeTag(t) {
		if (t.got || this.pickups.some((p) => p.kind === 'tag')) return;
		const p = this.player.pos, list = level.containers.filter((c) => Math.hypot(c.ax - p.x, c.az - p.z) > 20);
		const c = list[Math.floor(Math.random() * list.length)] ?? level.containers[0];
		if (!c) return;
		const pos = new THREE.Vector3(c.ax, 0, c.az);
		this.splat?.(pos, 0.6);
		this.spawnPickup('tag', pos, 1, { ground: true });
	},

	// ---------- Кочующая стая (game/migrant.js) ----------

	/**
	 * Стая в этом кластере вживую: вожак (рубер или элита) и его свора — бегуны, топтуны, у элиты ещё рубер.
	 * from — откуда пришла: появляется у того края; иначе — где-нибудь подальше от героя. Лишних обычных бегунов
	 * убираем, чтобы всего было не больше 58 (телефон).
	 */
	spawnHorde(from = null) {
		const h = this.world.horde, p = this.player.pos;
		let c = null;
		if (from) c = level.entry(from).pos.clone();
		for (let i = 0; !c && i < 40; i++) {
			const x = (Math.random() * 2 - 1) * (PLAY - 10), z = (Math.random() * 2 - 1) * (PLAY - 10);
			if (Math.hypot(x - p.x, z - p.z) > 30 && !level.nav.blockedAt(x, z, 1)) c = new THREE.Vector3(x, 0, z);
		}
		if (!c) return;
		const at = (r) => { for (let i = 0; i < 12; i++) { const v = c.clone().add(new THREE.Vector3((Math.random() - 0.5) * r, 0, (Math.random() - 0.5) * r)); if (!level.nav.blockedAt(v.x, v.z, 0.6)) return v; } return c.clone(); };
		const lead = this.spawnEnemy(h.lead ?? 'ruber', at(1));
		lead.horde = lead.hordeLead = true;
		for (let i = 1; i < h.size; i++) {
			const type = h.lead === 'elite' && i === 1 ? 'ruber' : Math.random() < 0.2 ? 'stomper' : 'runner';
			const e = this.spawnEnemy(type, at(6));
			e.horde = true;
			e.leader = lead;
			lead.followers.push(e);
		}
		// обычных бегунов (не из стай) поменьше — всего не больше 58
		const extra = this.enemies.filter((e) => e.alive).length - 58;
		// сначала одиночки, потом бегуны чужих стай (вожаков и сильных не трогаем)
		const spare = this.enemies.filter((o) => o.alive && o.type === 'runner' && !o.horde).sort((a, b) => !!a.leader - !!b.leader);
		if (extra > 0) for (const e of spare.slice(0, extra)) { e.alive = false; e.leader?.followers?.splice(e.leader.followers.indexOf(e), 1); e.dispose(); }
		this.enemies = this.enemies.filter((e) => e.alive || e.timer > 0);
	},

	/** Стая пришла к базе: герой там — нападает вживую (с вожаком); нет — нападение заочно, против обороны. */
	hordeAtBase(from) {
		const h = this.world.horde, b = this.world.base;
		if (!b) return;
		if (this.loc === 'base' && level) { this.spawnBaseWave({ horde: h }); return; }
		const power = h.size * 9 + (h.lead === 'elite' ? 110 : 60);
		const ev = raidBase(b, power, this.world.time, `стая «${h.name}»`, { peas: 2 + Math.floor(h.size / 4), spore: h.size });
		this.toast(ev.held ? `Стая «${h.name}» налетела на базу — отбились (сила ${ev.power}, оборона ${ev.def}), на складе трофеи` : `Стая «${h.name}» прорвалась на базу (сила ${ev.power}, оборона ${ev.def})${stockText(ev.lost) ? `: растащили ${stockText(ev.lost)}` : ''}`, ev.held ? undefined : 'warn');
	},

	/** Вожак стаи убит: стая распадается, бегуны — сами по себе; новая соберётся не скоро. */
	hordeLeaderDied(e) {
		const h = this.world.horde, name = h.name;
		hordeBroken(h, this.world.time);
		for (const o of this.enemies) if (o.horde) o.horde = false;
		this.spawnPickup('spore', e.pos.clone().add(new THREE.Vector3(0.4, 0, -0.6)), 20);
		this.banner('Вожак стаи убит', `«${name}» мёртв — стая разбегается. Новый сильный соберёт свою не скоро`);
		this.questEvent?.('horde');
	},

	// ---------- Внешники (game/ext.js) ----------

	/** Группа внешников заходит в кластер героя через выход: идут на героя — чуют иммунных. */
	startLiveHunt(hunt, resumed = false) {
		hunt.live = true;
		const e = level.exits[Math.floor(Math.random() * level.exits.length)];
		const members = [];
		for (let i = 0; i < hunt.size; i++) {
			const pos = e.spawn.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
			resolveCollisions(pos, 0.4, level.colliders);
			const b = new Bandit(pos, EXT_GUNS[Math.floor(Math.random() * EXT_GUNS.length)], null, { faction: 'ext' });
			members.push(b);
			this.bandits.push(b);
		}
		this.huntSquad = new HuntSquad(hunt, members);
		for (const b of members) b.squad = this.huntSquad;
		Sfx.rumble?.(0.3);
		this.banner('Внешники!', `${resumed ? 'В кластере охотится' : 'В кластер зашла'} группа внешников — ${hunt.size} в броне, с хорошими стволами. Охотятся на иммунных — идут на тебя`);
	},

	/** Охота кончилась (все ушли или полегли): в форпосте стало меньше на погибших. */
	finishHunt() {
		const ext = this.world.ext;
		if (!this.huntSquad) return;
		this.huntSquad = null;
		ext.hunt = null;
		ext.nextHunt = this.world.time + 900 + Math.random() * 1200;
	},

	/**
	 * Форпост внешников: на постах — до 14 (сколько их сейчас дома), остальные выходят из казармы на смену убитым,
	 * командир — у своего модуля. В контейнерах склада и у командира — их снаряжение: что вынесешь, то у них и убудет.
	 */
	populateExt() {
		const ext = this.world.ext;
		const home = Math.max(0, ext.count - (ext.hunt ? ext.hunt.size : 0));
		const all = level.posts ?? [], fix = level.fixedPosts ?? 6, posts = [...all.slice(0, fix), ...all.slice(fix).sort(() => Math.random() - 0.5)];
		const active = Math.min(14, home, posts.length);
		this.garrison = new Garrison(home - active, level.barracksDoor ?? { x: 0, z: 0 }, 'ext');
		const gun = () => EXT_GUNS[Math.floor(Math.random() * EXT_GUNS.length)];
		const routes = (active >= 10 ? level.patrols ?? [] : []).map((r) => r.map(([x, z]) => freeNear(x, z)));
		let i = 0;
		for (const r of routes) for (let k = 0; k < 2; k++, i++) {
			const [x, z] = r[k * Math.floor(r.length / 2)];
			const b = new Bandit(new THREE.Vector3(x, 0, z), gun(), this.garrison, { patrol: r, faction: 'ext' });
			b.patrol.i = (k * Math.floor(r.length / 2) + 1) % r.length;
			this.bandits.push(b);
		}
		for (let j = 0; i < active && j < posts.length; i++, j++) {
			const [x, z, ry] = posts[j];
			this.bandits.push(new Bandit(new THREE.Vector3(x, 0, z), gun(), this.garrison, { post: { x, z, ry }, faction: 'ext' }));
		}
		this.extBoss = null;
		if (ext.cmd?.alive !== false && home > 0 && level.bossPost) {
			const [x, z, ry] = level.bossPost;
			this.extBoss = new Bandit(new THREE.Vector3(x, 0, z), CMD_GUN, this.garrison, { post: { x, z, ry }, boss: true, faction: 'ext' });
			this.bandits.push(this.extBoss);
		}
		// пленные в клетках изолятора: подойди к решётке — «Освободить» (поднимет тревогу)
		this.prisoners = [];
		(ext.prisoners ?? []).forEach((pr, i) => {
			const at = level.prisoners?.[i], door = level.cellDoors?.[i];
			if (!pr || !at || !door) return;
			const n = new Npc({ x: at[0], z: at[1], ry: at[2], clip: 'Idle', tint: [0.5, 0.46, 0.4] });
			this.npcs.push(n);
			this.prisoners[i] = n;
			level.stations.push({ id: 'free', idx: i, name: 'Пленный', label: 'Освободить', x: door[0], z: door[1], r: 1.3 });
		});
		const store = level.containers.filter((c) => /ExtStorage|ExtCommand/.test(c.building));
		for (const c of level.containers) { c.items = store.includes(c) ? [] : rollLoot(c.loot); c.searched = false; c.spark.visible = true; }
		Object.entries(ext.stash).forEach(([kind, n], k0) => {
			if (!(n > 0) || !store.length) return;
			const parts = Math.min(store.length, Math.max(1, Math.ceil(n / 30)));
			for (let k = 0; k < parts; k++) {
				const q = Math.floor(n / parts) + (k < n % parts ? 1 : 0);
				if (q > 0) store[(k0 + k) % store.length].items.push([kind, q]);
			}
		});
	},

	/**
	 * Освободить пленного из клетки изолятора: внешники поднимают тревогу (и запомнят — налёт на базу). Боец идёт с
	 * героем наёмником (если есть койка), знахарь и барыга перебираются на базу героя.
	 */
	freePrisoner(idx) {
		const ext = this.world.ext, pr = ext.prisoners?.[idx];
		if (!pr) return;
		ext.prisoners[idx] = null;
		const n = this.prisoners?.[idx];
		if (n) { n.dispose(); this.npcs = this.npcs.filter((o) => o !== n); }
		level.stations = level.stations.filter((st) => !(st.id === 'free' && st.idx === idx));
		this.garrison?.alarm(this.player.pos);
		this.planBaseRaid?.('ext', 'пленные');
		const res = this.world.base.residents;
		let kind = pr.kind;
		if ((kind === 'znahar' || kind === 'barter') && res.includes(kind)) kind = 'merc';
		if (kind === 'merc') {
			const free = Object.keys(MERCS).filter((id) => !this.merc(id));
			const where = this.freeBed('stab') != null ? 'stab' : this.freeBed('base') != null ? 'base' : null;
			if (free.length && where) {
				const id = free[Math.floor(Math.random() * free.length)], D = MERCS[id];
				const st = newMerc(id, this.freeBed(where));
				st.home = where;
				st.ammo = 0; st.hp = Math.round(D.hp * 0.6); // из клетки — без запаса и побитый
				st.out = this.party.length < this.partyMax;
				this.roster.push(st);
				this.spawnMercs();
				this.banner(`${D.name} освобождён`, `${CLASSES[D.cls].name} с ${WEAPONS[D.weapon].name}: ${st.out ? 'идёт с тобой — патронов у него только магазин' : `отряд полон — ждёт тебя ${this.homeText(st)}`}. Внешники подняли тревогу!`);
			} else {
				this.bag.spore = (this.bag.spore ?? 0) + 40;
				this.banner('Пленный освобождён', 'Коек в комнате нет — отблагодарил сорока споранами и ушёл в «Полис». Внешники подняли тревогу!');
			}
		} else {
			res.push(kind);
			this.banner(kind === 'znahar' ? 'Знахарь освобождён' : 'Барыга освобождён', `${kind === 'znahar' ? 'Знахарь будет лечить тебя на базе и варить живчики' : 'Барыга откроет на базе свою лавку'} — ждёт тебя на площади «Опорного». Внешники подняли тревогу!`);
		}
		Sfx.reload();
		this.hud();
		this.save();
	},

	/** Знахарь на базе: лечит до полного; раз в 15 минут мира — ещё и живчик своей варки. */
	znaharHeal() {
		const p = this.player, b = this.world.base;
		if (!p?.alive) return;
		const brew = this.world.time - (b.znaharAt ?? -1e9) >= 900;
		if (p.hp >= p.maxHp && !brew) { this.toast('Знахарь: «Здоров. Живчик ещё не настоялся — заходи позже»'); return; }
		p.hp = p.maxHp;
		if (brew) { b.znaharAt = this.world.time; this.bag.zhivchik = (this.bag.zhivchik ?? 0) + 1; }
		Sfx.drink();
		this.toast(`Знахарь подлечил — здоровье полное${brew ? '; дал живчик своей варки' : ''}`);
		this.hud();
		this.save();
	},

	// ---------- Налёты на базу (game/raids.js) ----------

	/** Повод для налёта фракции на базу (месть, пленные, резня): придут через 10–20 минут. */
	planBaseRaid(faction, reason) {
		if (!this.world.base?.built.length) return; // голое поле — грабить нечего
		if (planRaid(this.world[faction], this.world.time, reason) && this.basePerks().radio) this.toast(`Радист базы: ${faction === 'ext' ? 'внешники' : 'муры'} собираются к нам — ${reason}. Готовь оборону`, 'warn');
	},

	/** Срок налёта: герой на базе — штурм вживую; нет — заочно, против обороны базы. */
	baseRaidDue(faction, r) {
		const st = this.world[faction], n = raidSize(faction, st.count), who = faction === 'ext' ? 'внешники' : 'муры';
		if (n <= 0) return;
		if (this.loc === 'base' && level) { this.startBaseAssault(faction, n, r.reason); return; }
		const b = this.world.base, loot = faction === 'ext' ? { ammo556: n * 15, spore: n * 6 } : { ammo545: n * 10, spore: n * 4 };
		const ev = raidBase(b, n * RAID_POWER[faction], this.world.time, who, loot);
		st.count = Math.max(0, st.count - (ev.held ? Math.ceil(n / 2) : 1));
		if (!ev.held) this.hurtGuards();
		this.toast(ev.held ? `На базу налетели ${who} (${r.reason}) — отбились (сила ${ev.power}, оборона ${ev.def}); трофеи на складе` : `На базу налетели ${who} (${r.reason}) и прорвались (сила ${ev.power}, оборона ${ev.def})${stockText(ev.lost) ? `: вынесли ${stockText(ev.lost)}` : ''}`, ev.held ? undefined : 'warn');
	},

	/** Прорыв на базу: наёмники на постах ранены, тяжело раненый погибает. */
	hurtGuards() {
		for (const st of this.roster.filter((m) => m.job?.kind === 'post')) {
			st.hp -= mercMaxHp(st) * (0.25 + Math.random() * 0.5);
			if (st.hp <= 0) { this.roster = this.roster.filter((m) => m !== st); this.toast(`${MERCS[st.id].name} погиб на посту, защищая базу`, 'warn'); }
		}
		this.syncGuards();
	},

	/** Налёт вживую: отряд выходит из мути с одной стороны и бежит к центру базы. */
	startBaseAssault(faction, n, reason) {
		const side = Math.floor(Math.random() * 4), t = (Math.random() - 0.5) * 40, far = 56;
		const at = [[t, -far], [far, t], [t, far], [-far, t]][side], guns = faction === 'ext' ? EXT_GUNS : MUR_GUNS;
		const raid = { faction, size: n, end: this.world.time + RAID_TIME, reason };
		const members = [];
		for (let i = 0; i < n; i++) {
			const pos = new THREE.Vector3(at[0] + (Math.random() - 0.5) * 5, 0, at[1] + (Math.random() - 0.5) * 5);
			resolveCollisions(pos, 0.4, level.colliders);
			const b = new Bandit(pos, guns[Math.floor(Math.random() * guns.length)], null, { faction });
			members.push(b);
			this.bandits.push(b);
		}
		this.assault = new AssaultSquad(raid, members);
		this.assault.angry = true; // пришли воевать
		for (const b of members) b.squad = this.assault;
		Sfx.siren(0.8);
		this.banner(faction === 'ext' ? 'Внешники штурмуют базу!' : 'Налёт муров!', `${['С севера', 'С востока', 'С юга', 'С запада'][side]} идут ${faction === 'ext' ? 'внешники' : 'муры'} — ${n} ${plural(n, ['ствол', 'ствола', 'стволов'])} (${reason}). Часовые и наёмники на постах примут бой`);
	},

	/** Налёт кончился: всех положили — отбит, трофеи на склад базы; ушли — унесли накопленное. */
	finishAssault(sq) {
		if (this.assault !== sq) return;
		this.assault = null;
		const b = this.world.base, dead = sq.members.filter((m) => !m.alive).length, f = sq.raid.faction;
		if (dead >= sq.members.length) {
			const loot = f === 'ext' ? { spore: dead * 8, ammo556: dead * 10 } : { spore: dead * 5, ammo545: dead * 8 };
			for (const [k, v] of Object.entries(loot)) b.stock[k] = (b.stock[k] ?? 0) + v;
			b.log.unshift({ power: dead * RAID_POWER[f], def: 0, held: true, lost: {}, who: f === 'ext' ? 'внешники' : 'муры', time: this.world.time });
			b.log.length = Math.min(b.log.length, 5);
			this.banner('Налёт отбит', `Все ${dead} налётчиков полегли. Трофеи — на складе базы: ${stockText(loot)}`);
		} else {
			const lost = stockText(plunderBase(b)); // накопленное — всё, ресурсы — половину
			this.toast(`Налётчики ушли${lost ? ` и вынесли со склада: ${lost}` : ''}`, 'warn');
		}
		this.save();
	},

	/** Лидер фракции: главарь муров или командир внешников. */
	leaderOf(faction) { return faction === 'ext' ? this.extBoss : this.murBoss; },

	/** Заочная вылазка закончилась: кластер запоминает её следы (до своей перезагрузки). */
	markRaided(at, mark) {
		const c = this.world.clusters[at];
		if (!c) return;
		if (c.saved) {
			const pools = (c.saved.marks ??= {}).pool ??= [];
			c.saved.enemies = c.saved.enemies.filter((e) => {
				if (Math.random() >= mark.kill) return true;
				pools.push([Math.floor(Math.random() * 5), e.x, e.z, +(Math.random() * 6).toFixed(2), 1.6]); // перебили — осталась лужа
				return false;
			});
			for (const k of c.saved.containers) if (!k.searched && Math.random() < mark.loot) { k.items = []; k.searched = true; }
		} else c.raided = mark;
	},

	/** Отряд муров заходит в кластер героя через случайный выход: кучей или парами. */
	startLiveRaid(raid, resumed = false) {
		raid.live = true;
		const e = level.exits[Math.floor(Math.random() * level.exits.length)];
		const members = [];
		for (let i = 0; i < raid.size; i++) {
			const pos = e.spawn.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4));
			resolveCollisions(pos, 0.4, level.colliders);
			const b = new Bandit(pos, MUR_GUNS[Math.floor(Math.random() * MUR_GUNS.length)], null);
			members.push(b);
			this.bandits.push(b);
		}
		this.raidSquad = new RaidSquad(raid, members);
		for (const b of members) b.squad = this.raidSquad;
		Sfx.rumble?.(0.3);
		const how = this.mursStance() === 'war' ? 'Война: ищут тебя и стреляют сразу' : raid.angry ? 'Помнят, что ты на них напал, — стреляют' : 'Выносят тайники и бьют заражённых. Не стреляй первым — пройдут мимо';
		this.banner('Муры!', `${resumed ? 'В кластере' : 'В кластер зашёл'} отряд муров — ${raid.size} ${plural(raid.size, ['ствол', 'ствола', 'стволов'])}, ${raid.mode === 'pairs' ? 'парами' : 'кучей'}. ${how}`);
	},

	/** Живая вылазка закончилась: добыча — в шкафы «Карьера», на спораны — новые бойцы. */
	finishRaid() {
		const murs = this.world.murs, sq = this.raidSquad;
		if (!sq) return;
		this.raidSquad = null;
		storeLoot(murs, sq.loot);
		hireMurs(murs);
		murs.raid = null;
		murs.nextRaid = this.world.time + 300 + Math.random() * 900;
	},

	/** Информатор: за спораны — где сейчас муры (game/intel.js); купленное о вылазке видно на карте Улья. */
	buyIntel(topic = 'murs') {
		const T = TOPICS[topic] ?? TOPICS.murs;
		if ((this.bag.spore ?? 0) < T.price) { this.toast('Не хватает споранов', 'warn'); return null; }
		this.bag.spore -= T.price;
		const w = this.world;
		if (topic === 'murs' && w.murs.raid) w.murs.raid.known = true;
		if (topic === 'ext' && w.ext.hunt) w.ext.hunt.known = true;
		if (topic === 'horde' && w.horde.at) w.horde.known = true;
		Sfx.coins();
		this.hud();
		this.save();
		return topicText(topic, w);
	},

	/**
	 * Цель мура: ближайший, кого он видит на дальность своего ствола — заражённый, а в ссоре с героем (game.hostile) —
	 * и герой, и его наёмники. Муры в нейтралитете людей не трогают: пройдут мимо, если не стрелять первым.
	 */
	banditTarget(b) {
		const R = b.W.range, foe = this.hostile(b);
		let best = null, bd = R;
		const look = (a) => {
			if (!a?.alive) return;
			const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
			if (d < bd && lineOfSight(b.pos, a.pos)) { bd = d; best = a; }
		};
		for (const e of this.enemies) look(e);
		if (foe) {
			look(this.player);
			for (const m of this.mercs) if (m.state.out) look(m);
		}
		for (const o of this.bandits) if (o.faction !== b.faction) look(o); // муры и внешники бьют друг друга
		if (foe && this.loc === 'base') for (const n of this.npcs) if (n.cfg) look(n); // налёт на базу: и по часовым
		// прежняя цель держится, пока жива, видна и в дальности, а новая не ближе на 40 % — иначе в толпе мур вертелся
		const cur = b.target;
		if (cur && cur !== best && cur.alive && (foe || !(isHuman(cur) || cur instanceof Sentry))) {
			const dc = Math.hypot(cur.pos.x - b.pos.x, cur.pos.z - b.pos.z);
			if (dc < R + 1 && (!best || bd > dc * 0.6) && lineOfSight(b.pos, cur.pos)) return cur;
		}
		return best;
	},

	// ---------- Отношения с мурами (game/murs.js: m.rep, murStance) ----------

	/** 'war' | 'neutral' | 'friend'. */
	mursStance() { return murStance(this.world.murs); },

	/** В ссоре с героем: внешники — всегда; муры — в войну или если этот отряд (гарнизон «Карьера», налёт) задели. */
	hostile(b) { return b.faction !== 'murs' || this.mursStance() === 'war' || !!(b.angry || b.squad?.angry); },

	/** «Карьер» сейчас не примет: война или там подняли тревогу. */
	campHostile() { return this.mursStance() === 'war' || !!this.garrison?.angry; },

	/** Изменить отношения с мурами на d (why — за что): смена войны, нейтралитета, «своих» — баннером. */
	murRep(d, why = '') {
		const m = this.world.murs, before = murStance(m), now = murOffend(m, this.world.time, d);
		if (now === before) return;
		if (now === 'war') {
			// война: набеги на базу чаще, «Карьер» закрыт, нанятые муры уходят
			m.greedAt = Math.min(m.greedAt ?? Infinity, this.world.time + 900 + Math.random() * 900);
			this.banner('Война с мурами', `${why ? `${why[0].toUpperCase()}${why.slice(1)}. ` : ''}Муры стреляют без разговоров, «Карьер» закрыт, отряды ищут тебя, на базу пойдут набегом. Остынут через полчаса без новых обид`);
			this.dropTempMercs('war');
		} else if (before === 'war') this.toast('Муры остыли: снова нейтралитет — не стреляй первым, и они не тронут', 'warn');
		else if (now === 'friend') this.banner('Муры считают тебя своим', 'Барыга «Карьера» уступает в цене, бригадир даёт бойцов дешевле, на базу набегом не ходят');
		else this.toast(before === 'friend' ? 'Муры больше не считают тебя своим — просто нейтралитет' : 'Отношения с мурами: нейтралитет');
		this.save();
	},

	/** Герой или его боец задел мура: его отряд (в «Карьере» — весь гарнизон) — в бой с героем, отношения хуже. */
	provokeMurs(b, why = 'ты напал первым') {
		if (this.hostile(b)) return;
		const sq = b.squad, camp = !!sq && sq === this.garrison;
		if (sq) sq.angry = true; else b.angry = true;
		if (sq?.raid) sq.raid.angry = true;
		if (camp) this.world.murs.grudgeUntil = this.world.time + CAMP_GRUDGE;
		for (const o of this.bandits) if (o.alive && (o === b || (sq && o.squad === sq))) o.retarget = 0;
		this.dropTempMercs('fight');
		if (camp) this.garrison.alarm(this.player.pos);
		this.toast(camp ? '«Карьер» поднят по тревоге — муры открыли огонь' : 'Муры: «Ты чё, попутал?!» — отряд открыл огонь', 'warn');
		this.murRep(MUR_REP.provoke, why);
		this.hud();
	},

	/** Ближайший мур не в ссоре с героем в r метрах (sight — ещё и на виду): на него — кнопка «Напасть». */
	peacefulMur(r, sight = false) {
		const p = this.player?.pos;
		if (!p) return null;
		let best = null, bd = r;
		for (const b of this.bandits) {
			if (!b.alive || b.faction !== 'murs' || this.hostile(b)) continue;
			const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
			if (d < bd && (!sight || lineOfSight(p, b.pos))) { bd = d; best = b; }
		}
		return best;
	},

	/** Кнопка «Напасть на муров»: ближайший мур на виду и его отряд — в бой (сам герой по ним не стреляет, пока мир). */
	attackMurs() {
		const p = this.player;
		if (!p?.alive || this.state !== 'play' || this.paused) return;
		const b = this.peacefulMur(25, true) ?? this.peacefulMur(25);
		if (b) this.provokeMurs(b);
	},

	/** Мур, нанятый на одну вылазку (MERCS[id].mur), уходит к своим: ссора с мурами, война или вернулись домой. */
	dropTempMercs(why) {
		const temp = this.roster.filter((st) => st.temp);
		if (!temp.length) return;
		for (const st of temp) {
			this.roster = this.roster.filter((m) => m !== st);
			const a = this.mercs.find((m) => m.state === st);
			a?.dispose();
			this.mercs = this.mercs.filter((m) => m !== a);
		}
		const names = temp.map((st) => MERCS[st.id].name).join(' и ');
		this.toast(why === 'home' ? `${names}: «Бывай. Понадоблюсь — ищи в «Карьере»» — ушёл к своим` : `${names}: «Против своих не пойду» — ушёл к мурам`, why === 'home' ? undefined : 'warn');
		this.slotMercs();
		this.renderPartyBar();
	},

	/** Сделка с барыгой «Карьера» — муры довольны (не чаще раза в 2 минуты мира). */
	murDeal() {
		const m = this.world.murs;
		if (this.world.time - (m.dealAt ?? -1e9) < 120) return;
		m.dealAt = this.world.time;
		this.murRep(MUR_REP.trade);
	},

	/** Барыга «Карьера»: стволы муров, патроны, гранаты, аптечки — «своим» дешевле. */
	murTrade() {
		if (this.campHostile()) { this.toast('Барыга муров: «Вали, пока цел!»', 'warn'); return; }
		this.trade.open({ murs: this.mursStance() });
	},

	/** Бригадир «Карьера»: нанять мура на одну вылазку. */
	murHire() {
		if (this.campHostile()) { this.toast('Бригадир: «С тобой разговор короткий»', 'warn'); return; }
		this.partyWindow.open({ hiring: true, murs: true });
	},

	/** Цена мура на одну вылазку: «своим» — на четверть дешевле. */
	murPrice(id) { return Math.ceil(MERCS[id].price * (this.mursStance() === 'friend' ? 0.75 : 1)); },

	/** Нанять мура у бригадира: идёт с героем сразу (без койки), уйдёт, когда герой вернётся в стаб, на базу или в «Карьер». */
	hireMur(id) {
		const D = MERCS[id];
		if (!D?.mur || this.merc(id) || this.campHostile()) return;
		if (this.party.length >= this.partyMax) { this.toast(`С тобой уже ${this.partyMax} — больше не возьмёшь`, 'warn'); return; }
		const price = this.murPrice(id);
		if ((this.bag.spore ?? 0) < price) { this.toast('Не хватает споранов', 'warn'); return; }
		this.bag.spore -= price;
		const st = newMerc(id, 0);
		st.temp = true;
		st.home = 'temp';
		st.out = true;
		this.roster.push(st);
		const m = new Merc(st);
		m.place();
		this.mercs.push(m);
		this.slotMercs();
		Sfx.coins();
		this.toast(`${D.name} идёт с тобой на одну вылазку — вернёшься в стаб, на базу или сюда, и он уйдёт к своим`);
		this.murRep(MUR_REP.hire);
		this.renderPartyBar();
		this.hud();
		this.save();
	},

	/**
	 * Отряд муров в бою с человеком: раз в несколько секунд кто-то идёт в обход — с главарём двое и с разных сторон
	 * (он и кричит), без него — один и реже (MUR_FLANK_GAP). Гранаты по засевшему — Bandit.tryGrenade.
	 */
	coordinateMurs(dt) {
		for (const f of ['murs', 'ext']) this.coordinateFaction(f, dt);
	},

	/** Обход с фланга для одной фракции (у каждой свой отсчёт и свой лидер). */
	coordinateFaction(faction, dt) {
		const key = faction === 'ext' ? 'extOrderT' : 'murOrderT';
		if ((this[key] = (this[key] ?? 3) - dt) > 0) return;
		const leader = this.leaderOf(faction), boss = leader?.alive ? leader : null;
		this[key] = (boss ? MUR_FLANK_GAP[0] : MUR_FLANK_GAP[1]) * (0.8 + Math.random() * 0.4);
		const engaged = this.bandits.filter((b) => b.alive && b.faction === faction && !b.boss && b.target && isHuman(b.target) && b.panicT <= 0);
		if (engaged.length < 3 || engaged.some((b) => b.flank)) return;
		const t = engaged[0].target, n = boss ? 2 : 1;
		const cx = engaged.reduce((a, b) => a + b.pos.x, 0) / engaged.length, cz = engaged.reduce((a, b) => a + b.pos.z, 0) / engaged.length;
		const axis = new THREE.Vector3(cx - t.pos.x, 0, cz - t.pos.z);
		if (axis.lengthSq() < 1e-4) return;
		axis.normalize();
		engaged.sort((a, b) => b.hp - a.hp).slice(0, n).forEach((b, i) => { b.flank = i % 2 ? -1 : 1; b.flankAxis = axis; b.spot = null; b.spotT = 0; });
		if (boss) this.bossShout(faction === 'ext' ? (n === 2 ? 'Двойки — в обход, с флангов!' : 'Обойти с фланга!') : n === 2 ? 'Обходи с двух сторон!' : 'Обходи его!', faction);
	},

	/** Окрик главаря — в ленту, если герой рядом (не чаще раза в 6 с). */
	bossShout(text, faction = 'murs') {
		const b = this.leaderOf(faction);
		if (!b?.alive || this.time < (this.shoutAt ?? 0) || Math.hypot(b.pos.x - this.player.pos.x, b.pos.z - this.player.pos.z) > 35) return;
		this.shoutAt = this.time + 6;
		this.toast(faction === 'ext' ? `Командир «${this.world.ext.cmd?.name ?? ''}»: «${text}»` : `Главарь «${this.world.murs.boss?.name ?? ''}»: «${text}»`, 'warn');
	},

	/** Полоска здоровья главаря вверху: когда он рядом или дерётся с героем. */
	updateBossBar() {
		const b = this.murBoss ?? this.extBoss, el = $('boss-bar');
		const show = !!(b?.alive && this.state === 'play' && (b.target === this.player || (this.hostile(b) && Math.hypot(b.pos.x - this.player.pos.x, b.pos.z - this.player.pos.z) < 22)));
		if (show !== !el.classList.contains('hidden')) el.classList.toggle('hidden', !show);
		if (!show) return;
		const k = Math.round((b.hp / b.maxHp) * 100);
		if (k !== this.bossHpShown) {
			this.bossHpShown = k;
			$('boss-name').textContent = b.faction === 'ext' ? `Командир внешников «${this.world.ext.cmd?.name ?? ''}»` : `Главарь муров «${this.world.murs.boss?.name ?? ''}»`;
			$('boss-hp').style.width = `${k}%`;
		}
	},

	/**
	 * Мур убит: стволы с муров не падают, лута вчетверо меньше прежнего — горсть патронов к его стволу и бывает споран
	 * (MUR_DROP_* в game/murs.js); в «Карьере» стало меньше. Главарь — не из полусотни: его смерть — паника и без
	 * вылазок, пока не выберут нового.
	 */
	banditDied(b) {
		const mine = heroSide(b.lastHitBy); // мура убил внешник или заражённый — не в счёт героя
		if (mine) this.kills++;
		Sfx.death('human', this.ear(b.pos));
		this.decal(b.pos, 1.6);
		const near = (dx, dz) => b.pos.clone().add(new THREE.Vector3(dx, 0, dz));
		if (mine) this.questEvent('bandit', b);
		// отношения с мурами: убил мура — обида (в обороне базы от налёта — нет), главаря — война; внешника — мурам в радость
		const ours = b.lastHitBy === this.player || b.lastHitBy instanceof Merc || b.lastHitBy instanceof Sentry;
		if (ours && b.faction === 'murs' && b.squad !== this.assault) this.murRep(b.boss ? MUR_REP.boss : MUR_REP.kill, b.boss ? 'ты убил их главаря' : 'ты убиваешь муров');
		if (ours && b.faction === 'ext') this.murRep(MUR_REP.ext);
		if (b.lastHitBy instanceof Merc) this.awardXp(b.lastHitBy.state, XP_KILL[b.faction] ?? 5, 'бой');
		// резня в логове: десяток убитых за визит — придут мстить на базу
		if (mine && NODES[this.loc].kind === (b.faction === 'ext' ? 'ext' : 'murs') && (this.lairKills = (this.lairKills ?? 0) + 1) === MASSACRE) this.planBaseRaid(b.faction, 'месть за резню в логове');
		if (b.faction === 'ext') { this.extDied(b, near); return; }
		const [a0, a1] = MUR_DROP_AMMO;
		if (b.W.ammo) this.spawnPickup(b.W.ammo, near(0.4, 0.3), a0 + Math.floor(Math.random() * (a1 - a0 + 1)));
		if (b.boss) {
			this.spawnPickup('spore', near(0, -0.5), 15 + Math.floor(Math.random() * 11));
			const m = this.world.murs;
			m.boss = { ...(m.boss ?? {}), alive: false };
			this.murBoss = null;
			for (const o of this.bandits) if (o.alive) { o.panicT = 5 + Math.random() * 4; o.spot = null; o.flank = 0; }
			this.banner('Главарь убит', `«${m.boss.name ?? 'Главарь'}» мёртв — муры в замешательстве. Без главаря на вылазки не пойдут, пока не выберут нового — а за главаря придут мстить на базу`);
			this.planBaseRaid('murs', 'месть за главаря');
			this.hud();
			this.save();
			return;
		}
		if (Math.random() < MUR_DROP_SPORE) this.spawnPickup('spore', near(0, -0.5), 1);
		this.world.murs.count = Math.max(0, this.world.murs.count - 1);
		if (this.raidSquad && this.raidSquad.raid) this.raidSquad.raid.size = Math.max(0, this.raidSquad.raid.size - 1);
		this.hud();
	},

	/**
	 * Внешник убит: с него — патроны к стволу, спораны, бывает живчик, граната и сам ствол (EXT_DROP_* в game/ext.js);
	 * в форпосте стало меньше. Командир — паника и окрик; нового выберут при пополнении.
	 */
	extDied(b, near) {
		const ri = ([a, c]) => a + Math.floor(Math.random() * (c - a + 1)), ext = this.world.ext;
		if (b.W.ammo) this.spawnPickup(b.W.ammo, near(0.4, 0.3), ri(EXT_DROP_AMMO));
		this.spawnPickup('spore', near(0, -0.5), ri(EXT_DROP_SPORE) * (b.boss ? 8 : 1));
		if (Math.random() < EXT_DROP_MED || b.boss) this.spawnPickup('medkit', near(-0.4, 0.2), 1);
		if (Math.random() < EXT_DROP_NADE || b.boss) this.spawnPickup('grenade', near(0.2, -0.6), 1);
		if (Math.random() < EXT_DROP_GUN || b.boss) this.spawnPickup(b.weapon, near(-0.3, -0.4), 1);
		if (b.boss) {
			ext.cmd = { ...(ext.cmd ?? {}), alive: false };
			this.extBoss = null;
			for (const o of this.bandits) if (o.alive && o.faction === 'ext') { o.panicT = 4 + Math.random() * 3; o.spot = null; o.flank = 0; }
			this.banner('Командир убит', `«${ext.cmd.name ?? 'Командир'}» мёртв — внешники без командования. Нового пришлют при пополнении форпоста, а за командира придут мстить`);
			this.planBaseRaid('ext', 'месть за командира');
		} else ext.count = Math.max(0, ext.count - 1);
		if (this.huntSquad?.hunt) this.huntSquad.hunt.size = Math.max(0, this.huntSquad.hunt.size - (b.boss ? 0 : 1));
		this.hud();
		this.save();
	},

	/**
	 * «Карьер»: на постах — до 14 муров (сколько их сейчас дома), остальные выходят из казармы на смену убитым.
	 * В шкафах склада и будки главаря — их запасы: что вынесешь, то у муров и убудет.
	 */
	populateMurs() {
		const murs = this.world.murs;
		const home = Math.max(0, murs.count - (murs.raid ? murs.raid.size : 0));
		// ворота, вышки и охрана главаря заняты всегда (fixedPosts), остальные посты — как выпадет
		const all = level.posts ?? [], fix = level.fixedPosts ?? 6, posts = [...all.slice(0, fix), ...all.slice(fix).sort(() => Math.random() - 0.5)];
		const active = Math.min(14, home, posts.length);
		this.garrison = new Garrison(home - active, level.barracksDoor ?? { x: 0, z: 0 });
		this.garrison.angry = this.world.time < (murs.grudgeUntil ?? 0); // недавно задел «Карьер» — помнят
		for (const n of level.npcs) this.npcs.push(new Npc(n)); // барыга и бригадир у костра
		const gun = () => MUR_GUNS[Math.floor(Math.random() * MUR_GUNS.length)];
		// по двое на маршрут патруля — из числа часовых (когда их хватает); точки — на свободном месте
		const routes = (active >= 10 ? level.patrols ?? [] : []).map((r) => r.map(([x, z]) => freeNear(x, z)));
		let i = 0;
		for (const r of routes) for (let k = 0; k < 2; k++, i++) {
			const [x, z] = r[k * Math.floor(r.length / 2)];
			const b = new Bandit(new THREE.Vector3(x, 0, z), gun(), this.garrison, { patrol: r });
			b.patrol.i = (k * Math.floor(r.length / 2) + 1) % r.length;
			this.bandits.push(b);
		}
		for (let j = 0; i < active; i++, j++) {
			const [x, z, ry] = posts[j];
			this.bandits.push(new Bandit(new THREE.Vector3(x, 0, z), gun(), this.garrison, { post: { x, z, ry } }));
		}
		// главарь — у своей будки (жив и в «Карьере» есть кто-то)
		this.murBoss = null;
		if (murs.boss?.alive !== false && home > 0 && level.bossPost) {
			const [x, z, ry] = level.bossPost;
			this.murBoss = new Bandit(new THREE.Vector3(x, 0, z), BOSS_GUN, this.garrison, { post: { x, z, ry }, boss: true });
			this.bandits.push(this.murBoss);
		}
		// запасы — по шкафам склада и будки главаря поровну; остальная мебель — как в любом доме
		const store = level.containers.filter((c) => /Storage|Boss/.test(c.building));
		for (const c of level.containers) { c.items = store.includes(c) ? [] : rollLoot(c.loot); c.searched = false; c.spark.visible = true; }
		Object.entries(murs.stash).forEach(([kind, n], i) => {
			if (!(n > 0) || !store.length) return;
			const parts = Math.min(store.length, Math.max(1, Math.ceil(n / 30)));
			for (let k = 0; k < parts; k++) {
				const q = Math.floor(n / parts) + (k < n % parts ? 1 : 0);
				if (q > 0) store[(i + k) % store.length].items.push([realId(kind), q]);
			}
		});
	},


	/** Запомнить кластер, каким его оставляем: живые заражённые, обысканное, лежащее на земле. */
	snapshot() {
		const c = this.world.clusters[this.loc];
		if (!c || !level) return;
		const alive = this.enemies.filter((e) => e.alive);
		c.saved = {
			// lead — номер вожака стаи в этом же списке (−1 — сам по себе)
			enemies: alive.map((e) => ({ type: e.type, x: +e.pos.x.toFixed(2), z: +e.pos.z.toFixed(2), hp: Math.ceil(e.hp), lead: alive.indexOf(e.leader), ...(e.horde ? { h: 1, hl: e.hordeLead ? 1 : 0 } : {}) })),
			containers: level.containers.map((k) => ({ items: k.items ?? [], searched: !!k.searched })),
			pickups: this.pickups.map((p) => ({ kind: p.kind, x: +p.mesh.position.x.toFixed(2), z: +p.mesh.position.z.toFixed(2), value: p.value, ground: p.ground })),
			// следы боя и разрушения: пропадут только с перезагрузкой кластера
			marks: marks.serialize(),
			barrels: this.barrels.map((b, i) => (b.alive ? -1 : i)).filter((i) => i >= 0),
		};
	},

	/** Сохранить игру (в localStorage; в приватном режиме может не получиться — тогда без сохранения). */
	save() {
		if (this.state !== 'play' || !this.player?.alive) return;
		if (NODES[this.loc].kind === 'cluster') this.snapshot();
		saveGame({ world: this.world, bag: this.bag, kit: this.kit, stash: this.stash, roster: this.roster, perks: this.perks, hp: Math.ceil(this.player.hp), from: this.from ?? null });
	},

	/** Уйти по дороге в to: время мира уходит на путь, за это время кластеры могут перезагрузиться. */
	/**
	 * Дорога в любую локацию: по кратчайшему пути через другие кластеры (shortestPath), время складывается (гараж на базе —
	 * быстрее), за каждый переход герой выпивает живчик — не хватило, остаёмся (false; карта Улья покажет, сколько нужно).
	 */
	travel(to, { car = false } = {}) {
		if (this.state !== 'play') return;
		const from = this.loc, path = shortestPath(from, to), cost = path.nodes.length - 1, have = this.bag.zhivchik ?? 0;
		let time = Math.round(path.time * this.basePerks().travel);
		if (car) {
			// на машине: без живчика, вдвое быстрее; бензин по переходам, машина изнашивается и остаётся там, куда приехал
			const c = this.world.car, fuel = cost * CAR.perHop;
			if (!this.carHere()) { this.toast('Машины здесь нет', 'warn'); return false; }
			if (c.cond <= 0) { this.toast('Машина сломана — почини деталями', 'warn'); return false; }
			if (fuel > c.fuel) { this.toast(`Бензина нужно ${fuel} л — в баке ${Math.round(c.fuel)} л`, 'warn'); return false; }
			c.fuel -= fuel;
			c.cond = Math.max(0, c.cond - cost * (CAR.wear[0] + Math.random() * (CAR.wear[1] - CAR.wear[0])));
			c.at = to;
			time = Math.round(time * CAR.speed);
			this.toast(`Едешь на УАЗе: −${fuel} л бензина (в баке ${Math.round(c.fuel)} л), состояние ${Math.round(c.cond)} %${c.cond <= 0 ? ' — заглох у въезда, нужен ремонт' : ''}`);
		} else {
			if (cost > have) { this.toast(`На дорогу нужно ${cost} ${plural(cost, ITEMS.zhivchik.forms)} — есть ${have}`, 'warn'); return false; }
			this.bag.zhivchik = have - cost;
			if (cost > 0) this.toast(`Выпит ${cost === 1 ? 'живчик' : `${cost} ${plural(cost, ITEMS.zhivchik.forms)}`} на дорогу${cost > 1 ? ` (${cost} ${plural(cost, ['переход', 'перехода', 'переходов'])})` : ''}`);
		}
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
			else if (node.kind === 'murs') this.banner(node.name, `Логово муров — около ${this.world.murs.count} стволов. ${this.campHostile() ? 'Ты у них во врагах: заметят — не уйдёшь' : `${STANCE[this.mursStance()][0].toUpperCase()}${STANCE[this.mursStance()].slice(1)}: не стреляй первым и не лезь в их шкафы. У костра — барыга и бригадир (боец на одну вылазку)`}`);
			else if (node.kind === 'ext') this.banner(node.name, `Форпост внешников — около ${this.world.ext.count} бойцов в броне. Заметят — не уйдёшь`);
			else if (node.kind === 'base') this.banner(node.name, this.baseGreeting());
			else if (!this.raidSquad && !this.huntSquad) this.banner(node.name, `До перезагрузки ${approx(timeLeft(this.world, to))}${visited ? ' · здесь ты уже был' : ''}`);
			setTimeout(() => $('travel').classList.add('hidden'), 350);
		}, 30));
	},

	/**
	 * Гибель: всё, что было с собой, — оружие, патроны, гранаты, живчики — осталось там, где погиб; валюта
	 * (спораны, горох, чёрный жемчуг) при герое; сложенное в хранилище цело. Герой приходит в себя в стабе.
	 * Совсем без оружия и денег — охрана стаба выдаёт старый пожарный топор.
	 */
	respawn() {
		// бункер 3-го уровня: ствол, что был в руках, остаётся с героем (с магазином и износом)
		const bp = this.basePerks(), kept = bp.keepGun && this.kit.gear.gun ? { id: this.kit.gear.gun, mag: this.kit.mags[this.kit.gear.gun], wear: this.kit.wear[this.kit.gear.gun] } : null;
		for (const k of STORABLE) this.bag[k] = 0;
		// доработки остаются у стволов в хранилище и у ствола, что остался в руках
		const mods = Object.fromEntries(Object.entries(this.kit.mods ?? {}).filter(([id]) => id === kept?.id || this.stash?.guns?.[id]));
		this.kit = { gear: { melee: 'fists', gun: null }, owned: [], mags: {}, wear: {}, mods };
		if (kept) { this.kit.owned.push(kept.id); this.kit.gear.gun = kept.id; if (kept.mag != null) this.kit.mags[kept.id] = kept.mag; if (kept.wear != null) this.kit.wear[kept.id] = kept.wear; }
		// бункер 2-го уровня: тревожный набор — Glock 17, 34 патрона, живчик
		if (bp.respawnKit) {
			if (!this.kit.owned.includes('glock17')) this.kit.owned.push('glock17');
			this.kit.gear.gun ??= 'glock17';
			this.kit.mags.glock17 ??= WEAPONS.glock17.mag;
			this.bag.ammo919 = (this.bag.ammo919 ?? 0) + 34;
			this.bag.medkit = (this.bag.medkit ?? 0) + 1;
		}
		const broke = !Object.keys(this.stash.guns).length && (this.bag.spore ?? 0) < WEAPONS.fireaxe.price;
		if (broke) { this.kit.owned.push('fireaxe'); this.kit.gear.melee = 'fireaxe'; this.kit.wear.fireaxe = Math.ceil(WEAPONS.fireaxe.durability / 2); }
		if (!(this.bag.zhivchik > 0)) this.bag.zhivchik = 1; // без живчика из стаба не уйти — лекарь наливает один
		const who = this.party.length ? 'Наёмники вытащили тебя' : 'Тебя вытащили рейдеры'; // и разошлись по койкам
		// сожрали — кластер запоминает, каким его оставили: кровь, разрушения, выпавшее (перезагрузка всё смыла бы и так)
		if (this.deathReason !== 'reload' && NODES[this.loc]?.kind === 'cluster') this.snapshot();
		advance(this.world, 90);
		this.player?.dispose();
		this.player = null;
		this.begin();
		// бункер на базе — возрождение там
		const atBase = this.basePerks().respawnAtBase;
		this.enter(atBase ? 'base' : 'stab', undefined);
		if (atBase) {
			if (bp.respawnKit && this.player) this.player.hp = this.player.maxHp;
			const extra = [kept && `${WEAPONS[kept.id].name} остался в руках`, bp.respawnKit && 'в бункере — тревожный набор: Glock 17, патроны, аптечка', broke && 'в бункере нашёлся старый топор'].filter(Boolean).join('; ');
			this.banner('База «Опорный»', `${who} — очнулся в бункере базы. Всё, что было с собой, осталось там${extra ? `; ${extra}` : ''}`);
		}
		else this.banner('Стаб «Полис»', `${who}. Всё, что было с собой, осталось там${broke ? '; охрана выдала старый топор' : ' — запас в хранилище, в твоей комнате'}`);
	},

	/** Ствол или расходник (kind) — из рюкзака в хранилище (всё, что есть этого вида). */
	toStash(kind) {
		const kit = this.kit, p = this.player;
		if (WEAPONS[kind]) {
			if (!kit.owned.includes(kind)) return;
			this.stash.guns[kind] = { mag: kit.mags[kind] ?? 0, wear: kit.wear[kind] };
			kit.owned = kit.owned.filter((w) => w !== kind);
			delete kit.mags[kind]; delete kit.wear[kind];
			const slot = WEAPONS[kind].slot;
			if (kit.gear[slot] === kind) kit.gear[slot] = kit.owned.find((w) => WEAPONS[w].slot === slot) ?? (slot === 'melee' ? 'fists' : null);
			if (p) {
				if (p.hold === 'gun' && !kit.gear.gun) p.hold = 'melee';
				p.models[kind]?.removeFromParent();
				p.attachGear();
			}
		} else if (STORABLE.includes(kind) && (this.bag[kind] ?? 0) > 0) {
			this.stash.bag[kind] = (this.stash.bag[kind] ?? 0) + this.bag[kind];
			this.bag[kind] = 0;
		}
		this.hud();
		this.save();
	},

	/** Из хранилища — с собой; ствол сразу в слот, если слот пуст. */
	fromStash(kind) {
		const kit = this.kit;
		if (WEAPONS[kind]) {
			const st = this.stash.guns[kind];
			if (!st) return;
			delete this.stash.guns[kind];
			// такой ствол уже при себе — второй не нужен: патроны из его магазина — в рюкзак
			if (kit.owned.includes(kind)) {
				const A = WEAPONS[kind].ammo;
				if (A && st.mag) this.bag[A] = (this.bag[A] ?? 0) + st.mag;
				this.toast(`${WEAPONS[kind].name} уже при себе${A && st.mag ? ` — ${st.mag} патронов из его магазина в рюкзак` : ''}`);
				this.hud(); this.save();
				return;
			}
			kit.owned.push(kind);
			if (WEAPONS[kind].ammo) kit.mags[kind] = st.mag ?? 0;
			if (WEAPONS[kind].durability) kit.wear[kind] = st.wear ?? WEAPONS[kind].durability;
			const slot = WEAPONS[kind].slot;
			if (!kit.gear[slot] || kit.gear[slot] === 'fists') { kit.gear[slot] = kind; this.player?.attachGear(); }
		} else if ((this.stash.bag[kind] ?? 0) > 0) {
			this.bag[kind] = (this.bag[kind] ?? 0) + this.stash.bag[kind];
			delete this.stash.bag[kind];
		}
		this.hud();
		this.save();
	},

	toStashAll() {
		for (const id of [...this.kit.owned]) this.toStash(id);
		for (const k of STORABLE) this.toStash(k);
	},

	fromStashAll() {
		for (const id of Object.keys(this.stash.guns)) this.fromStash(id);
		for (const k of Object.keys(this.stash.bag)) this.fromStash(k);
	},

	/** Шум: заражённые в радиусе r идут на звук. */
	/**
	 * Шум (выстрел, взрыв) на r м: заражённые рядом просыпаются. human — стрелял человек (герой, наёмник): муры без
	 * цели, кому слышно (ближе 70 % радиуса), идут проверить — дальние чуть позже.
	 */
	noise(pos, r, human = false) {
		for (const e of this.enemies) if (e.state === 'idle' && e.pos.distanceTo(pos) < r) e.alert();
		if (!human) return;
		for (const b of this.bandits) {
			if (!b.alive || b.target || b.aggro || b.alarmT != null || b.panicT > 0) continue;
			const d = Math.hypot(b.pos.x - pos.x, b.pos.z - pos.z);
			if (d < r * 0.7) { b.alarmT = 0.4 + d * 0.06; b.alarmPos = pos.clone(); }
		}
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

	/** Ближайший враг героя и его бойцов: заражённый, внешник или мур в ссоре с героем (муры в мире — не враги). */
	nearestEnemy(from, range, needSight = false) {
		let best = null, bd = range;
		for (const e of this.bandits.length ? [...this.enemies, ...this.bandits] : this.enemies) {
			if (!e.alive || (e.faction && !this.hostile(e))) continue;
			const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z);
			if (d < bd && (!needSight || lineOfSight(from, e.pos))) { bd = d; best = e; }
		}
		return best;
	},

	// Поле путей: BFS от клетки игрока по сетке навигации
	updateFlow() { this.flow = flowFrom(this.player.pos.x, this.player.pos.z, this.flow); },

	flowDir(pos) { return this.flow ? flowStep(this.flow, pos) : null; },

	onKill(e) {
		// «Убито» и задания — только то, что убили герой, его наёмники и часовые (не муры, не внешники)
		const mine = heroSide(e.lastHitBy);
		if (mine) this.kills++;
		if (e.lastHitBy instanceof Merc) this.awardXp(e.lastHitBy.state, XP_KILL[e.type] ?? 1, 'бой');
		// заражённый кидался на мура, а убил его герой или боец — муры запомнят (не чаще раза в 30 с)
		if (mine && e.lastHitBy && e.foe instanceof Bandit && e.foe.faction === 'murs' && !this.hostile(e.foe) && this.world.time - (this.world.murs.helpAt ?? -1e9) > 30) {
			this.world.murs.helpAt = this.world.time;
			this.murRep(MUR_REP.helped);
		}
		if (e.hordeLead) this.hordeLeaderDied(e);
		if (mine) this.questEvent?.('kill', e);
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
		// элита: споровый мешок богатый — горох и две чёрные жемчужины всегда
		if (e.type === 'elite') {
			this.spawnPickup('peas', near(-0.7, 0.6), 4 + Math.floor(Math.random() * 3));
			this.spawnPickup('pearl', near(0.7, -0.5), 1);
			this.spawnPickup('pearl', near(0.2, 0.8), 1);
			const red = Math.random() < RED_PEARL_ELITE;
			if (red) this.spawnPickup('redpearl', near(-0.3, -0.8), 1);
			this.banner('Элита убита', `Высшая стадия заражённого мертва — в споровом мешке две чёрные жемчужины${red ? ' и красная!' : ''}`);
		}
		// скребер: красная жемчужина всегда, три чёрных, много гороха
		if (e.type === 'skreber') {
			this.spawnPickup('peas', near(-0.9, 0.7), 8 + Math.floor(Math.random() * 5));
			for (const [dx, dz] of [[0.9, -0.6], [0.3, 1.0], [-1.0, -0.4]]) this.spawnPickup('pearl', near(dx, dz), 1);
			this.spawnPickup('redpearl', near(0, -1.1), 1);
			this.banner('Скребер убит', 'Хозяин Провала мёртв — в споровом мешке красная жемчужина и три чёрных');
		}
		this.hud();
	},

	/** Предмет на земле: висит и светится; ground — лежит на земле. */
	spawnPickup(kind, pos, value = 1, { ground = false } = {}) {
		const mesh = new THREE.Group();
		// образец предмета — один на вид (сетки и материалы общие у всех таких на земле)
		const model = (pickupProto[kind] ??= makeItemMesh(kind)).clone();
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
		kind = realId(kind); // убранное (ammo9 из старых запасов муров и т. п.) — ближайшее новое
		if (kind !== 'tag' && !WEAPONS[kind] && !ITEMS[kind]) { console.warn('неизвестный предмет', kind); return; }
		if (kind === 'tag') { this.questEvent('tag'); Sfx.chime(); this.toast('Жетон пропавшего — отнеси на доску заданий'); return; }
		const W = WEAPONS[kind];
		if (W) {
			const kit = this.kit;
			if (kit.owned.includes(kind) || this.stash.guns[kind]) {
				// такой уже есть (при себе или в хранилище) — второй не берём: только патроны
				if (W.ammo) { this.bag[W.ammo] = (this.bag[W.ammo] ?? 0) + 4; this.toast(`${W.name} уже есть${kit.owned.includes(kind) ? '' : ' (в хранилище)'} — забрал 4 патрона ${AMMO[W.ammo]}`); }
				if (W.durability) { kit.wear[kind] = W.durability; this.toast(`${W.name}: сменил затупленный на целый`); this.hud(); }
			} else {
				kit.owned.push(kind);
				if (W.ammo) kit.mags[kind] = Math.min(W.mag, 2);
				if (W.durability) kit.wear[kind] = W.durability;
				if (!kit.gear[W.slot] || kit.gear[W.slot] === 'fists') { kit.gear[W.slot] = kind; this.player.attachGear(); this.toast(`Найден: ${W.name}! Сразу в слот`); }
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
	 * к бойцу подходишь — «Снарядить»: патроны, живчик, взять с собой или оставить у койки.
	 */
	nearStation() {
		const p = this.player.pos;
		let best = null, bd = Infinity;
		const consider = (s) => { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < s.r && d < bd) { bd = d; best = s; } };
		for (const s of level.stations) consider(s);
		if (this.inRoom || this.atBase) {
			for (const m of this.mercs) if (m.alive) consider({ id: 'merc', merc: m, name: m.def.name, label: 'Снарядить', x: m.pos.x, z: m.pos.z, r: m.state.out ? 2.8 : 1.6 });
		} else if (!best && this.party.length && (this.player.moveMag ?? 0) < 0.1 && !this.nearContainer() && !this.nearestEnemy(p, 9)) {
			// в вылазке: стоишь рядом со своим бойцом, тайника рядом нет, врагов в 9 м нет — «Снарядить»
			for (const m of this.mercs) if (m.alive && m.state.out) consider({ id: 'merc', merc: m, name: m.def.name, label: 'Снарядить', x: m.pos.x, z: m.pos.z, r: 2.2 });
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
			if (s.id === 'stash') this.stashWindow.open();
			if (s.id === 'info') this.intelWindow.open();
			if (s.id === 'merc') this.partyWindow.open({ merc: s.merc.state.id });
			if (s.id === 'terminal') this.terminal.open();
			if (s.id === 'armory') this.trade.open({ armory: true });
			if (s.id === 'medbay') this.healFree();
			if (s.id === 'repair') this.modsWindow.open(); // мастерская: починить топор, доработать стволы
			if (s.id === 'eat') this.eatCanteen();
			if (s.id === 'radio') this.radioIntel();
			if (s.id === 'basemercs') this.partyWindow.open({ base: true });
			if (s.id === 'quests') this.questWindow.open(s.name);
			if (s.id === 'free') this.freePrisoner(s.idx);
			if (s.id === 'znahar') this.znaharHeal();
			if (s.id === 'barter') this.trade.open({ barter: true });
			if (s.id === 'murtrade') this.murTrade();
			if (s.id === 'craft') this.craftWindow.open();
			if (s.id === 'car') this.driveCar();
			if (s.id === 'murhire') this.murHire();
			return;
		}
		const c = this.nearContainer();
		if (!c) return;
		// в «Карьере» всё — муров: полез в шкаф при них — воровство, весь «Карьер» в бой (сначала — предупреждение)
		if (NODES[this.loc].kind === 'murs' && !this.campHostile()) {
			if (this.time - (this.theftAt ?? -9) > 4) { this.theftAt = this.time; this.toast('Это шкаф муров: полезешь — весь «Карьер» откроет огонь. Нажми ещё раз, чтобы обыскать', 'warn'); return; }
			const b = this.bandits.find((x) => x.alive && x.faction === 'murs' && x.squad === this.garrison);
			if (b) this.provokeMurs(b, 'тебя поймали на воровстве');
		}
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
				if (NODES[this.loc].kind === 'murs') for (const [kind, n] of c.items) this.world.murs.stash[kind] = Math.max(0, (this.world.murs.stash[kind] ?? 0) - n);
				if (NODES[this.loc].kind === 'ext') for (const [kind, n] of c.items) this.world.ext.stash[kind] = Math.max(0, (this.world.ext.stash[kind] ?? 0) - n);
				c.items = [];
			}
		}
		// подсказка у мебели и у жителей стаба
		const st = this.searching ? null : this.nearStation();
		const c = st ? null : this.searching?.c ?? this.nearContainer();
		el.classList.toggle('hidden', (!c && !st) || !this.player.alive);
		const face = st ? this.icons[st.merc ? `merc_${st.merc.state.id}` : { trade: 'trader', rest: 'medic', mercs: 'recruiter', info: 'informant', murtrade: 'trader', murhire: 'recruiter' }[st.id] ?? 'portrait'] : null;
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

	/** Перевязаться аптечкой из рюкзака (кнопка аптечки, H). */
	drink() {
		const p = this.player;
		if (!p?.alive || !(this.bag.medkit > 0)) { if (p?.alive) this.toast('Аптечек нет — продаёт торговец, лежат в аптечных шкафчиках', 'warn'); return; }
		if (p.hp >= p.maxHp) { this.toast('Здоровье и так полное'); return; }
		this.bag.medkit--;
		p.hp = Math.min(p.maxHp, p.hp + 45);
		Sfx.drink();
		this.toast('Аптечка: +45 здоровья');
		this.hud();
	},

	/** Съесть чёрную жемчужину: здоровье навсегда больше (до предела) и сразу полное. */
	eatPearl() {
		const p = this.player;
		if (!p?.alive || !(this.bag.pearl > 0)) return;
		if (this.perks.maxHp >= MAX_HP_CAP) { this.toast(`Здоровье и так на пределе (${MAX_HP_CAP}) — лучше продай торговцу`, 'warn'); return; }
		this.bag.pearl--;
		this.perks.maxHp = Math.min(MAX_HP_CAP, this.perks.maxHp + PEARL_HP);
		p.maxHp = this.heroMaxHp();
		p.hp = p.maxHp;
		Sfx.chime();
		this.banner('Организм окреп', `Здоровье навсегда ${p.maxHp} (+${PEARL_HP})`);
		this.hud();
		this.save();
	},

	/** Съесть красную жемчужину: здоровье навсегда +40 (предел — 300), и сразу полное. */
	eatRedPearl() {
		const p = this.player;
		if (!p?.alive || !(this.bag.redpearl > 0)) return;
		if (this.perks.maxHp >= RED_HP_CAP) { this.toast(`Здоровье и так на пределе (${RED_HP_CAP}) — лучше продай торговцу`, 'warn'); return; }
		this.bag.redpearl--;
		this.perks.maxHp = Math.min(RED_HP_CAP, this.perks.maxHp + RED_PEARL_HP);
		p.maxHp = this.heroMaxHp();
		p.hp = p.maxHp;
		Sfx.chime();
		this.banner('Красная жемчужина', `Дар окреп: здоровье навсегда ${p.maxHp} (+${RED_PEARL_HP})`);
		this.hud();
		this.save();
	},

	/** Продать красную жемчужину торговцу. */
	sellRedPearl() {
		if (!(this.bag.redpearl > 0)) return;
		this.bag.redpearl--;
		this.bag.spore = (this.bag.spore ?? 0) + RED_PEARL_PRICE;
		Sfx.coins();
		this.toast(`Красная жемчужина → ${RED_PEARL_PRICE} споранов`);
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
		if (W && this.stash.guns[offer.id]) { this.toast(`${W.name} уже лежит в хранилище`, 'warn'); return; }
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
		return true;
	},

	/** Обменять n горошин на спораны. */
	/**
	 * Продать торговцу: ствол (kind — id оружия; что в магазине — в рюкзак, в слот — запасное того же слота или
	 * кулаки) или n патронов/гранат. Цена — trade.js (sellPrice).
	 */
	sell(kind, n = 1) {
		const kit = this.kit, W = WEAPONS[kind], p = this.player;
		let price;
		if (W) {
			if (kind === 'fists' || !kit.owned.includes(kind)) return;
			price = sellPrice(kind, 1, W.durability ? kit.wear[kind] ?? W.durability : null);
			if (W.ammo && kit.mags[kind] > 0) this.bag[W.ammo] = (this.bag[W.ammo] ?? 0) + kit.mags[kind];
			kit.owned = kit.owned.filter((w) => w !== kind);
			delete kit.mags[kind]; delete kit.wear[kind]; delete kit.mods?.[kind];
			if (kit.gear[W.slot] === kind) kit.gear[W.slot] = kit.owned.find((w) => WEAPONS[w].slot === W.slot) ?? (W.slot === 'melee' ? 'fists' : null);
			if (p) {
				if (p.hold === 'gun' && !kit.gear.gun) p.hold = 'melee';
				p.models[kind]?.removeFromParent();
				delete p.models[kind];
				p.attachGear();
			}
			this.toast(`${W.name} продан — +${price} ${plural(price, ITEMS.spore.forms)}`);
		} else {
			if (!SELLABLE.includes(kind)) return;
			n = Math.min(n, this.bag[kind] ?? 0);
			price = sellPrice(kind, n);
			if (n <= 0 || price < 1) return;
			this.bag[kind] -= n;
			this.toast(`${ITEMS[kind].name}: −${n}, +${price} ${plural(price, ITEMS.spore.forms)}`);
		}
		this.bag.spore = (this.bag.spore ?? 0) + price;
		Sfx.coins();
		this.hud();
		this.save();
		return true;
	},

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
		// без живчика из стаба не уйти: лекарь наливает один на дорогу
		const dry = !(this.bag.zhivchik > 0);
		if (dry) this.bag.zhivchik = 1;
		this.banner('Отдых', `Прошло ${approx(REST_TIME)}. Здоровье восстановлено${dry ? '. Лекарь налил живчик на дорогу' : ''}`);
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
		this.mercs = this.roster.filter((st) => st.out || (!st.job && ((level.room && this.homeOf(st) === 'stab') || (level.mercSpots && this.homeOf(st) === 'base')))).map((st) => {
			const m = new Merc(st);
			if (st.out || !m.home) m.place(); else { m.pos.set(m.home.x, 0, m.home.z); m.root.rotation.y = m.home.ry; }
			return m;
		});
		this.slotMercs();
		this.renderPartyBar();
	},

	/** Места в строю: первые двое — сзади слева и справа, третий и четвёртый — шире и дальше (Merc.spot). */
	slotMercs() {
		const party = this.party;
		for (const m of this.mercs) m.slot = Math.max(0, party.indexOf(m.state));
	},

	/** Ближайший живой, на кого кидаются заражённые: герой, наёмник отряда или мур. */
	foeFor(pos) {
		let best = this.player, bd = this.player?.alive ? Math.hypot(this.player.pos.x - pos.x, this.player.pos.z - pos.z) : Infinity;
		for (const m of this.mercs) {
			if (!m.alive || !m.state.out) continue;
			const d = Math.hypot(m.pos.x - pos.x, m.pos.z - pos.z);
			if (d < bd) { bd = d; best = m; }
		}
		for (const b of this.bandits) {
			if (!b.alive) continue;
			const d = Math.hypot(b.pos.x - pos.x, b.pos.z - pos.z);
			if (d < bd) { bd = d; best = b; }
		}
		return best;
	},

	merc(id) { return this.roster.find((m) => m.id === id); },

	// ---------- Наёмники на базе «Опорный»: посты и вылазки без героя (game/mercs.js) ----------

	/** Герой на своей базе. */
	get atBase() { return NODES[this.loc]?.kind === 'base'; },
	/** Сколько постов для наёмников на базе (с казармой — больше). */
	postsMax() { return this.world.base?.built.includes('barracks') ? BASE_POSTS_BARRACKS : BASE_POSTS; },
	/** Кто на постах — в учёт базы (оборона, часовые на месте). */
	syncGuards() {
		if (!this.world.base) return;
		this.world.base.guards = this.roster.filter((st) => st.job?.kind === 'post').map((st) => ({ id: st.id, gun: MERCS[st.id].weapon, tint: MERCS[st.id].tint }));
	},
	/** Сколько секунд мира займёт вылазка в кластер at: дорога с базы туда и обратно (гараж — быстрее) и сам кластер. */
	tripTime(at) { return Math.round(2 * pathTime('base', at) * this.basePerks().travel + TRIP_WORK); },
	/** Боец сменился на базе: часовые и отряд — заново. */
	mercsMoved(wasPost) {
		this.syncGuards();
		this.spawnMercs();
		if (this.atBase && wasPost !== undefined) this.rebuildBase();
		this.renderPartyBar();
		this.save();
	},

	/** Поставить бойца на пост базы: часовой у ворот или во дворе, +10 к обороне (с казармой 2-го уровня — +15). */
	postMerc(id) {
		const st = this.merc(id);
		if (!st || st.job) return;
		if (this.roster.filter((m) => m.job?.kind === 'post').length >= this.postsMax()) { this.toast(`Все посты заняты (${this.postsMax()})${this.postsMax() < BASE_POSTS_BARRACKS ? ' — с казармой постов больше' : ''}`, 'warn'); return; }
		st.out = false;
		st.job = { kind: 'post' };
		this.toast(`${MERCS[id].name} заступил на пост на базе — оборона выше`);
		this.mercsMoved(true);
	},

	/** Снять с поста: боец возвращается к своей койке в стабе. */
	unpostMerc(id) {
		const st = this.merc(id);
		if (st?.job?.kind !== 'post') return;
		st.job = null;
		this.toast(`${MERCS[id].name} снят с поста — ждёт ${this.homeText(st)}`);
		this.mercsMoved(true);
	},

	/** Отправить бойца на вылазку в кластер at без героя: вернётся с добычей (на склад базы), раненым — или не вернётся. */
	sendMerc(id, at) {
		const st = this.merc(id);
		if (!st || st.job?.kind === 'trip' || NODES[at]?.kind !== 'cluster') return;
		const wasPost = st.job?.kind === 'post' ? true : undefined;
		st.out = false;
		this.resupplyMercs(true); // перед вылазкой — полный боекомплект из казны
		const t = this.tripTime(at);
		st.job = { kind: 'trip', at, end: this.world.time + t };
		Sfx.reload();
		this.toast(`${MERCS[id].name} ушёл на вылазку в «${NODES[at].short}» — вернётся ${approx(t).replace('~', 'примерно через ')}`);
		this.mercsMoved(wasPost);
	},

	/** Вылазки, срок которых вышел: итог — добыча на склад базы (забрать у терминала), раны или гибель. */
	resolveTrips() {
		const b = this.world.base;
		for (const st of [...this.roster]) {
			const job = st.job;
			if (job?.kind !== 'trip' || this.world.time < job.end) continue;
			const D = MERCS[st.id], r = resolveTrip(st, NODES[job.at]?.danger ?? 1, this.basePerks().tripBonus);
			st.job = null;
			// патроны сжёг из магазина и запаса
			const fromMag = Math.min(st.mag, r.used);
			st.mag -= fromMag; st.ammo = Math.max(0, st.ammo - (r.used - fromMag));
			this.markRaided(job.at, { kill: 0.2, loot: 0.25 }); // зачистил часть кластера
			let text;
			if (r.dead) {
				this.roster = this.roster.filter((m) => m !== st);
				text = `${D.name} не вернулся с вылазки в «${NODES[job.at].short}»`;
				this.banner(`${D.name} погиб`, `Не вернулся с вылазки в «${NODES[job.at].short}». Улей вернёт его в стаб — но уже не твоим`);
				Sfx.death('human');
			} else {
				st.hp = Math.max(1, st.hp - r.hurt);
				this.awardXp(st, XP_TRIP + 3 * (NODES[job.at]?.danger ?? 1), 'вылазка с базы');
				for (const [k, n] of Object.entries(r.loot)) b.stock[k] = (b.stock[k] ?? 0) + n;
				const got = stockText(r.loot);
				text = `${D.name} вернулся из «${NODES[job.at].short}»${r.hurt ? ', ранен' : ''}${got ? `: ${got}` : ' ни с чем'}`;
				this.toast(`${text} — добыча на складе базы, забрать у терминала; сам — ${this.homeText(st)}`);
			}
			b.trips.unshift({ text, time: this.world.time });
			b.trips.length = Math.min(b.trips.length, 5);
			this.spawnMercs();
			this.renderPartyBar();
			this.save();
		}
	},

	/**
	 * Нанять у вербовщика: боец идёт в комнату героя и ждёт у своей койки; коек нет — сразу на базу «Опорный» (места —
	 * по казарме, baseBeds). Уже нанятые остаются где были.
	 */
	hire(id) {
		const D = MERCS[id];
		if (this.merc(id)) return;
		const where = this.freeBed('stab') != null ? 'stab' : this.freeBed('base') != null ? 'base' : null;
		if (!where) { this.toast(`Мест нет: в комнате ${ROOM_BEDS} коек, на базе ${this.baseBeds()} — улучши казарму на базе`, 'warn'); return; }
		if ((this.bag.spore ?? 0) < D.price) { this.toast('Не хватает споранов', 'warn'); return; }
		this.bag.spore -= D.price;
		const st = newMerc(id, this.freeBed(where));
		st.home = where;
		this.roster.push(st);
		if (where === 'stab' && level.room) {
			const m = new Merc(st);
			m.place();
			this.mercs.push(m);
		}
		Sfx.coins();
		this.toast(where === 'stab' ? `${D.name} (${CLASSES[D.cls].name.toLowerCase()}) нанят — идёт к своей койке в твоей комнате (жилой блок у казармы)` : `${D.name} (${CLASSES[D.cls].name.toLowerCase()}) нанят — коек в комнате нет, ушёл на базу «Опорный» (там ${this.roster.filter((m) => this.homeOf(m) === 'base').length}/${this.baseBeds()})`);
		this.renderPartyBar();
		this.hud();
		this.save();
	},

	/** Где живёт боец: 'stab' (комната героя) или 'base' (база «Опорный»). */
	homeOf(st) { return st?.temp ? 'temp' : st?.home === 'base' ? 'base' : 'stab'; },
	/** Сколько мест для наёмников на базе: без казармы — у костра, с казармой — по её уровню (BASE_BEDS). */
	baseBeds() { const b = this.world.base; return BASE_BEDS[b?.built.includes('barracks') ? Math.min(3, b.lv?.barracks ?? 1) : 0]; },
	/** Свободное место дома where ('stab' — койка в комнате, 'base' — у казармы); null — мест нет. */
	freeBed(where) {
		const cap = where === 'base' ? this.baseBeds() : ROOM_BEDS;
		for (let b = 0; b < cap; b++) if (!this.roster.some((m) => this.homeOf(m) === where && m.bed === b)) return b;
		return null;
	},
	/** Точка дома бойца в этой локации (койка в комнате, место у казармы) или null. */
	homeSpot(st) { return (this.homeOf(st) === 'base' ? level.mercSpots : level.room?.spots)?.[st.bed ?? 0] ?? null; },
	/** «у своей койки в стабе» / «на базе, у казармы». */
	homeText(st) { return this.homeOf(st) === 'base' ? 'на базе «Опорный», у казармы' : 'у своей койки в стабе'; },
	/** Герой у дома бойца: в комнате стаба (живёт в стабе) или на базе (живёт на базе). */
	atHomeOf(st) { return this.homeOf(st) === 'base' ? this.atBase : this.inRoom; },
	/** Можно взять с собой: боец дома, не на посту и не на вылазке. */
	canTake(id) { const st = this.merc(id); return !!st && !st.out && !st.job && this.atHomeOf(st); },
	/** Можно оставить: в комнате стаба или на базе — у себя дома или там, где есть свободное место. */
	canLeave(id) {
		const st = this.merc(id);
		if (!st?.out || st.temp) return false; // мур на одну вылазку — без койки
		if (this.inRoom) return this.homeOf(st) === 'stab' || this.freeBed('stab') != null;
		if (this.atBase) return this.homeOf(st) === 'base' || this.freeBed('base') != null;
		return false;
	},
	/** Можно переселить (стаб ↔ база): боец дома, рядом с героем. Хватит ли мест — проверяет relocate. */
	canRelocate(id) { return this.canTake(id) && !this.merc(id)?.temp; },

	/** Переселить бойца: из комнаты стаба на базу «Опорный» или с базы в стаб (если там есть место). */
	relocate(id) {
		const st = this.merc(id);
		if (!st || !this.canRelocate(id)) return;
		const to = this.homeOf(st) === 'base' ? 'stab' : 'base', bed = this.freeBed(to);
		if (bed == null) { this.toast(to === 'base' ? `На базе мест нет (${this.baseBeds()}) — улучши казарму` : `В комнате все ${ROOM_BEDS} коек заняты`, 'warn'); return; }
		st.home = to;
		st.bed = bed;
		Sfx.reload();
		this.toast(to === 'base' ? `${MERCS[id].name} ушёл на базу «Опорный» — ждёт там у казармы (взять с собой — на базе)` : `${MERCS[id].name} ушёл в стаб — ждёт у своей койки в твоей комнате`);
		this.spawnMercs();
		this.save();
	},

	/** Взять бойца на вылазку — у его дома: в комнате стаба или на базе. */
	takeMerc(id) {
		const st = this.merc(id);
		if (!st || st.out || st.job || !this.atHomeOf(st)) return;
		if (this.party.length >= this.partyMax) { this.toast(`С тобой уже ${this.partyMax} — сначала оставь кого-нибудь в комнате`, 'warn'); return; }
		st.out = true;
		this.slotMercs();
		Sfx.reload();
		this.toast(`${MERCS[id].name} идёт с тобой`);
		this.renderPartyBar();
		this.save();
	},

	/** Оставить бойца: в комнате стаба — у койки, на базе — у казармы (живёт в другом месте — переселяется, если есть место). */
	leaveMerc(id) {
		const st = this.merc(id);
		if (!st?.out || !this.canLeave(id)) return;
		const here = this.inRoom ? 'stab' : 'base';
		if (this.homeOf(st) !== here) { st.home = here; st.bed = this.freeBed(here); }
		st.out = false;
		const a = this.mercs.find((m) => m.state === st);
		if (a) { a.home = this.homeSpot(st); a.homeFlow = null; }
		this.slotMercs();
		this.toast(`${MERCS[id].name} остаётся ${here === 'stab' ? 'в комнате' : 'на базе, у казармы'}`);
		this.renderPartyBar();
		this.save();
	},

	/**
	 * Можно ли снарядить бойца: в комнате, на базе — всегда; в вылазке — своего, если стоишь рядом (до 3,2 м).
	 */
	canEquip(id) {
		const st = this.merc(id);
		if (!st || !this.player?.alive) return false;
		if (this.inRoom || this.atBase) return true;
		if (!st.out) return false;
		const a = this.mercs.find((m) => m.state === st && m.alive);
		return !!a && Math.hypot(a.pos.x - this.player.pos.x, a.pos.z - this.player.pos.z) <= 3.2;
	},

	/** Дать наёмнику патроны его калибра: магазин за раз или все (all). */
	giveAmmo(id, all = false) {
		const st = this.merc(id);
		if (!st || !this.canEquip(id)) return;
		const W = WEAPONS[MERCS[st.id].weapon], n = Math.min(this.bag[W.ammo] ?? 0, all ? Infinity : W.mag);
		if (n <= 0) { this.toast(`Нет патронов ${AMMO[W.ammo]}`, 'warn'); return; }
		this.bag[W.ammo] -= n;
		st.ammo += n;
		const actor = this.mercs.find((m) => m.state === st);
		if (actor) actor.warned = false;
		Sfx.reload();
		this.toast(`${MERCS[st.id].name}: +${n} ${plural(n, ITEMS[W.ammo].forms)}`);
		this.hud();
	},

	/** Аптечка наёмнику: сам он не лечится (только в комнате). */
	healMerc(id) {
		const st = this.merc(id), D = MERCS[st?.id];
		if (!st || !this.canEquip(id) || !(this.bag.medkit > 0) || st.hp >= mercMaxHp(st)) return;
		this.bag.medkit--;
		st.hp = Math.min(mercMaxHp(st), st.hp + MERC_HEAL);
		Sfx.drink();
		this.toast(`${D.name}: +${MERC_HEAL} здоровья`);
		this.hud();
	},

	/** Перевязка в аптечку медика — он сам лечит ею раненых. */
	giveMeds(id) {
		const st = this.merc(id);
		if (!st || !this.canEquip(id) || !(this.bag.medkit > 0)) return;
		this.bag.medkit--;
		st.meds = (st.meds ?? 0) + 1;
		Sfx.drink();
		this.toast(`${MERCS[id].name}: в аптечке ${st.meds} ${plural(st.meds, ['перевязка', 'перевязки', 'перевязок'])}`);
		this.hud();
	},

	/** Гранату подрывнику. */
	giveNade(id) {
		const st = this.merc(id);
		if (!st || !this.canEquip(id) || !(this.bag.grenade > 0)) return;
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
		this.syncGuards();
		const a = this.mercs.find((m) => m.state === st);
		a?.dispose();
		this.mercs = this.mercs.filter((m) => m !== a);
		this.slotMercs();
		this.toast(`${MERCS[st.id].name} ушёл из стаба`);
		this.renderPartyBar();
		this.save();
	},

	/**
	 * Опыт бойцу (game/mercs.js: XP_KILL, XP_SORTIE, XP_TRIP): новое звание — точнее, крепче (здоровье прибавляется
	 * сразу), быстрее перезаряжается. Мур на одну вылазку опыта не копит.
	 */
	awardXp(st, n, why = '') {
		if (!st || !(n > 0) || st.temp || !this.roster.includes(st)) return;
		const r0 = rankOf(st), hp0 = mercMaxHp(st);
		st.xp = (st.xp ?? 0) + n;
		const r = rankOf(st);
		if (r === r0) return;
		if (st.hp > 0) st.hp += mercMaxHp(st) - hp0;
		const D = MERCS[st.id];
		Sfx.coins?.();
		this.toast(`★ ${D.name} — ${RANKS[r].name}${why ? ` (${why})` : ''}: точнее на ${Math.round(RANK_BONUS.acc * r * 100)} %, здоровье ${mercMaxHp(st)}, перезарядка быстрее на ${Math.round(RANK_BONUS.reload * r * 100)} %`);
		this.hudParty();
		this.save();
	},

	/** Погиб: койка в комнате освобождается; Улей вернёт его в стаб, но уже вольным — нанять можно заново. */
	mercDied(m, dry = false) {
		this.roster = this.roster.filter((st) => st !== m.state);
		this.slotMercs();
		Sfx.death('human');
		this.banner(`${m.def.name} погиб`, `${dry ? 'Кончились патроны — отбиться было нечем. ' : ''}${m.def.mur ? 'Улей вернёт его в «Карьер», к своим' : 'Улей вернёт его в стаб, к костру, — но уже не твоим: нанять заново можно у вербовщика'}`);
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
			const max = mercMaxHp(st);
			b.querySelector('.pm-face').style.setProperty('--hp', `${Math.max(0, (st.hp / max) * 100).toFixed(0)}%`);
			// у медика — живчики в аптечке, у подрывника — гранаты
			b.querySelector('.pm-ammo').textContent = `${st.mag}+${st.ammo}${st.meds != null ? ` ✚${st.meds}` : ''}${st.nades != null ? ` ✱${st.nades}` : ''}`;
			b.classList.toggle('low', st.hp < max * 0.3 || st.mag + st.ammo === 0);
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
			this.launchGrenade(from, to, 2.0, false, this.player);
		} });
		p.pending.push({ t: 0.5, fn: () => { held.visible = true; } });
		this.hud();
	},

	/** Полёт гранаты дугой; fuse — через сколько после броска взрыв (у героя — 2 с, у подрывника — выдержана). */
	launchGrenade(from, to, fuse = 2.0, warn = false, by = null) {
		const g = makeGrenade();
		// граната мура: красный круг на земле — куда упадёт и докуда достанут осколки (успеть выбежать)
		let ring = null;
		if (warn) {
			ring = new THREE.Mesh(new THREE.RingGeometry(5.5, 6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.5, depthWrite: false }));
			ring.position.set(to.x, 0.07, to.z);
			scene.add(ring);
		}
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
			if (ring) ring.material.opacity = 0.35 + 0.25 * Math.sin(fuse * 14);
			if (fuse <= 0) { byWho(by, () => this.explode(g.position.clone())); return false; }
			return true;
		}, dispose: () => { scene.remove(g); if (ring) { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); } } });
	},

	/**
	 * Снаряд гранатомёта в полёте (W.proj: rocket — прямо, с дымным следом; lob — навесом). Летит со скоростью W.speed
	 * из from по углу a; ракета рвётся у первого заражённого или человека на линии (by — стрелок, его не задевает)
	 * или у стены, ВОГ — на земле в dist м (о стену дома — раньше). Ближе W.arm м — не взвелась: только удар.
	 */
	shell(W, from, a, dist, { own = false, mul = 1, by = null } = {}) {
		const dx = Math.sin(a), dz = Math.cos(a), lob = W.proj === 'lob';
		const far = lob ? Math.min(W.range, Math.max(2, dist + (Math.random() - 0.5) * 1.4)) : W.range * 1.4;
		const end = this.bulletEnd(from, dx, dz, far);
		// навесом ВОГ перелетает низкое (машины, заборы, мешки) — рвётся о стену дома или на земле у цели
		const stop = lob && end.wall && !end.collider?.wall ? { pos: new THREE.Vector3(from.x + dx * far, 0.05, from.z + dz * far), wall: false } : end;
		const len = Math.max(0.3, Math.hypot(stop.pos.x - from.x, stop.pos.z - from.z));
		const m = shellMesh(W.proj);
		m.position.copy(from);
		m.rotation.set(0, a, 0, 'YXZ');
		scene.add(m);
		const T = len / W.speed, apex = lob ? 0.7 + len * 0.16 : 0, y0 = from.y, y1 = lob ? 0.08 : Math.max(0.7, y0 - 0.4);
		let t = 0, puff = 0, done = false;
		const boom = (p, direct) => {
			done = true;
			const flown = Math.hypot(p.x - from.x, p.z - from.z);
			if (flown < (W.arm ?? 0)) {
				// не успела взвестись: тупой удар болванкой
				byWho(by, () => direct?.damage(W.damage * 0.5 * mul, from, 0.8));
				this.impact(p.clone().setY(Math.max(0.15, p.y)), !!stop.wall, 1.4);
				Sfx.chop();
				return;
			}
			byWho(by, () => { direct?.damage(W.damage * mul, from, 1.6, true); this.explode(p.clone(), { ...W.blast, own }); });
			if (!direct && stop.collider && p.distanceTo(stop.pos) < 0.5) this.hitObstacle(stop, W.blast.dmg, from);
		};
		this.fx.push({ life: T + 1, update: (dt) => {
			if (done) return false;
			const s0 = (t / T) * len;
			t = Math.min(T, t + dt);
			const k = t / T, s1 = k * len;
			const y = lob ? y0 + (y1 - y0) * k + Math.sin(Math.PI * k) * apex : y0 + (y1 - y0) * k;
			if (lob) {
				// носом по ходу полёта и кувырок
				const vy = (y1 - y0) / T + (apex * Math.PI / T) * Math.cos(Math.PI * k);
				m.rotation.set(-Math.atan2(vy, len / T), a, (m.rotation.z ?? 0) + dt * 18, 'YXZ');
			}
			m.position.set(from.x + dx * s1, y, from.z + dz * s1);
			if (!lob) {
				for (const e of this.bandits.length ? [...this.enemies, ...this.bandits] : this.enemies) {
					if (!e.alive || e === by) continue;
					const ox = e.pos.x - from.x, oz = e.pos.z - from.z, tt = ox * dx + oz * dz;
					if (tt < s0 - 0.4 || tt > s1 + 0.3) continue;
					if ((ox - dx * tt) ** 2 + (oz - dz * tt) ** 2 > (e.radius + 0.25) ** 2) continue;
					boom(new THREE.Vector3(from.x + dx * tt, 0.7, from.z + dz * tt), e);
					return false;
				}
				if ((puff -= dt) <= 0) { puff = 0.035; this.trailPuff(m.position); }
			}
			if (k >= 1) { boom(stop.pos.clone().setY(lob ? 0.1 : Math.max(0.4, Math.min(y, 1.2))), null); return false; }
			return true;
		}, dispose: () => scene.remove(m) });
	},

	/** Дымный след ракеты: серое облачко повисает, расплывается и тает. */
	trailPuff(pos) {
		particles.spawn({ x: pos.x, y: pos.y, z: pos.z, size: 0.3, grow: 1.4, rise: 0.15, life: 1.3, color: rgb('185,182,172'), alpha: 0.5, fade: 'life' });
	},

	/** Струя газов из раструба РПГ: пыль и дым назад, вспышка. */
	backblast(pos, dir) {
		for (let i = 0; i < 7; i++) {
			const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(i < 2 ? '255,200,120' : '175,165,150'), transparent: true, opacity: i < 2 ? 0.8 : 0.45, depthWrite: false, blending: i < 2 ? THREE.AdditiveBlending : THREE.NormalBlending }));
			s.position.copy(pos);
			s.scale.setScalar(i < 2 ? 0.5 : 0.4);
			const v = dir.clone().multiplyScalar(-(2.5 + Math.random() * 3)).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.6, (Math.random() - 0.5) * 1.5));
			scene.add(s);
			const life = i < 2 ? 0.18 : 1.1, o0 = s.material.opacity;
			this.fx.push({ life, update(dt) { this.life -= dt; s.position.addScaledVector(v, dt); v.multiplyScalar(1 - dt * 2.5); s.scale.multiplyScalar(1 + dt * 2); s.material.opacity = o0 * this.life / life; return this.life > 0; }, dispose() { scene.remove(s); s.material.dispose(); } });
		}
	},

	/**
	 * Цель для гранатомёта: где больше врагов в радиусе разрыва (топтун — за двоих, рубер — за троих, элита — за
	 * четверых, человек — за двоих), на виду, дальше взвода. Нет таких — null (тогда ближайший).
	 */
	blastTarget(from, W) {
		const list = this.bandits.length ? [...this.enemies, ...this.bandits] : this.enemies;
		const wt = (o) => ({ stomper: 2, ruber: 3, elite: 4, skreber: 6 })[o.type] ?? (o.faction ? 2 : 1);
		const R = W.blast.r * 0.7;
		let best = null, bs = 0;
		const calm = (o) => o.faction && !this.hostile(o); // мур в мире: по нему не стреляют, рядом с ним не рвут
		for (const e of list) {
			if (!e.alive || calm(e)) continue;
			const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z);
			if (d > W.range || d < (W.arm ?? 0) + 0.8) continue;
			let sc = -d * 0.02;
			for (const o of list) if (o.alive && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < W.blast.r) sc += calm(o) ? -20 : Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < R ? wt(o) : 0;
			if (sc > bs && lineOfSight(from, e.pos)) { bs = sc; best = e; }
		}
		return best;
	},

	/**
	 * Взрыв: осколки ранят всех в радиусе r (Ф-1 и бочка — 6 м, ПГ-7В — 5, ВОГ-25 — 3,5), и героя с наёмниками тоже
	 * (своя граната из гранатомёта — вполсилы: осколки летят от стрелка), шум на весь кластер.
	 */
	explode(pos, { r = 6, dmg = 170, hurt = 80, own = false } = {}) {
		const R = r, k = R / 6;
		for (const e of [...this.enemies, ...this.bandits]) {
			if (!e.alive) continue;
			const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
			if (d < R) e.damage(dmg * (1 - d / R) ** 0.7, pos, 1.5 * (1 - d / R) + (dmg > 200 ? 0.4 : 0));
		}
		for (const a of [this.player, ...this.mercs]) {
			if (!a?.alive) continue;
			const d = Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z);
			if (d < R) a.hurt(hurt * (1 - d / R) * (own ? 0.5 : 1), pos, undefined, 'blast');
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
		this.fx.push({ life: 0.45, update(dt) { this.life -= dt; const q = 1 - this.life / 0.45; fire.scale.setScalar((1 + q * 5) * (0.6 + 0.4 * k)); fire.material.opacity = 1 - q; flashLight.intensity = 160 * (1 - q); return this.life > 0; }, dispose() { scene.remove(fire); fire.material.dispose(); flashLight.intensity = 0; flashLight.distance = 7; } });
		for (let i = 0; i < Math.round(9 * Math.min(1, k + 0.25)); i++) {
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
		for (let i = 0; i < 14; i++) {
			const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
			debris.spawn({ x: pos.x, y: 0.2, z: pos.z, vx: Math.cos(a) * sp, vy: 3 + Math.random() * 5, vz: Math.sin(a) * sp, scale: 0.6 + Math.random() * 1.2, life: 3, g: 18, bounce: 0.3, floor: 0.05, spin: 20 });
		}
		// выжженное пятно
		marks.scorch(pos);
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

	/** Лужа крови под телом (game/marks.js): растекается секунды четыре и держится до перезагрузки кластера. */
	decal(pos, size) { marks.pool(pos, size); },

	/**
	 * Брызги крови на земле: тёмная клякса с каплями, вытянутая по ходу полёта v (если задан).
	 * Копятся по ходу боя и держатся до перезагрузки кластера; самые старые уступают место, когда их больше 600.
	 */
	splat(pos, size = 0.25, v = null) { marks.splat(pos, size, v); },

	/**
	 * Обрубок (кость bone сжата): кровь бьёт толчками секунды полторы, летят ошмётки, на земле — пятна.
	 * dir — куда шёл удар, power — сила (голова — 1, рука — меньше).
	 */
	stump(bone, dir, power = 1) {
		const at = () => bone.getWorldPosition(new THREE.Vector3());
		const p0 = at();
		for (let i = 0; i < Math.round(5 * power) + 2; i++) {
			const k = 2 + Math.random() * 2;
			gore.spawn({
				x: p0.x, y: p0.y, z: p0.z, scale: 0.5 + Math.random() * (0.8 + power), life: 8, g: 9.8, bounce: 0, floor: 0.03,
				vx: (Math.random() - 0.5) * 3 + dir.x * k, vy: 2 + Math.random() * 3 + dir.y * k, vz: (Math.random() - 0.5) * 3 + dir.z * k,
				land: (x, z, vx, vz) => game.splat(tmpV3.set(x, 0.03, z), 0.35 + Math.random() * 0.25, tmpV4.set(vx, 0, vz)),
			});
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
		const red = rgb('92,6,5');
		for (let i = 0; i < n; i++) {
			const size = 0.07 + Math.random() * 0.12, k = dir ? 1.5 + Math.random() * 2.5 : 0;
			particles.spawn({
				x: pos.x, y: pos.y, z: pos.z, size, g: 9, life: 0.6, color: red, alpha: 1,
				vx: (Math.random() - 0.5) * 3 + (dir?.x ?? 0) * k, vy: Math.random() * 2.5 + (dir?.y ?? 0) * k, vz: (Math.random() - 0.5) * 3 + (dir?.z ?? 0) * k,
				// капля долетела до земли — пятно
				land: Math.random() < 0.3 ? (x, y, z, vx, vz) => game.splat(tmpV3.set(x, 0.05, z), 0.16 + size * 1.3, tmpV4.set(vx, 0, vz)) : null,
			});
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
		particles.spawn({ x: pos.x + (Math.random() - 0.5) * 0.3, y: 0.12, z: pos.z + (Math.random() - 0.5) * 0.3, size: 0.3, grow: 1.8, rise: 0.25, life: 0.6, color: rgb('170,150,120'), alpha: 0.3, fade: 'life' });
	},

	/** Пороховой дымок у ствола: сизое облачко поднимается и тает. */
	smoke(pos, size = 1) {
		particles.spawn({ x: pos.x, y: pos.y, z: pos.z, size: 0.25 * size, grow: 2.2, rise: 0.6, life: 0.7, color: rgb('200,200,190'), alpha: 0.35, fade: 'life' });
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
		return marks.hole(wx, Math.max(0.3, p.y + (Math.random() - 0.5) * 0.16), wz, nwx, nwz);
	},

	/** Попадание пули мимо цели: в стену — искры и крошка, в землю — фонтанчик пыли. */
	impact(pos, wall, size = 1) {
		const c = rgb(wall ? '230,220,190' : '150,130,100');
		for (let i = 0; i < 4; i++) {
			particles.spawn({
				x: pos.x, y: pos.y, z: pos.z, size: (0.12 + Math.random() * 0.12) * size, grow: 1.5, g: 4, floor: -1, life: 0.5, color: c, alpha: 0.55, fade: 'life',
				vx: (Math.random() - 0.5) * 1.5, vy: 0.6 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 1.5,
			});
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
		this.reloadKillsBandits();
		this.player.die('reload');
	},

	/** Перезагрузка накрыла кластер: муры и внешники, что не успели уйти, гибнут вместе с ним (их меньше в «Карьере» и на форпосте). */
	reloadKillsBandits() {
		const lost = { murs: 0, ext: 0 };
		for (const sq of [this.raidSquad, this.huntSquad]) {
			if (!sq) continue;
			for (const b of sq.members) if (b.alive && !b.left) { b.alive = false; b.hp = 0; lost[b.faction ?? 'murs']++; }
		}
		const w = this.world;
		if (this.raidSquad) { w.murs.count = Math.max(0, w.murs.count - lost.murs); w.murs.raid = null; w.murs.nextRaid = w.time + 300 + Math.random() * 900; this.raidSquad = null; }
		if (this.huntSquad) { w.ext.count = Math.max(0, w.ext.count - lost.ext); w.ext.hunt = null; w.ext.nextHunt = w.time + 900 + Math.random() * 1200; this.huntSquad = null; }
		return lost;
	},

	/**
	 * Признаки скорой перезагрузки (последняя минута): кислый запах, муть сгущается и желтеет,
	 * по краям экрана — болезненная дымка, гул.
	 */
	reloadFx(left) {
		const k = clamp01(1 - left / WARN) ** 1.4; // первые полминуты — едва заметно, к концу — сплошная кислая муть
		this.sourK = k;
		scene.fog.near = THREE.MathUtils.lerp(38, 5, k ** 0.8);
		scene.fog.far = THREE.MathUtils.lerp(95, 30, k);
		scene.fog.color.copy(FOG).lerp(FOG_SOUR, k);
		scene.background.copy(SKY).lerp(SKY_SOUR, k);
		$('sour').style.opacity = (k * 0.75).toFixed(3);
	},

	updateCluster(dt) {
		const reloaded = advance(this.world, dt);
		this.murT = (this.murT ?? 0) - dt;
		if (this.murT <= 0) { this.murT = 1; this.updateMurs(); this.updateBase(); }
		if (NODES[this.loc].kind !== 'cluster') return;
		if (reloaded.includes(this.loc)) { this.reloadDeath(); return; }
		const left = timeLeft(this.world, this.loc);
		this.reloadFx(left);
		// кисляк: за минуту до перезагрузки заражённые звереют (rage 0…1 — Enemy.update), гудит всё громче
		this.rage = left < RAGE ? clamp01((RAGE - left) / (RAGE - 10)) : 0;
		Sfx.drone?.(this.rage);
		const stage = left < 10 ? 4 : left < 30 ? 3 : left < RAGE ? 2 : left < WARN ? 1 : 0;
		if (stage > this.warnStage) {
			this.warnStage = stage;
			if (stage === 1) this.banner('Кислый запах', `Кластер скоро перезагрузится — ${approx(left)}. Уходи к выходу или к краю, в муть`);
			if (stage === 2) {
				this.banner('Кисляк', 'Муть сгущается, гудит — заражённые звереют и сбегаются на тебя. Уходи!');
				Sfx.rumble(0.6); Sfx.thunder(0.6);
				// просыпаются все в округе: ближние сразу, дальние — позже
				for (const e of this.enemies) {
					const d = Math.hypot(e.pos.x - this.player.pos.x, e.pos.z - this.player.pos.z);
					if (e.alive && e.state === 'idle' && d < 45) setTimeout(() => e.alert?.(), d * 120 + Math.random() * 1500);
				}
			}
			if (stage === 3) { this.toast('Улей гонит заражённых из мути — меньше 30 секунд!', 'warn'); Sfx.rumble(0.9); Sfx.thunder(0.8); this.sourWave(); }
			if (stage === 4) { this.toast('Сейчас перезагрузится!', 'warn'); Sfx.rumble(1.2); Sfx.thunder(1); }
		}
		if (stage >= 2) {
			this.rumbleT = (this.rumbleT ?? 0) - dt;
			if (this.rumbleT <= 0) { this.rumbleT = stage === 4 ? 1.2 : stage === 3 ? 2.5 : 4; Sfx.rumble(stage === 4 ? 1 : 0.5); }
		}
	},

	/** Кисляк, последние 30 с: Улей выгоняет из мути свору бегунов — со стороны, ближней к герою (их не больше 40 всего). */
	/**
	 * Удар скребера по земле: кольцо пыли, всех людей (героя, бойцов, муров, внешников) в радиусе T.slam, кроме цели
	 * удара, — вполсилы урона и с ног (толчок). Дрожь земли.
	 */
	slam(e, target) {
		const R = e.T.slam, at = e.pos;
		for (let i = 0; i < 14; i++) {
			const a = (i / 14) * Math.PI * 2;
			particles.spawn({ x: at.x + Math.sin(a) * R * 0.5, y: 0.15, z: at.z + Math.cos(a) * R * 0.5, size: 0.7, grow: 3, rise: 0.4, life: 0.9, color: rgb('150,130,110'), alpha: 0.4, fade: 'life' });
		}
		game.shake = Math.min(1, game.shake + 0.5 * clamp01(1 - at.distanceTo(this.player.pos) / 20));
		const people = [this.player, ...this.mercs.filter((m) => m.state.out), ...this.bandits];
		for (const a of people) {
			if (!a?.alive || a === target) continue;
			const d = Math.hypot(a.pos.x - at.x, a.pos.z - at.z);
			if (d > R) continue;
			byWho(e, () => (a.hurt ?? a.damage).call(a, e.T.damage * 0.5 * (1 - d / R * 0.5), at, 1.6));
		}
	},

	/** Рёв скребера зовёт стаю: из мути у ближайшего края бегут бегуны (T.call), если в кластере не слишком людно. */
	skreberCall(e) {
		const alive = this.enemies.filter((x) => x.alive).length;
		const n = Math.max(0, Math.min(e.T.call ?? 0, 45 - alive));
		const ax = Math.abs(e.pos.x) > Math.abs(e.pos.z), E = PLAY - 3;
		for (let i = 0; i < n; i++) {
			const t = THREE.MathUtils.clamp((ax ? e.pos.z : e.pos.x) + (Math.random() - 0.5) * 30, -E, E);
			const pos = ax ? new THREE.Vector3(Math.sign(e.pos.x || 1) * E, 0, t) : new THREE.Vector3(t, 0, Math.sign(e.pos.z || 1) * E);
			resolveCollisions(pos, 0.5, level.colliders);
			if (level.nav.blockedAt(pos.x, pos.z, 0.5)) continue;
			setTimeout(() => this.spawnEnemy('runner', pos)?.alert(), 600 + i * 350);
		}
	},

	sourWave() {
		const p = this.player.pos, alive = this.enemies.filter((e) => e.alive).length;
		const n = Math.max(0, Math.min(4 + (NODES[this.loc].danger ?? 1), 40 - alive));
		const ax = Math.abs(p.x) > Math.abs(p.z), E = PLAY - 3;
		for (let i = 0; i < n; i++) {
			const t = THREE.MathUtils.clamp((ax ? p.z : p.x) + (Math.random() - 0.5) * 24, -E, E);
			const pos = ax ? new THREE.Vector3(Math.sign(p.x || 1) * E, 0, t) : new THREE.Vector3(t, 0, Math.sign(p.z || 1) * E);
			resolveCollisions(pos, 0.5, level.colliders);
			if (level.nav.blockedAt(pos.x, pos.z, 0.5)) continue;
			this.spawnEnemy('runner', pos).alert();
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
		Sfx.drone?.(0);
		this.state = 'dead';
		this.deathReason = reason;
		this.inventory.close();
		this.trade.close();
		this.worldMap.close();
		this.locationMap.close();
		this.partyWindow.close();
		// при перезагрузке кластера пропадают и наёмники, что были с героем; съели — они вытащат героя
		const lostMercs = reason === 'reload' ? this.party.map((m) => MERCS[m.id].name) : [];
		if (reason === 'reload') this.roster = this.roster.filter((m) => !m.out); // оставленные в стабе живы
		const low = (s) => (/^.[А-ЯЁA-Z]/.test(s) ? s : `${s[0].toLowerCase()}${s.slice(1)}`); // ПМ, АКС-74У — как есть
		const keep = this.basePerks().keepGun ? this.kit.gear.gun : null; // бункер 3-го уровня: ствол в руках останется
		const lost = [...this.kit.owned.filter((id) => id !== keep).map((id) => low(WEAPONS[id].name)), ...STORABLE.filter((k) => (this.bag[k] ?? 0) > 0).map((k) => `${low(ITEMS[k].name)} ×${this.bag[k]}`)];
		const kept = CURRENCY.filter((k) => (this.bag[k] ?? 0) > 0).map((k) => `${low(ITEMS[k].name)} ×${this.bag[k]}`);
		clearTimeout(this.overTimer);
		this.overTimer = setTimeout(() => {
			const why = { reload: ['Кластер перезагрузился', 'Ты не успел уйти: Улей подменил кластер свежей копией вместе с тобой.'],
				shot: ['Тебя застрелили', 'Пули оказались быстрее — держись за укрытиями.'],
				blast: ['Тебя накрыло взрывом', 'Осколки не разбирают, кто свой, кто чужой.'] }[reason] ?? ['Тебя сожрали', 'Заражённые оказались быстрее.'];
			$('go-title').textContent = why[0];
			$('go-sub').textContent = why[1];
			$('btn-respawn').textContent = this.basePerks().respawnAtBase ? 'Очнуться на базе' : 'Очнуться в стабе';
			$('go-stats').innerHTML = `Убито: <b>${this.kills}</b>${lost.length ? `<br>Останется там: ${lost.join(', ')}` : ''}${kept.length ? `<br>При тебе: ${kept.join(', ')}` : ''}${lostMercs.length ? `<br>Наёмники вернутся в стаб без тебя: ${lostMercs.join(', ')} — нанять заново можно у костра` : ''}`;
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
		const md = this.bag.medkit ?? 0;
		$('heal-count').textContent = md;
		$('btn-heal').classList.toggle('off', md === 0);
		$('hud-zhiv').textContent = this.bag.zhivchik ?? 0;
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
		if (NODES[this.loc].kind === 'murs') { el.textContent = `муры: ${this.world.murs.count}`; el.className = 'danger'; return; }
		if (NODES[this.loc].kind === 'ext') { el.textContent = `внешники: ${this.world.ext.count}`; el.className = 'danger'; return; }
		if (NODES[this.loc].kind === 'base') { el.textContent = `оборона ${baseDefense(this.world.base)}`; el.className = 'safe'; return; }
		if (NODES[this.loc].kind !== 'cluster') { el.textContent = 'безопасно'; el.className = 'safe'; return; }
		const left = timeLeft(this.world, this.loc);
		const text = clock(left);
		if (el.textContent !== text) el.textContent = text;
		el.className = left < 30 ? 'danger' : left < WARN ? 'warn' : '';
	},
};
window.__game = game;
game.rollLootTest = rollLoot; // для тестов: лут по поясам

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
/** Ниже этой чёткости не опускаемся: на телефоне — чуть ниже, чем на компьютере. */
const MIN_RATIO = isMobile ? 0.65 : 0.75;
game.perf = perf;
/** Для отладки и тестов: сколько всего в видеопамяти. */
game.gpuInfo = () => ({ ...renderer.info.memory, programs: renderer.info.programs?.length ?? 0, ratio: renderer.getPixelRatio() });
function frame() {
	const raw = clock3.getDelta(), real = Math.min(0.05, raw);
	const t0 = performance.now();
	// ошибка в логике не должна навсегда останавливать игру: пишем в консоль, игроку — один раз
	try {
		if (game.state !== 'menu' && SIM_STEPS) {
			for (let i = 0; i < SIM_STEPS; i++) update(1 / 30);
		} else {
			update(real);
		}
	} catch (err) {
		console.error('Ошибка в кадре:', err);
		if (!frame.warned) { frame.warned = true; game.toast?.('Что-то пошло не так — игра продолжается. Если повторится, сообщи разработчику', 'warn'); }
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
	// цель — 40+ кадров: ниже двух секунд подряд — дешевле, выше 55 пять секунд подряд — снова чётче
	if (perf.fps < 40) { perf.low += raw; perf.high = 0; } else if (perf.fps > 55) { perf.high += raw; perf.low = 0; } else { perf.low = perf.high = 0; }
	let r = renderer.getPixelRatio();
	// слабая видеокарта: сначала отключаем самое дорогое — затенение в углах, потом снижаем чёткость
	if (perf.low > 2 && post.passes.ao?.enabled) { post.passes.ao.enabled = false; perf.low = 0; return; }
	if (perf.low > 2 && r > MIN_RATIO) r = Math.max(MIN_RATIO, r - 0.2);
	else if (perf.high > 5 && r < BASE_RATIO) r = Math.min(BASE_RATIO, r + 0.2);
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
	const windows = [game.inventory, game.trade, game.worldMap, game.locationMap, game.partyWindow, game.stashWindow, game.intelWindow, game.terminal, game.questWindow, game.modsWindow, game.craftWindow];
	if (input.consume('inventory') && game.state === 'play' && !windows.slice(1).some((w) => w.isOpen)) game.inventory.toggle();
	if (input.consume('map') && game.state === 'play' && (game.locationMap.isOpen || !game.paused)) game.locationMap.toggle();
	if (input.consume('escape')) for (const w of windows) w.close();
	if (game.paused || game.state === 'travel') return; // открыто окно или идём по дороге
	game.time += dt;
	if (game.state === 'play') {
		if (input.consume('heal')) game.drink();
		if (input.consume('grenade')) game.throwGrenade();
		if (input.consume('provoke')) game.attackMurs();
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
		// на базе изредка нападают заражённые (пока прошлые не перебиты — новых нет)
		if (NODES[game.loc]?.kind === 'base' && (game.baseWaveT -= dt) <= 0) {
			game.baseWaveT = 200 + Math.random() * 120;
			if (game.enemies.filter((e) => e.alive).length < 4) game.spawnBaseWave();
		}
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
	game.bandits = game.bandits.filter((b) => { const keep = b.update(dt); if (!keep) b.dispose(); return keep; });
	if (game.bandits.length) game.coordinateMurs(dt);
	game.updateBossBar();
	// муры в мире рядом — кнопка «Напасть на муров» (4 раза в секунду)
	if ((game.provokeT = (game.provokeT ?? 0) - dt) <= 0) {
		game.provokeT = 0.25;
		const show = game.bandits.length > 0 && !!game.player?.alive && !!game.peacefulMur(22);
		if (show === $('btn-provoke').classList.contains('hidden')) $('btn-provoke').classList.toggle('hidden', !show);
	}
	game.raidSquad?.update(dt);
	game.huntSquad?.update(dt);
	game.assault?.update(dt);
	game.garrison?.update(dt);

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
	particles.update(dt);
	gore.update(dt);
	debris.update(dt);
	marks.update(dt);
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
	// крупный план для проверок (тесты, .diag): window.__cam = { pos: [x, y, z], look: [x, y, z] } — от героя
	if (window.__cam) { camera.position.set(p.x + window.__cam.pos[0], window.__cam.pos[1], p.z + window.__cam.pos[2]); camera.lookAt(p.x + window.__cam.look[0], window.__cam.look[1], p.z + window.__cam.look[2]); }
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
game.terminal = new TerminalWindow(game);
game.stashWindow = new StashWindow(game);
game.intelWindow = new IntelWindow(game);
game.questWindow = new QuestWindow(game);
game.modsWindow = new ModsWindow(game);
game.craftWindow = new CraftWindow(game);
// «Назад» в приложении для Android: закрыть открытое окно; закрывать нечего — false, и приложение свернётся
window.__back = () => {
	const open = [game.inventory, game.trade, game.worldMap, game.locationMap, game.partyWindow, game.stashWindow, game.intelWindow, game.terminal, game.questWindow, game.modsWindow, game.craftWindow].filter((w) => w.isOpen);
	for (const w of open) w.close();
	return open.length > 0;
};
game.worldMap = new WorldMap(game);
game.minimap = new Minimap(game);
game.partyWindow = new PartyWindow(game);
$('party-bar').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (game.state === 'play' && !game.paused) game.partyWindow.open({ hiring: game.nearStation()?.id === 'mercs' }); });
game.locationMap = new LocationMap(game);
$('btn-inv').addEventListener('click', (e) => { e.currentTarget.blur(); if (game.state === 'play') game.inventory.toggle(); });
$('btn-map').addEventListener('click', (e) => { e.currentTarget.blur(); if (game.state === 'play' && !game.paused) game.locationMap.open(); });
$('minimap').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (game.state === 'play' && !game.paused) game.locationMap.open(); });
$('search').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); game.act(); });
$('btn-provoke').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); game.attackMurs(); });
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
