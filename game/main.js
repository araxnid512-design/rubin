// «Улей. Кластер-17» — маленький уровень в духе Last Day on Earth по мотивам вселенной «Стикс».
// Вид сверху, иммунный против заражённых, волны выходят из мути на краях кластера.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildLevel, resolveCollisions, HALF } from './level.js';
import { setAnisotropy, bloodDecalTexture, softDotTexture } from './textures.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { makeAxe, makePistol } from './weapons.js';
import { EQUIP_TIMES } from '../src/hero-animations.js';

const $ = (id) => document.getElementById(id);
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const QUALITY = new URLSearchParams(location.search).get('q') || (isMobile ? 'medium' : 'high');

// ---------- Рендер ----------
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
$('game').appendChild(renderer.domElement);
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
const SKY = new THREE.Color(0x8a9088);
scene.background = SKY;
scene.fog = new THREE.Fog(0x7e847c, 38, 95);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 220);
scene.add(new THREE.HemisphereLight(0xc4ccd0, 0x4a4a3c, 1.25));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

addEventListener('resize', () => {
	camera.aspect = innerWidth / innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(innerWidth, innerHeight);
});

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

let level, assets;
async function boot() {
	progress(0.05, 'Строим кластер…');
	await new Promise((r) => setTimeout(r, 30));
	level = buildLevel(scene, { quality: QUALITY });
	progress(0.35, 'Загружаем иммунного…');
	const player = await loadModel('player');
	progress(0.55, 'Загружаем бегунов…');
	const runner = await loadModel('runner');
	progress(0.75, 'Загружаем топтунов…');
	const stomper = await loadModel('stomper');
	assets = { player, runner, stomper };
	progress(1, 'Готово');
	$('loading').classList.add('hidden');
	$('menu').classList.remove('hidden');
	renderer.setAnimationLoop(frame);
	window.__game = game;
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
const shortAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

function lineOfSight(a, b) {
	const d = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(d / 0.5);
	const N = level.nav.N;
	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		const gx = Math.floor(a.x + (b.x - a.x) * t + HALF), gz = Math.floor(a.z + (b.z - a.z) * t + HALF);
		if (level.nav.blocked[gz * N + gx]) return false;
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

const WEAPONS = {
	axe: { name: 'Топор', damage: 40, range: 2.1, arc: 1.15, cooldown: 0.78, hitTime: 0.34 },
	pistol: { name: 'ПМ', damage: 26, range: 20, cooldown: 0.32, mag: 8, reload: 1.4 },
};

const ONE_SHOT = new Set(['Melee', 'Shoot', 'Hit', 'HitPistol', 'Reload', 'EquipPistol', 'EquipAxe']);

class Player extends Actor {
	constructor(gltf) {
		super(gltf);
		this.radius = 0.38;
		this.maxHp = 100;
		this.hp = 100;
		this.weapon = 'axe';
		this.ammo = WEAPONS.pistol.mag;
		this.reloading = 0;
		this.cooldown = 0;
		this.busy = 0; // время, пока анимация удара/выстрела не даёт бежать
		this.pending = [];
		this.alive = true;
		this.lastHurt = 0;
		// точка хвата в кулаке и крепления оружия на теле (чехол топора, кобура)
		this.hand = this.model.getObjectByName('GripR');
		this.mounts = { axe: this.model.getObjectByName('AxeMount'), pistol: this.model.getObjectByName('HolsterMount') };
		this.axe = makeAxe();
		this.pistol = makePistol();
		this.setWeapon('axe');
		this.play('Idle');
	}

	/** Набор анимаций под оружие в руках. */
	get clips() {
		return this.weapon === 'axe'
			? { idle: 'Idle', walk: 'Walk', run: 'Run', hit: 'Hit' }
			: { idle: 'IdlePistol', walk: 'WalkPistol', run: 'RunPistol', hit: 'HitPistol' };
	}

	/** Мгновенно: оружие w в руке, второе — в креплении на теле. */
	setWeapon(w) {
		this.weapon = w;
		this.stow(w === 'axe' ? 'pistol' : 'axe');
		this.hand.add(w === 'axe' ? this.axe : this.pistol);
		game.hud();
	}

	stow(w) {
		const obj = w === 'axe' ? this.axe : this.pistol;
		(this.mounts[w] ?? this.hand).add(obj);
		obj.visible = !!this.mounts[w];
	}

	/** Смена оружия анимацией: убрать текущее на тело, достать другое. */
	switchWeapon() {
		if (!this.alive || this.equipping || this.busy > 0) return;
		const to = this.weapon === 'axe' ? 'pistol' : 'axe';
		const clip = to === 'pistol' ? 'EquipPistol' : 'EquipAxe';
		const T = EQUIP_TIMES[clip];
		this.reloading = 0;
		this.equipping = true;
		this.busy = this.actions[clip].getClip().duration - 0.1;
		this.play(clip, { once: true, fade: 0.12, restart: true });
		this.pending.push({ t: T.stow, fn: () => this.stow(this.weapon) });
		this.pending.push({ t: T.draw, fn: () => {
			this.weapon = to;
			const obj = to === 'axe' ? this.axe : this.pistol;
			this.hand.add(obj);
			obj.visible = true;
			game.hud();
		} });
		this.pending.push({ t: this.busy, fn: () => { this.equipping = false; } });
	}

	hurt(dmg, from) {
		if (!this.alive) return;
		this.hp -= dmg;
		this.lastHurt = game.time;
		this.hitFlash();
		Sfx.hurt();
		game.shake = Math.min(1, game.shake + dmg / 30);
		$('hurt').style.opacity = Math.min(0.85, 0.3 + dmg / 40);
		if (from) { tmpV.subVectors(this.pos, from).setY(0).normalize().multiplyScalar(dmg > 20 ? 0.6 : 0.2); this.pos.add(tmpV); }
		if (this.hp <= 0) {
			this.hp = 0;
			this.alive = false;
			this.play('Death', { once: true, fade: 0.1 });
			this.pending.push({ t: 0.55, fn: () => this.dropWeapon() });
			game.over();
		} else if (this.busy <= 0) {
			this.play(this.clips.hit, { once: true, fade: 0.06, restart: true });
			this.busy = 0.3;
		}
		game.hud();
	}

	attack() {
		if (!this.alive || this.cooldown > 0 || this.reloading > 0 || this.equipping) return;
		const W = WEAPONS[this.weapon];
		if (this.weapon === 'axe') {
			const target = game.nearestEnemy(this.pos, 3.2);
			if (target) this.root.rotation.y = angleTo(this.pos, target.pos);
			this.play('Melee', { once: true, fade: 0.06, restart: true, timeScale: 1.05 });
			this.cooldown = W.cooldown;
			this.busy = 0.55;
			Sfx.swing();
			game.noise(this.pos, 6);
			this.pending.push({ t: W.hitTime, fn: () => this.meleeHit() });
		} else {
			if (this.ammo <= 0) { this.reload(); return; }
			const target = game.nearestEnemy(this.pos, W.range, true);
			if (target) this.root.rotation.y = angleTo(this.pos, target.pos);
			this.play('Shoot', { once: true, fade: 0.05, restart: true });
			this.cooldown = W.cooldown;
			this.busy = 0.3;
			this.ammo--;
			Sfx.shot();
			game.noise(this.pos, 26); // выстрел слышно издалека
			game.muzzleFlash(this);
			this.pending.push({ t: 0.04, fn: () => this.shotHit(target) });
			if (this.ammo === 0) this.pending.push({ t: 0.35, fn: () => this.reload() });
		}
		game.hud();
	}

	meleeHit() {
		const W = WEAPONS.axe;
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

	shotHit(target) {
		const W = WEAPONS.pistol;
		const from = this.pistol.localToWorld(this.pistol.userData.muzzle.clone());
		let to;
		if (target && target.alive) {
			to = target.pos.clone().setY(1.2 * target.scale);
			target.damage(W.damage, this.pos, 0.25);
		} else {
			to = from.clone().add(new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)).multiplyScalar(14));
		}
		game.tracer(from, to);
	}

	/** При смерти оружие выпадает из руки и ложится на землю. */
	dropWeapon() {
		const w = [this.axe, this.pistol].find((o) => o.parent === this.hand);
		if (!w) return;
		const pos = w.getWorldPosition(new THREE.Vector3());
		w.removeFromParent();
		scene.add(w);
		w.position.set(pos.x, 0.025, pos.z);
		// плашмя на боку: топорище/ствол горизонтально, лезвие вбок
		w.rotation.set(0, Math.random() * Math.PI * 2, 0);
		w.rotateZ(Math.PI / 2);
		this.dropped = w;
	}

	dispose() {
		this.dropped?.removeFromParent();
		super.dispose();
	}

	reload() {
		if (this.weapon !== 'pistol' || this.reloading > 0 || this.equipping || this.ammo === WEAPONS.pistol.mag) return;
		this.reloading = WEAPONS.pistol.reload;
		this.play('Reload', { once: true, fade: 0.1, restart: true });
		Sfx.reload();
		game.hud();
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
			if (this.reloading <= 0) { this.ammo = WEAPONS.pistol.mag; game.hud(); }
		}
		if (!this.alive) return;
		// регенерация, если давно не ранили
		if (game.time - this.lastHurt > 6 && this.hp < this.maxHp) { this.hp = Math.min(this.maxHp, this.hp + dt * 3); game.hudThrottled(); }

		const mv = input.move;
		const mag = Math.min(1, Math.hypot(mv.x, mv.y));
		if (this.busy > 0) {
			// во время удара почти стоим на месте
			if (mag > 0.1) this.pos.addScaledVector(tmpV.set(mv.x, 0, mv.y).normalize(), dt * 0.6 * mag);
		} else if (mag > 0.12) {
			const run = mag > 0.55;
			const speed = run ? 5.0 * mag : 2.0;
			const dir = tmpV.set(mv.x, 0, mv.y).normalize();
			this.pos.addScaledVector(dir, speed * dt);
			this.root.rotation.y = turnTowards(this.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 12);
			this.play(run ? this.clips.run : this.clips.walk, { timeScale: run ? 0.75 + mag * 0.3 : 1 });
		} else if (this.reloading > 0) {
			if (this.current !== 'Reload') this.play('Reload', { once: true, fade: 0.15 });
		} else if (!ONE_SHOT.has(this.current) || !this.actions[this.current].isRunning()) {
			this.play(this.clips.idle);
		}
		resolveCollisions(this.pos, this.radius, level.colliders);
	}
}

const ENEMY_TYPES = {
	runner: { hp: 60, speed: 3.4, scale: 1, radius: 0.36, damage: 8, range: 1.25, hitTime: 0.72, attackAnim: 1, move: 'Run', moveScale: (s) => s / 4.2, score: 1 },
	stomper: { hp: 220, speed: 2.0, scale: 1.08, radius: 0.5, damage: 22, range: 1.55, hitTime: 0.85, attackAnim: 0.85, move: 'Walk', moveScale: (s) => s / 1.25, score: 3 },
};

class Enemy extends Actor {
	constructor(type, pos) {
		const T = ENEMY_TYPES[type];
		super(assets[type], { scale: T.scale });
		this.type = type;
		this.T = T;
		this.scale = T.scale;
		this.radius = T.radius;
		this.hp = T.hp;
		this.alive = true;
		this.state = 'chase';
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

// ---------- Игра ----------
const game = {
	time: 0, shake: 0, kills: 0, spores: 0, total: 0, state: 'menu',
	enemies: [], pickups: [], fx: [],
	player: null,
	flow: null, flowTimer: 0,
	input: new Input(),

	start() {
		this.reset();
		this.state = 'play';
		$('menu').classList.add('hidden');
		$('gameover').classList.add('hidden');
		$('hud').classList.remove('hidden');
		Sfx.unlock();
		this.populate();
		this.banner('Кластер-17', 'Зачисти кластер от заражённых');
	},

	reset() {
		for (const e of this.enemies) e.dispose();
		for (const p of this.pickups) scene.remove(p.mesh);
		for (const f of this.fx) f.dispose?.();
		this.enemies = []; this.pickups = []; this.fx = [];
		if (this.player) this.player.dispose();
		this.player = new Player(assets.player);
		this.player.pos.copy(level.playerStart);
		this.player.root.rotation.y = -Math.PI / 2;
		this.time = 0; this.kills = 0; this.spores = 0;
		this.hud();
	},

	// Заражённые уже в кластере: группы у дома, гаражей, огородов, магазина, на дорогах
	populate() {
		const groups = [
			{ at: [-24, 17], r: 6, runners: 2 },
			{ at: [-18, 22], r: 9, runners: 1 },
			{ at: [20, 33], r: 12, runners: 2, stompers: 1 },
			{ at: [-30, -10], r: 6, runners: 2 },
			{ at: [-30, -34], r: 6, runners: 1 },
			{ at: [-6, -34], r: 6, runners: 2 },
			{ at: [-6, -10], r: 5, runners: 1 },
			{ at: [24, -10], r: 5, runners: 2, stompers: 1 },
			{ at: [12, -26], r: 6, runners: 2 },
			{ at: [36, -30], r: 8, runners: 2, stompers: 1 },
			{ at: [-36, 6], r: 8, runners: 2 },
			{ at: [4, 6], r: 6, runners: 1 },
			{ at: [-40, 40], r: 5, stompers: 1 },
		];
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
		for (const g of groups) {
			for (const [type, n] of [['runner', g.runners ?? 0], ['stomper', g.stompers ?? 0]]) {
				for (let i = 0; i < n; i++) {
					const pos = free(g.at[0], g.at[1], g.r);
					if (pos) this.enemies.push(new Enemy(type, pos));
				}
			}
		}
		this.total = this.enemies.length;
		this.hud();
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
		const dist = this.flow ?? new Int16Array(N * N);
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
		return new THREE.Vector3(best[0] - HALF + 0.5 - pos.x, 0, best[1] - HALF + 0.5 - pos.z).normalize();
	},

	onKill(e) {
		this.kills++;
		Sfx.death(e.type === 'stomper');
		this.decal(e.pos, e.type === 'stomper' ? 2.4 : 1.6);
		// споран из затылка; топтун — ещё и живчик
		this.spawnPickup('spore', e.pos, e.T.score);
		if (e.type === 'stomper' || Math.random() < 0.12) this.spawnPickup('zhivchik', e.pos.clone().add(new THREE.Vector3(0.6, 0, 0.4)));
		this.hud();
	},

	spawnPickup(kind, pos, value = 1) {
		let mesh;
		if (kind === 'spore') {
			mesh = new THREE.Group();
			const pod = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10).scale(1, 1.3, 1), new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.6, emissive: 0x3a5a20, emissiveIntensity: 0.6 }));
			const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture('170,255,120'), transparent: true, opacity: 0.55, depthWrite: false }));
			glow.scale.setScalar(0.8);
			mesh.add(pod, glow);
		} else {
			mesh = new THREE.Group();
			const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0xa04040, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x501010 }));
			const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
			cap.position.y = 0.13;
			const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture('255,120,120'), transparent: true, opacity: 0.5, depthWrite: false }));
			glow.scale.setScalar(0.9);
			mesh.add(flask, cap, glow);
		}
		mesh.position.copy(pos).setY(0.4);
		scene.add(mesh);
		this.pickups.push({ kind, mesh, value, t: 0 });
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

	muzzleFlash(player) {
		const pos = player.pistol.localToWorld(player.pistol.userData.muzzle.clone());
		const light = new THREE.PointLight(0xffc070, 30, 7);
		light.position.copy(pos);
		const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture('255,210,140'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
		s.position.copy(pos); s.scale.setScalar(0.6);
		scene.add(light, s);
		this.fx.push({ life: 0.06, update(dt) { this.life -= dt; return this.life > 0; }, dispose() { scene.remove(light, s); } });
	},

	tracer(from, to) {
		const g = new THREE.BufferGeometry().setFromPoints([from, to]);
		const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8 }));
		scene.add(l);
		this.fx.push({ life: 0.08, update(dt) { this.life -= dt; l.material.opacity = this.life * 10; return this.life > 0; }, dispose() { scene.remove(l); } });
	},

	over(won = false) {
		this.state = won ? 'won' : 'dead';
		const time = `${Math.floor(this.time / 60)}:${String(Math.floor(this.time % 60)).padStart(2, '0')}`;
		setTimeout(() => {
			$('go-title').textContent = won ? 'Кластер зачищен' : 'Тебя сожрали';
			$('go-stats').innerHTML = `Убито: <b>${this.kills}</b> из ${this.total} · Спораны: <b>${this.spores}</b><br>Время: <b>${time}</b>`;
			$('gameover').classList.remove('hidden');
			$('hud').classList.add('hidden');
		}, won ? 1500 : 2200);
	},

	hudT: 0,
	hudThrottled() { if (this.time - this.hudT > 0.25) this.hud(); },
	hud() {
		const p = this.player;
		if (!p) return;
		this.hudT = this.time;
		$('hp-fill').style.width = `${(p.hp / p.maxHp) * 100}%`;
		$('hp-text').textContent = Math.ceil(p.hp);
		$('spores').textContent = this.spores;
		$('left').textContent = this.enemies.filter((e) => e.alive).length;
		$('kills').textContent = this.kills;
		const W = WEAPONS[p.weapon];
		$('weapon-name').textContent = W.name;
		$('ammo').textContent = p.weapon === 'pistol' ? (p.reloading > 0 ? 'перезарядка…' : `${p.ammo} / ${W.mag}`) : '';
		$('btn-weapon').innerHTML = p.weapon === 'axe' ? ICON_PISTOL : ICON_AXE;
		$('btn-attack').innerHTML = p.weapon === 'axe' ? ICON_AXE : ICON_PISTOL;
	},
};
window.__game = game;

const ICON_AXE = '<svg viewBox="0 0 48 48" width="60%" height="60%"><path d="M30 6 42 18 36 20 28 12z" fill="#cfd5d8"/><path d="M27 13 35 21 12 44 6 42 4 36z" fill="#9a6a3c"/></svg>';
const ICON_PISTOL = '<svg viewBox="0 0 48 48" width="60%" height="60%"><path d="M6 14h34v8H22l-2 4h-4l-3 14H6l3-14H6z" fill="#cfd5d8"/><rect x="38" y="15" width="5" height="3" fill="#cfd5d8"/></svg>';

// ---------- Кадр ----------
const clock = new THREE.Clock();
const camOffset = new THREE.Vector3();
const camTarget = new THREE.Vector3();
// ?sim=N — N шагов логики по 1/30 с на кадр (для автотестов на медленном программном рендере)
const SIM_STEPS = +(new URLSearchParams(location.search).get('sim') || 0);
function frame() {
	const real = Math.min(0.05, clock.getDelta());
	if (game.state !== 'menu' && SIM_STEPS) {
		for (let i = 0; i < SIM_STEPS - 1; i++) update(1 / 30);
		update(1 / 30);
	} else {
		update(real);
	}
	renderer.render(scene, camera);
}

function update(dt) {
	if (game.state === 'menu') {
		// облёт кластера на фоне меню
		const t = performance.now() / 1000 * 0.05;
		camera.position.set(Math.sin(t) * 38, 26, Math.cos(t) * 38);
		camera.lookAt(0, 0, 0);
		sun.position.set(25, 40, 15); sun.target.position.set(0, 0, 0);
		level.update(dt, t);
		return;
	}
	game.time += game.state === 'play' ? dt : 0;
	const input = game.input;
	if (input.consume('attack')) game.player.attack();
	if (input.consume('switch')) game.player.switchWeapon();
	if (input.consume('reload')) game.player.reload();
	game.player.update(dt, input);
	if (input.held('attack')) game.player.attack(); // зажатая кнопка — серия ударов/выстрелов

	// всех убили — победа
	if (game.state === 'play' && game.total && !game.enemies.some((e) => e.alive)) game.over(true);
	game.flowTimer -= dt;
	if (game.flowTimer <= 0) { game.updateFlow(); game.flowTimer = 0.3; }
	game.enemies = game.enemies.filter((e) => { const keep = e.update(dt); if (!keep) e.dispose(); return keep; });

	// подбор споранов и живчиков
	for (const pk of game.pickups) {
		pk.t += dt;
		pk.mesh.position.y = 0.35 + Math.sin(pk.t * 3) * 0.08;
		pk.mesh.rotation.y += dt * 1.5;
		if (game.player.alive && pk.mesh.position.distanceTo(tmpV.copy(game.player.pos).setY(0.4)) < 1.3) {
			pk.taken = true;
			scene.remove(pk.mesh);
			if (pk.kind === 'spore') { game.spores += pk.value; game.toast(`+${pk.value} споран${pk.value > 1 ? 'а' : ''}`); }
			else { game.player.hp = Math.min(game.player.maxHp, game.player.hp + 45); game.toast('Живчик: +45 здоровья'); }
			Sfx.pickup();
			game.hud();
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
	$('hurt').style.opacity = Math.max(0, parseFloat($('hurt').style.opacity || 0) - dt * 1.5);
}

game.toast = (text) => {
	const t = document.createElement('div');
	t.className = 'toast';
	t.textContent = text;
	$('toasts').appendChild(t);
	setTimeout(() => t.remove(), 1600);
};

// снимаем фокус с кнопки, иначе пробел (атака) нажимает её снова и перезапускает игру
for (const id of ['btn-start', 'btn-restart']) $(id).onclick = (e) => { e.currentTarget.blur(); game.start(); };
boot().catch((e) => { console.error(e); $('loadtext').textContent = `Ошибка загрузки: ${e.message}`; });
