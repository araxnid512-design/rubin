// «Улей. Кластер-17» — игра в духе Last Day on Earth по мотивам вселенной «Стикс».
// Вид сверху. Иммунный ходит по кластерам Улья: они перезагружаются каждые 5–7 минут вместе со всем,
// что внутри, — надо успеть обыскать дома и уйти. Между кластерами — карта мира, в стабе «Полис» —
// торговец (оружие, патроны, живчики за спораны) и лекарь.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildLevel, resolveCollisions } from './level.js';
import { setAnisotropy, bloodDecalTexture, softDotTexture } from './textures.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { view, onResize, goLandscape } from './screen.js';
import { WEAPONS, AMMO, MOUNTS, CLIPS, EQUIP } from './weapons.js';
import { ITEMS, plural, makeItemMesh, GLOW, CONSUMABLES } from './items.js';
import { createIconFactory } from './icons.js';
import { Inventory } from './inventory.js';
import { Trade, PEA_RATE } from './trade.js';
import { WorldMap } from './worldmap.js';
import { NODES, WARN, newWorld, advance, timeLeft, travelTime, clock, approx, saveGame, loadGame, clearSave } from './world.js';
import { EQUIP_TIMES } from '../src/hero-animations.js';

const $ = (id) => document.getElementById(id);
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const QUALITY = new URLSearchParams(location.search).get('q') || (isMobile ? 'medium' : 'high');

// ---------- Рендер ----------
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(view.w, view.h);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
$('game').appendChild(renderer.domElement);
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
// обычный день и «кислая» муть перед перезагрузкой кластера
const SKY = new THREE.Color(0x8a9088), SKY_SOUR = new THREE.Color(0x8c8a5c);
const FOG = new THREE.Color(0x7e847c), FOG_SOUR = new THREE.Color(0x8a8658);
scene.background = SKY.clone();
scene.fog = new THREE.Fog(FOG.clone(), 38, 95);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

const camera = new THREE.PerspectiveCamera(42, view.w / view.h, 0.5, 220);
scene.add(new THREE.HemisphereLight(0xc4ccd0, 0x4a4a3c, 1.25));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

onResize(() => {
	camera.aspect = view.w / view.h;
	camera.updateProjectionMatrix();
	renderer.setSize(view.w, view.h);
});
// вспышка выстрела: один постоянный источник света (добавлять/убирать свет на каждый выстрел —
// перекомпиляция шейдеров и рывки на телефоне)
const flashLight = new THREE.PointLight(0xffc070, 0, 7);
const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture('255,210,140'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
flashSprite.scale.setScalar(0.6);
flashSprite.visible = false;
scene.add(flashLight, flashSprite);

// ---------- Загрузка ----------
const loader = new GLTFLoader();
async function loadModel(name) {
	let buffer;
	try {
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
async function boot() {
	const saved = loadGame();
	progress(0.05, 'Строим кластер…');
	await frameWait();
	level = buildLevel(scene, { quality: QUALITY, id: saved?.world?.at ?? 'zarechny' });
	game.level = level;
	progress(0.35, 'Загружаем иммунного…');
	const player = await loadModel('player');
	progress(0.55, 'Загружаем бегунов…');
	const runner = await loadModel('runner');
	progress(0.75, 'Загружаем топтунов…');
	const stomper = await loadModel('stomper');
	assets = { player, runner, stomper };
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
	$('btn-continue').classList.toggle('hidden', !saved);
	$('menu-save').textContent = saved ? `Сохранение: ${NODES[saved.world.at]?.short ?? '—'} · споранов ${saved.bag?.spore ?? 0}` : '';
	$('menu').classList.remove('hidden');
}

// Иконки предметов и портрет героя — из настоящих 3D-моделей (см. icons.js)
function makeIcons() {
	iconFactory = createIconFactory();
	if (!iconFactory) return;
	const I = game.icons;
	for (const id of Object.keys(WEAPONS)) I[id] = iconFactory.weapon(id);
	for (const k of CONSUMABLES) I[k] = iconFactory.item(k);
	I.portrait = iconFactory.portrait(assets.player);
	$('avatar').src = I.portrait;
	$('btn-heal').insertAdjacentHTML('afterbegin', `<img src="${I.zhivchik}" alt="">`);
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
				o.frustumCulled = false;
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

	update(dt) {
		this.mixer.update(dt);
		if (this.flash > 0) {
			this.flash = Math.max(0, this.flash - dt * 5);
			for (const m of this.mats) m.emissive?.setRGB(this.flash * 0.6, 0, 0);
		}
	}

	dispose() {
		scene.remove(this.root);
		this.mixer.stopAllAction();
	}
}

/** С чем начинают: топор и ПМ с полным магазином, патроны в запасе, живчик. */
const startKit = () => ({ gear: { melee: 'axe', gun: 'pistol' }, owned: ['axe', 'pistol'], mags: { pistol: WEAPONS.pistol.mag } });
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
		if (!this.alive || this.equipping || this.busy > 0 || to === this.hold) return;
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

	hurt(dmg, from) {
		if (!this.alive) return;
		game.cancelSearch('Обыск прерван');
		this.hp -= dmg;
		this.lastHurt = game.time;
		this.hitFlash();
		Sfx.hurt();
		game.shake = Math.min(1, game.shake + dmg / 30);
		$('hurt').style.opacity = Math.min(0.85, 0.3 + dmg / 40);
		if (from) { tmpV.subVectors(this.pos, from).setY(0).normalize().multiplyScalar(dmg > 20 ? 0.6 : 0.2); this.pos.add(tmpV); }
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
			this.pending.push({ t: W.hitTime, fn: () => this.meleeHit(W) });
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
		const target = game.nearestEnemy(this.pos, W.range, true);
		if (target) this.root.rotation.y = angleTo(this.pos, target.pos);
		// из прицела отдача начинается сразу, из низкой готовности ствол вскидывается за 0.07 с
		const c = this.clips;
		const aiming = this.current === c.shoot || this.current === c.aim;
		this.play(c.shoot, { once: true, fade: aiming ? 0.03 : 0.07, restart: true });
		this.cooldown = W.cooldown;
		this.busy = W.anim === 'rifle' ? 0.14 : 0.25;
		this.aim = 0.9;
		this.ammo--;
		Sfx.shot(W.pellets ? 'shotgun' : W.anim === 'rifle' ? 'rifle' : 'pistol');
		game.noise(this.pos, W.noise); // выстрел слышно издалека
		if (W.pellets) game.shake = Math.min(1, game.shake + 0.25);
		this.pending.push({ t: aiming ? 0.03 : 0.06, fn: () => this.shotHit(W, this.weapon, target) });
		if (this.ammo === 0 && (game.bag[W.ammo] ?? 0) > 0) this.pending.push({ t: 0.35, fn: () => this.reload() });
		game.hud();
	}

	meleeHit(W) {
		const fx = Math.sin(this.root.rotation.y), fz = Math.cos(this.root.rotation.y);
		let hit = false;
		for (const e of game.enemies) {
			if (!e.alive) continue;
			const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
			if (d > W.range + e.radius) continue;
			const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (d || 1))));
			if (ang > W.arc) continue;
			e.damage(W.damage, this.pos, 0.45);
			hit = true;
		}
		if (hit) Sfx.chop();
	}

	shotHit(W, id, target) {
		const gun = this.gun(id);
		const from = gun.localToWorld(gun.userData.muzzle.clone());
		game.muzzleFlash(from, W.pellets ? 1.6 : 1);
		if (W.pellets) { this.pellets(W, from, target); return; }
		let to;
		if (target && target.alive) {
			to = target.pos.clone().setY(1.2 * target.scale);
			target.damage(W.damage, this.pos, 0.25);
		} else {
			to = from.clone().add(new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)).multiplyScalar(14));
		}
		game.tracer(from, to);
	}

	/** Картечь: дробины веером, каждая — в первого заражённого на своей линии; урон падает с дистанцией. */
	pellets(W, from, target) {
		const base = target ? angleTo(this.pos, target.pos) : this.root.rotation.y;
		const hits = new Map();
		for (let i = 0; i < W.pellets; i++) {
			const a = base + (Math.random() - 0.5) * W.spread;
			const dx = Math.sin(a), dz = Math.cos(a);
			let best = null, bt = W.range;
			for (const e of game.enemies) {
				if (!e.alive) continue;
				const ox = e.pos.x - this.pos.x, oz = e.pos.z - this.pos.z;
				const t = ox * dx + oz * dz;
				if (t < 0 || t > bt) continue;
				const px = ox - dx * t, pz = oz - dz * t;
				if (px * px + pz * pz > (e.radius + 0.15) ** 2) continue;
				best = e; bt = t;
			}
			if (best && !lineOfSight(this.pos, best.pos)) { best = null; bt = W.range; }
			if (best) hits.set(best, (hits.get(best) ?? 0) + W.damage * (1 - 0.5 * bt / W.range));
			if (i % 2 === 0) game.tracer(from, new THREE.Vector3(this.pos.x + dx * bt, best ? 1.1 * best.scale : from.y, this.pos.z + dz * bt));
		}
		for (const [e, dmg] of hits) e.damage(dmg, this.pos, Math.min(1.2, dmg / 60));
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
		Sfx.reload();
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
				game.hud();
			}
		}
		if (!this.alive) return;
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
			const run = mag > 0.55;
			const speed = run ? 5.0 * mag : 2.0;
			const dir = tmpV.set(mv.x, 0, mv.y).normalize();
			this.pos.addScaledVector(dir, speed * dt);
			this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 12);
			this.play(run ? c.run : c.walk, { timeScale: run ? 0.75 + mag * 0.3 : 1 });
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

const ENEMY_TYPES = {
	runner: { hp: 60, speed: 3.4, scale: 1, radius: 0.36, damage: 8, range: 1.25, hitTime: 0.72, attackAnim: 1, move: 'Run', moveScale: (s) => s / 4.2, score: 1 },
	stomper: { hp: 220, speed: 2.0, scale: 1.08, radius: 0.5, damage: 22, range: 1.55, hitTime: 0.85, attackAnim: 0.85, move: 'Walk', moveScale: (s) => s / 1.25, score: 3 },
};

class Enemy extends Actor {
	constructor(type, pos, hp) {
		const T = ENEMY_TYPES[type];
		super(assets[type], { scale: T.scale });
		this.type = type;
		this.T = T;
		this.scale = T.scale;
		this.radius = T.radius;
		this.hp = hp ?? T.hp;
		this.alive = true;
		this.timer = 0;
		this.stagger = 0;
		this.speedVar = 0.85 + Math.random() * 0.3;
		this.pos.copy(pos);
		this.home = pos.clone();
		this.root.rotation.y = Math.random() * Math.PI * 2;
		this.growl = 2 + Math.random() * 6;
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
		this.state = 'chase';
		this.wander = null;
		if (Math.random() < 0.6) Sfx.growl(this.type === 'stomper');
		for (const o of game.enemies) if (o !== this && o.state === 'idle' && o.pos.distanceTo(this.pos) < 6 && Math.random() < 0.6) setTimeout(() => o.alert(), 300 + Math.random() * 900);
	}

	idle(dt, p, dist) {
		if (p.alive && (dist < 3.5 || (dist < 13 && lineOfSight(this.pos, p.pos)))) { this.alert(); return; }
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
			const speed = this.type === 'stomper' ? 0.6 : 0.55;
			this.pos.addScaledVector(dir, speed * dt);
			this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 2.5);
			this.play('Walk', { fade: 0.4, timeScale: this.type === 'stomper' ? 0.5 : 0.45 });
			resolveCollisions(this.pos, this.radius, level.colliders);
		} else {
			this.play('Idle', { fade: 0.4 });
		}
	}

	damage(dmg, from, knock) {
		if (!this.alive) return;
		this.hp -= dmg;
		this.hitFlash();
		game.blood(this.pos.clone().setY(1.2 * this.scale), 10);
		tmpV.subVectors(this.pos, from).setY(0).normalize();
		this.pos.addScaledVector(tmpV, knock / (this.type === 'stomper' ? 3 : 1));
		this.stagger = this.type === 'stomper' ? 0.08 : 0.3;
		this.alert();
		Sfx.flesh();
		if (this.hp <= 0) this.die();
	}

	die() {
		this.alive = false;
		this.state = 'dead';
		this.timer = 0;
		this.play('Death', { once: true, fade: 0.08 });
		game.onKill(this);
	}

	update(dt) {
		const p = game.player;
		const dist = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
		// далеко от камеры — не анимируем и не рисуем (экономия на телефонах)
		const near = dist < 34;
		this.model.visible = near;
		if (near) super.update(dt);
		if (!this.alive) {
			this.timer += dt;
			if (this.timer > 7) this.model.position.y -= dt * 0.25; // уходит в землю
			return this.timer < 10;
		}
		this.growl -= dt;
		if (this.growl < 0) { this.growl = 4 + Math.random() * 8; if (dist < 16) Sfx.growl(this.type === 'stomper'); }
		if (this.stagger > 0) { this.stagger -= dt; return true; }
		if (this.state === 'idle') { this.idle(dt, p, dist); return true; }

		if (this.state === 'attack') {
			this.timer += dt;
			const a = this.actions.Attack;
			if (!this.hitDone && this.timer >= this.T.hitTime / this.T.attackAnim) {
				this.hitDone = true;
				if (p.alive && dist < this.T.range + 0.6) p.hurt(this.T.damage, this.pos);
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
			this.play('Attack', { once: true, fade: 0.12, restart: true, timeScale: this.T.attackAnim });
			return true;
		}
		if (!p.alive) { this.play('Idle'); return true; }

		// направление: напрямую, если видно, иначе по полю путей
		let dir;
		if (dist < 7 && lineOfSight(this.pos, p.pos)) {
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
		const speed = this.T.speed * this.speedVar;
		this.pos.addScaledVector(dir, speed * dt);
		this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 6);
		this.play(this.T.move, { timeScale: this.T.moveScale(speed) });
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
		if (d < 34) super.update(dt);
	}
}

// ---------- Игра ----------
const game = {
	time: 0, shake: 0, kills: 0, state: 'menu', paused: false,
	bag: { ...START_BAG },
	kit: startKit(),
	world: newWorld(),
	loc: 'zarechny', from: null,
	icons: {},
	enemies: [], pickups: [], fx: [], npcs: [],
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
		this.kills = 0;
		this.begin();
		this.enter('zarechny', undefined);
		this.banner('Кластер «Заречный»', `Ты в Улье. Кластер перезагрузится через ${approx(timeLeft(this.world, 'zarechny'))} — обыщи дома и уходи к стабу по трассе на восток`);
	},

	/** Продолжить с сохранения. */
	continueGame() {
		const s = loadGame();
		if (!s) { this.newGame(); return; }
		this.world = s.world;
		this.bag = { ...START_BAG, ...s.bag };
		this.kit = s.kit;
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
		for (const p of this.pickups) scene.remove(p.mesh);
		for (const f of this.fx) f.dispose?.();
		this.enemies = []; this.pickups = []; this.fx = []; this.npcs = [];
		this.searching = null;
		this.flow = null;
		if (level?.id !== id) {
			level?.dispose();
			level = buildLevel(scene, { quality: QUALITY, id });
			this.level = level;
		}
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
		}
		this.player.kit = this.kit;
		this.player.pos.copy(spot.pos);
		this.player.root.rotation.y = spot.ry;
		this.player.attachGear();
		camTarget.copy(spot.pos).setY(0.8);
		this.exitArmed = false;
		this.warnStage = 0;
		this.visited = new Set();
		this.inventory?.close();
		if (NODES[id].kind === 'cluster') this.populate(this.world.clusters[id].saved);
		else for (const n of level.npcs) this.npcs.push(new Npc(n));
		this.reloadFx(Infinity);
		this.hud();
		this.save();
	},

	/** Заражённые уже в кластере, тайники в домах. saved — состояние с прошлого визита в этом цикле. */
	populate(saved) {
		if (saved) {
			for (const e of saved.enemies) this.enemies.push(new Enemy(e.type, new THREE.Vector3(e.x, 0, e.z), e.hp));
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
			for (const [type, n] of [['runner', g.runners ?? 0], ['stomper', g.stompers ?? 0]]) {
				for (let i = 0; i < n; i++) {
					const pos = free(g.at[0], g.at[1], g.r);
					if (pos) this.enemies.push(new Enemy(type, pos));
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
		saveGame({ world: this.world, bag: this.bag, kit: this.kit, hp: Math.ceil(this.player.hp), from: this.from ?? null });
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
		setTimeout(() => {
			advance(this.world, time);
			const node = NODES[to], visited = !!this.world.clusters[to]?.saved;
			this.state = 'play';
			this.enter(to, from);
			this.setPaused(false);
			if (node.kind === 'stab') this.banner(node.name, 'Безопасно: торговец, лекарь. Выход — через ворота');
			else this.banner(node.name, `До перезагрузки ${approx(timeLeft(this.world, to))}${visited ? ' · здесь ты уже был' : ''}`);
			setTimeout(() => $('travel').classList.add('hidden'), 350);
		}, 450);
	},

	/** Гибель: в рюкзаке всё пропадает, оружие остаётся; герой приходит в себя в стабе. */
	respawn() {
		for (const k of CONSUMABLES) this.bag[k] = 0;
		advance(this.world, 90);
		this.player?.dispose();
		this.player = null;
		this.begin();
		this.enter('stab', undefined);
		this.banner('Стаб «Полис»', 'Тебя вытащили рейдеры. Рюкзак остался в кластере, оружие при тебе');
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
	updateFlow() {
		const { N, blocked } = level.nav;
		const dist = this.flow?.length === N * N ? this.flow : new Int16Array(N * N);
		dist.fill(-1);
		const [px, pz] = level.nav.cell(this.player.pos.x, this.player.pos.z);
		const start = Math.max(0, Math.min(N - 1, pz)) * N + Math.max(0, Math.min(N - 1, px));
		const queue = new Int32Array(N * N);
		let head = 0, tail = 0;
		queue[tail++] = start; dist[start] = 0;
		while (head < tail) {
			const i = queue[head++], x = i % N, z = (i / N) | 0, d = dist[i] + 1;
			for (let k = 0; k < 8; k++) {
				const dx = [1, -1, 0, 0, 1, 1, -1, -1][k], dz = [0, 0, 1, -1, 1, -1, 1, -1][k];
				const nx = x + dx, nz = z + dz;
				if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
				const j = nz * N + nx;
				if (dist[j] >= 0 || blocked[j]) continue;
				if (k >= 4 && (blocked[z * N + nx] || blocked[nz * N + x])) continue; // не срезаем углы
				dist[j] = d;
				queue[tail++] = j;
			}
		}
		this.flow = dist;
	},

	flowDir(pos) {
		if (!this.flow) return null;
		const { N } = level.nav;
		const [cx, cz] = level.nav.cell(pos.x, pos.z);
		let best = null, bd = this.flow[cz * N + cx];
		if (bd < 0) bd = 1e9;
		for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
			const nx = cx + dx, nz = cz + dz;
			if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
			const d = this.flow[nz * N + nx];
			if (d >= 0 && d < bd) { bd = d; best = [nx, nz]; }
		}
		if (!best) return null;
		return new THREE.Vector3(level.nav.center(best[0]) - pos.x, 0, level.nav.center(best[1]) - pos.z).normalize();
	},

	onKill(e) {
		this.kills++;
		Sfx.death(e.type === 'stomper');
		this.decal(e.pos, e.type === 'stomper' ? 2.4 : 1.6);
		// споран из затылка; у топтуна — ещё горох и живчик. Патронов у заражённых нет — они в домах
		const near = (dx, dz) => e.pos.clone().add(new THREE.Vector3(dx, 0, dz));
		this.spawnPickup('spore', e.pos, e.T.score);
		if (e.type === 'stomper') this.spawnPickup('peas', near(-0.5, 0.5), 1 + Math.floor(Math.random() * 2));
		if (e.type === 'stomper' || Math.random() < 0.12) this.spawnPickup('zhivchik', near(0.6, 0.4));
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
			if (this.kit.owned.includes(kind)) {
				if (W.ammo) { this.bag[W.ammo] = (this.bag[W.ammo] ?? 0) + 4; this.toast(`${W.name} уже есть — забрал 4 патрона ${AMMO[W.ammo]}`); }
			} else {
				this.kit.owned.push(kind);
				if (W.ammo) this.kit.mags[kind] = Math.min(W.mag, 2);
				this.toast(`Найден: ${W.name}! Возьми его в рюкзаке`);
			}
		} else {
			this.bag[kind] = (this.bag[kind] ?? 0) + n;
			this.toast(`+${n} ${plural(n, ITEMS[kind].forms)}`);
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

	/** Точка действия стаба рядом (торговец, лекарь). */
	nearStation() {
		const p = this.player.pos;
		return level.stations.find((s) => Math.hypot(s.x - p.x, s.z - p.z) < s.r) ?? null;
	},

	/** Кнопка действия: обыскать мебель или поговорить с жителем стаба. */
	act() {
		const p = this.player;
		if (!p?.alive || this.searching || this.paused || p.busy > 0 || p.equipping) return;
		const s = this.nearStation();
		if (s) {
			p.root.rotation.y = Math.atan2(s.x - p.pos.x, (s.z - 2) - p.pos.z); // лицом к прилавку/палатке
			if (s.id === 'trade') this.trade.open();
			if (s.id === 'rest') this.rest();
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
		const price = offer.price, W = WEAPONS[offer.id];
		if ((this.bag.spore ?? 0) < price) { this.toast('Не хватает споранов', 'warn'); return; }
		if (W && this.kit.owned.includes(offer.id)) return;
		this.bag.spore -= price;
		if (W) {
			this.kit.owned.push(offer.id);
			if (W.ammo) this.kit.mags[offer.id] = W.mag; // продаётся снаряжённым
			const old = this.kit.gear[W.slot];
			this.kit.gear[W.slot] = offer.id;
			this.player.attachGear();
			this.toast(`${W.name} — в слоте${old ? `, ${WEAPONS[old].name} — в рюкзаке` : ''}`);
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
		scene.add(m);
		this.fx.push({ life: 40, mesh: m, update(dt) { this.life -= dt; if (this.life < 5) m.material.opacity = this.life / 5; return this.life > 0; }, dispose() { scene.remove(m); } });
	},

	blood(pos, n) {
		const mat = new THREE.SpriteMaterial({ map: softDotTexture('120,10,8'), transparent: true, depthWrite: false });
		for (let i = 0; i < n; i++) {
			const s = new THREE.Sprite(mat);
			s.position.copy(pos);
			s.scale.setScalar(0.12 + Math.random() * 0.15);
			const v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
			scene.add(s);
			this.fx.push({ life: 0.6, update(dt) { v.y -= 9 * dt; s.position.addScaledVector(v, dt); this.life -= dt; if (s.position.y < 0.05) this.life = 0; return this.life > 0; }, dispose() { scene.remove(s); } });
		}
	},

	muzzleFlash(pos, size = 1) {
		flashLight.position.copy(pos);
		flashLight.intensity = 30 * size;
		flashSprite.position.copy(pos);
		flashSprite.scale.setScalar(0.6 * size);
		flashSprite.visible = true;
		this.fx = this.fx.filter((f) => !f.flash);
		this.fx.push({ flash: true, life: 0.06, update(dt) { this.life -= dt; return this.life > 0; }, dispose() { flashLight.intensity = 0; flashSprite.visible = false; } });
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
			if (stage === 2) { this.toast('Муть сгущается — меньше 30 секунд!', 'warn'); Sfx.rumble(0.6); }
			if (stage === 3) { this.toast('Сейчас перезагрузится!', 'warn'); Sfx.rumble(1.2); }
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
		const ex = level.exitAt(p.pos);
		if (ex && this.exitArmed && !p.equipping) {
			this.exitArmed = false;
			this.cancelSearch();
			this.worldMap.open(ex.to);
		} else if (!level.exitAt(p.pos, 1.2)) this.exitArmed = true;
	},

	over(reason) {
		this.state = 'dead';
		this.inventory.close();
		this.trade.close();
		this.worldMap.close();
		const lost = CONSUMABLES.filter((k) => (this.bag[k] ?? 0) > 0).map((k) => `${ITEMS[k].name.toLowerCase()} ×${this.bag[k]}`);
		clearTimeout(this.overTimer);
		this.overTimer = setTimeout(() => {
			$('go-title').textContent = reason === 'reload' ? 'Кластер перезагрузился' : 'Тебя сожрали';
			$('go-sub').textContent = reason === 'reload' ? 'Ты не успел уйти: Улей подменил кластер свежей копией вместе с тобой.' : 'Заражённые оказались быстрее.';
			$('go-stats').innerHTML = `Убито: <b>${this.kills}</b>${lost.length ? `<br>Пропадёт из рюкзака: ${lost.join(', ')}` : ''}`;
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
		$('hp-text').textContent = Math.ceil(p.hp);
		$('spores').textContent = this.bag.spore ?? 0;
		$('peas').textContent = this.bag.peas ?? 0;
		$('kills').textContent = this.kills;
		$('loc-name').textContent = NODES[this.loc].short;
		this.hudTimer();
		const W = p.W, gun = this.kit.gear.gun && WEAPONS[this.kit.gear.gun];
		$('weapon-name').textContent = W.name;
		// патроны: в магазине / в запасе
		const ammo = $('ammo');
		if (W.ammo) {
			const spare = this.bag[W.ammo] ?? 0, empty = p.ammo === 0 && spare === 0;
			ammo.innerHTML = p.reloading > 0 ? 'перезарядка…' : empty ? '<b>0</b> · нет патронов' : `<b>${p.ammo}</b> / ${spare}`;
			ammo.classList.toggle('empty', empty);
		} else {
			const loaded = gun ? this.kit.mags[this.kit.gear.gun] ?? 0 : 0, spare = gun ? this.bag[gun.ammo] ?? 0 : 0;
			ammo.innerHTML = gun && (loaded || spare) ? `${gun.name}: ${loaded} + ${spare}` : '';
			ammo.classList.remove('empty');
		}
		const zh = this.bag.zhivchik ?? 0;
		$('heal-count').textContent = zh;
		$('btn-heal').classList.toggle('off', zh === 0);
		// иконки меняем только при смене оружия: перерисовка кнопки под пальцем теряет отпускание
		const other = p.hold === 'melee' ? this.kit.gear.gun : this.kit.gear.melee;
		const key = `${p.weapon}|${other}`;
		const icon = (w) => (w && this.icons[w] ? `<img src="${this.icons[w]}" alt="">` : '');
		if (this.icons.weapon !== key) {
			this.icons.weapon = key;
			$('btn-weapon').innerHTML = icon(other);
			$('btn-weapon').classList.toggle('off', !other);
			$('btn-attack').innerHTML = `${icon(p.weapon) || '✊'}<span class="badge" id="attack-ammo"></span>`;
			if (this.icons[p.weapon]) $('weapon-icon').src = this.icons[p.weapon];
		}
		const badge = $('attack-ammo');
		badge.textContent = W.ammo ? p.ammo : '';
		badge.style.display = W.ammo ? '' : 'none';
		badge.classList.toggle('empty', p.ammo === 0);
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
function frame() {
	const real = Math.min(0.05, clock3.getDelta());
	if (game.state !== 'menu' && SIM_STEPS) {
		for (let i = 0; i < SIM_STEPS; i++) update(1 / 30);
	} else {
		update(real);
	}
	renderer.render(scene, camera);
}

function update(dt) {
	if (game.state === 'menu') {
		// облёт локации на фоне меню
		const t = performance.now() / 1000 * 0.05;
		camera.position.set(Math.sin(t) * 38, 26, Math.cos(t) * 38);
		camera.lookAt(0, 0, 0);
		sun.position.set(25, 40, 15); sun.target.position.set(0, 0, 0);
		level.update(dt, t);
		return;
	}
	const input = game.input;
	if (input.consume('inventory') && game.state === 'play' && !game.trade.isOpen && !game.worldMap.isOpen) game.inventory.toggle();
	if (input.consume('map') && game.state === 'play' && !game.paused) game.worldMap.open(null, { look: true });
	if (input.consume('escape')) { game.inventory.close(); game.trade.close(); game.worldMap.close(); }
	if (game.paused || game.state === 'travel') return; // открыто окно или идём по дороге
	game.time += dt;
	if (game.state === 'play') {
		if (input.consume('heal')) game.drink();
		if (input.consume('search')) game.act();
		if (input.consume('switch')) game.player.switchWeapon();
		if (input.consume('reload')) game.player.reload();
	}
	game.player.update(dt, input); // там же спуск: тап — один выстрел, удержание — серия
	if (game.state === 'play') {
		game.updateSearch(dt, input);
		game.updateCluster(dt);
		game.updateExit();
		game.hudTimerT = (game.hudTimerT ?? 0) - dt;
		if (game.hudTimerT <= 0) { game.hudTimerT = 0.25; game.hudTimer(); }
	}

	game.flowTimer -= dt;
	if (game.flowTimer <= 0 && game.enemies.length) { game.updateFlow(); game.flowTimer = 0.3; }
	game.enemies = game.enemies.filter((e) => { const keep = e.update(dt); if (!keep) e.dispose(); return keep; });
	for (const n of game.npcs) n.update(dt);

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
	level.update(dt, game.time);
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
	sun.position.set(p.x + 18, 34, p.z + 10);
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

game.inventory = new Inventory(game);
game.trade = new Trade(game);
game.worldMap = new WorldMap(game);
$('btn-inv').addEventListener('click', (e) => { e.currentTarget.blur(); if (game.state === 'play') game.inventory.toggle(); });
$('btn-map').addEventListener('click', (e) => { e.currentTarget.blur(); if (game.state === 'play') game.worldMap.open(null, { look: true }); });
$('search').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); game.act(); });
for (const id of ['btn-inv', 'btn-map']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());
// сохраняем, когда вкладку прячут (телефон заблокировали, переключились)
document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });

// снимаем фокус с кнопки, иначе пробел (атака) нажимает её снова и перезапускает игру
// на телефоне — полноэкранный горизонтальный режим (нужно нажатие пользователя)
const press = (id, fn) => { $(id).onclick = (e) => { e.currentTarget.blur(); goLandscape(); fn(); }; };
press('btn-new', () => game.newGame());
press('btn-continue', () => game.continueGame());
press('btn-respawn', () => game.respawn());
boot().catch((e) => { console.error(e); $('loadtext').textContent = `Ошибка загрузки: ${e.message}`; });
