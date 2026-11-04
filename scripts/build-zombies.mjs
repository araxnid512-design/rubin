// Заражённые Tripo (модели по картинкам пользователя + клипы Tripo) → лёгкие модели для браузерной игры
// models/game/z_<id>.glb: одна сетка (4–9 тыс. треуг.), одна текстура цвета 512 px, клипы под игру, meshopt.
//   • вход — файлы Tripo с анимациями: пресеты z_<id>_a.glb (idle, walk, run, turn, slash) и z_<id>_b.glb (chop — тот же
//     клип, что slash; hit_to_body_01, fall), движения по текстовому описанию m_<id>_<имя>.glb (см. CLIPS); сетка и скелет
//     (78 костей) у всех одинаковые;
//   • модель разворачивается лицом к +Z (у Tripo — к +X) и приводится к росту HEIGHT, м;
//   • клипы (имена — как у старых моделей, их ждёт game/main.js):
//       Idle — стойка; Walk, Run (у рубера ещё Charge) — шаг и бег на месте: в клипе ищется кусок, который замыкается в
//         цикл, невязка раскладывается по циклу, горизонтальный ход корня (root motion) убран — двигает игра, таз в
//         среднем над точкой модели; стопы в опоре «прибиты» IK (едут назад ровно со скоростью хода — в игре стоят);
//         скорость хода (м/с при темпе 1) — scene.extras.gait;
//       Turn — разворот на месте (кусок с переступанием), поворот корпуса из клипа вынут — корпус поворачивает игра со
//         скоростью из клипа (scene.extras.turn, рад/с), ноги переступают;
//       Attack — удар: у бегуна бросок с захватом и укусом (zlunge), у громил — удар сверху обеими руками (bsmash);
//         момент удара — scene.extras.hit, ход таза вперёд при броске вынут (двигает игра — scene.extras.lunge);
//       Hurt — отшатывание от попадания (начало hit_to_body_01);
//       Death — падение на левый бок (fall), DeathR — оно же зеркально (на правый): игра выбирает, куда падать по удару;
//       Roar (рубер, топтун) — рёв (broar).
//   • у клипов Tripo свой поворот корневой кости BoneRoot (≠ покою) — он идёт дорожкой, пересчёт «мир ↔ таз» — через
//     корень кадра.
// Пакеты gltf-transform в игру не входят — ставятся во временную папку (не в корень репозитория), как для
// scripts/shrink-weapons.mjs:
//   mkdir /tmp/gt && cd /tmp/gt && npm init -y && npm i @gltf-transform/core@4.2.1 @gltf-transform/functions@4.2.1 \
//     @gltf-transform/extensions@4.2.1 meshoptimizer@0.22.0 sharp@0.33.5 && cp <репозиторий>/scripts/build-zombies.mjs .
//   node build-zombies.mjs <репозиторий> <папка с z_*_a.glb и z_*_b.glb> [pustysh,lottery,…]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, quantize, textureCompress, prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [REPO, SRC, only] = process.argv.slice(2);
const THREE = await import(pathToFileURL(join(REPO, 'node_modules/three/build/three.module.js')).href);
const { GLTFLoader } = await import(pathToFileURL(join(REPO, 'node_modules/three/examples/jsm/loaders/GLTFLoader.js')).href);
await MeshoptSimplifier.ready; await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

/** Модели: рост, м (рост в игре — ещё × scale вида в ENEMY_TYPES), доля треугольников после упрощения. */
const MODELS = {
	pustysh: { height: 1.74, ratio: 1 },
	lottery: { height: 1.78, ratio: 0.85 },
	stomper: { height: 2.05, ratio: 0.8 },
	ruber: { height: 1.9, ratio: 0.7 },
};
/**
 * Клипы: src — файл и клип Tripo: a|b — пресеты (z_<id>_a/b.glb), m — движение по текстовому описанию (m_<id>_<имя>.glb:
 * zrun — бег заражённого, shamble — шаркающая ходьба, zlunge — бросок с захватом и укусом, bwalk — тяжёлая ходьба
 * громилы, bsmash, broar, bcharge — удар, рёв и рывок громилы); нет файла — alt (пресет). t — кусок, с; fps — кадров
 * в секунду; loop — найти в клипе кусок, который замыкается в цикл (поза в конце ≈ в начале), остаток невязки
 * разложить по циклу; lunge — бросок: ход таза вперёд вынут (двигает игра — scene.extras.lunge), hit — момент удара, с
 * (hitAuto — когда руки дальше всего впереди); only — только для этих моделей.
 */
const Z = ['pustysh', 'lottery'], BIG = ['stomper', 'ruber'];
const SLASH = { src: ['a', 'slash'], t: [1.0, 3.2], hit: 2.2 };
const CLIPS = [
	{ name: 'Idle', src: ['m', 'zidle'], alt: { src: ['a', 'idle'], fps: 8 }, fps: 12, loop: true },
	{ name: 'Walk', src: ['m', 'shamble'], alt: { src: ['a', 'walk'] }, fps: 24, inPlace: true, loop: true, only: Z },
	{ name: 'Walk', src: ['m', 'bwalk'], alt: { src: ['a', 'walk'] }, fps: 24, inPlace: true, loop: true, only: BIG },
	{ name: 'Run', src: ['m', 'zrun'], alt: { src: ['a', 'run'] }, fps: 24, inPlace: true, loop: true, only: Z },
	{ name: 'Run', src: ['m', 'bcharge'], alt: { src: ['a', 'run'] }, fps: 24, inPlace: true, loop: true, only: BIG },
	// рывок рубера (6–8 м/с) — быстрый бег из пресета: у прыжкового бега громилы шаг короткий, темп вышел бы втрое
	{ name: 'Charge', src: ['a', 'run'], fps: 24, inPlace: true, loop: true, only: BIG },
	{ name: 'Turn', src: ['a', 'turn'], t: [1.05, 2.35], fps: 20, derotate: true },
	{ name: 'Attack', src: ['m', 'zlunge'], alt: SLASH, fps: 24, lunge: true, hitAuto: true, only: Z },
	{ name: 'Attack', src: ['m', 'bsmash'], t: [0, 1.5], alt: SLASH, fps: 24, lunge: true, hitAuto: true, only: BIG }, // годна первая половина: замах и удар
	{ name: 'Hurt', src: ['b', 'hit_to_body_01'], t: [0, 0.8], fps: 24 },
	{ name: 'Death', src: ['b', 'fall'], fps: 20 },
	{ name: 'DeathR', src: ['b', 'fall'], fps: 20, mirror: true },
	{ name: 'Roar', src: ['m', 'broar'], alt: { src: ['a', 'slash'], roar: [1.0, 1.75, 0.9] }, fps: 20, only: ['ruber', 'stomper'] },
];
// кости без дорожек: пальцы (сверху не видно), глаза и лицо — остаются в покое
const SKIP = /(Thumb|Index|Mid|Ring|Pinky)\d|Eye|Facial/;

/** GLB → сцена three.js без текстур (для расчёта поз). */
async function threeScene(file) {
	const doc = await io.read(file);
	for (const m of doc.getRoot().listMaterials()) m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null);
	for (const t of doc.getRoot().listTextures()) t.dispose();
	for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
	const bin = await io.writeBinary(doc);
	return new Promise((res, rej) => new GLTFLoader().parse(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), './', res, rej));
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Кусок клипа [a, b] внутри [t0, t1], который замыкается в цикл: поза костей (кроме таза — его поворот и ход
 * поправляются отдельно) в конце ближе всего к позе в начале; длина — не меньше 40 % клипа (целые шаги), длиннее — лучше.
 */
const LOOP_BONES = ['Waist', 'Spine01', 'Spine02', 'Head', 'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot', 'L_Upperarm', 'L_Forearm', 'R_Upperarm', 'R_Forearm'];
let loopScene = null;
function bestLoop(clip, t0, t1) {
	const sc = loopScene, mixer = new THREE.AnimationMixer(sc), fps = 30;
	mixer.clipAction(clip).play();
	const n = Math.round((t1 - t0) * fps), poses = [];
	for (let i = 0; i <= n; i++) {
		mixer.setTime(Math.min(t0 + i / fps, clip.duration - 1e-4));
		poses.push(LOOP_BONES.map((nm) => sc.getObjectByName(nm).quaternion.clone()));
	}
	let best = null;
	const minLen = Math.max(Math.round(n * 0.4), 18);
	for (let i = 0; i <= n - minLen; i++) for (let j = i + minLen; j <= n; j++) {
		let d = 0;
		for (let k = 0; k < LOOP_BONES.length; k++) d += 1 - Math.abs(poses[i][k].dot(poses[j][k]));
		const cost = d - 0.00003 * (j - i);
		if (!best || cost < best.cost) best = { cost, i, j, d };
	}
	mixer.stopAllAction();
	return [t0 + best.i / fps, t0 + best.j / fps];
}
const UP = V(0, 1, 0);
/** Зеркало поворота относительно плоскости z = 0 (лево-право у Tripo — ось Z). */
const mirrorQ = (q) => new THREE.Quaternion(-q.x, -q.y, q.z, q.w);
const partner = (n) => (n.startsWith('L_') ? 'R_' + n.slice(2) : n.startsWith('R_') ? 'L_' + n.slice(2) : n);

async function buildModel(id) {
	const cfg = MODELS[id];
	const src = { a: await threeScene(join(SRC, `z_${id}_a.glb`)), b: await threeScene(join(SRC, `z_${id}_b.glb`)), m: {} };
	for (const C of CLIPS) if (C.src[0] === 'm' && !src.m[C.src[1]] && existsSync(join(SRC, `m_${id}_${C.src[1]}.glb`))) src.m[C.src[1]] = await threeScene(join(SRC, `m_${id}_${C.src[1]}.glb`));
	const scene = src.a.scene;
	scene.updateMatrixWorld(true);
	loopScene = scene;
	const bones = [];
	scene.traverse((o) => { if (o.isBone) bones.push(o); });
	const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
	const restLocal = Object.fromEntries(bones.map((b) => [b.name, b.quaternion.clone()]));
	const restWorld = Object.fromEntries(bones.map((b) => [b.name, b.getWorldQuaternion(new THREE.Quaternion())]));
	const hip = byName.Hip, root = byName.BoneRoot;
	const hipRestW = hip.getWorldPosition(new THREE.Vector3());
	// у клипов Tripo свой поворот корневой кости (BoneRoot, ≠ покою на ~20°): он идёт дорожкой, а пересчёт «мир ↔ таз»
	// — через корень этого кадра (над корнем — Armature без поворота)
	const rootInvOf = (f) => new THREE.Matrix4().compose(root.position, f.local.BoneRoot, new THREE.Vector3(1, 1, 1)).invert();
	// рост — по сетке в стойке idle (в Tripo модель высотой 1)
	const height = 1.0;
	const scale = cfg.height / height;
	const mixer = new THREE.AnimationMixer(scene);
	const clipOf = ([f, n]) => (f === 'm' ? src.m[n]?.animations[0] : src[f].animations.find((c) => c.name === n || c.name.endsWith(':' + n)));
	const extras = { gait: {}, hit: {}, turn: 0, height: cfg.height };
	const out = [];
	/** Поза в момент t клипа: локальные повороты, мировые повороты, мировая позиция таза. */
	const sample = (clip, t) => {
		mixer.stopAllAction();
		mixer.clipAction(clip).reset().play();
		mixer.setTime(Math.min(Math.max(t, 0), clip.duration - 1e-4));
		scene.updateMatrixWorld(true);
		const local = {}, world = {};
		for (const b of bones) { local[b.name] = b.quaternion.clone(); world[b.name] = b.getWorldQuaternion(new THREE.Quaternion()); }
		return { local, world, hip: hip.getWorldPosition(new THREE.Vector3()), feet: ['L_Foot', 'R_Foot'].map((n) => byName[n].getWorldPosition(new THREE.Vector3())) };
	};
	/** Кадр → поза сцены (повороты костей и таз), мировые матрицы пересчитаны. */
	const poseScene = (f) => {
		mixer.stopAllAction();
		for (const b of bones) b.quaternion.copy(f.local[b.name]);
		hip.position.copy(f.hip.clone().applyMatrix4(rootInvOf(f)));
		scene.updateMatrixWorld(true);
	};
	const wq = (n) => byName[n].getWorldQuaternion(new THREE.Quaternion());
	const wp = (n) => byName[n].getWorldPosition(new THREE.Vector3());
	async function footLock(C, frames, times, extras) {
		const n = frames.length - 1, dt = 1 / C.fps;
		const ank = frames.map((f) => { poseScene(f); return ['L', 'R'].map((sd) => wp(`${sd}_Foot`)); });
		const lowOf = (k) => { const ys = ank.map((a) => a[k].y), lo = Math.min(...ys), hi = Math.max(...ys); return (i) => ys[i] < lo + (hi - lo) * 0.22; };
		const sp = [];
		for (let k = 0; k < 2; k++) { const low = lowOf(k); for (let i = 1; i <= n; i++) if (low(i) && low(i - 1)) sp.push(-(ank[i][k].x - ank[i - 1][k].x) / dt); }
		sp.sort((x, y) => x - y);
		const v = Math.max(0, sp[sp.length >> 1] ?? 0);
		extras.gait[C.name] = +(v * scale).toFixed(3);
		// цели лодыжек по кадрам (цикл из n кадров: последний = первому)
		const target = [[], []], weight = [[], []];
		for (let k = 0; k < 2; k++) {
			const low = lowOf(k), W = new Array(n).fill(0), T = new Array(n).fill(null);
			const runs = [];
			const start = [...Array(n).keys()].find((i) => !low(i));
			if (start === undefined) continue;
			for (let j = 0, cur = null; j <= n; j++) {
				const i = (start + j) % n;
				if (low(i) && j < n) { if (!cur) runs.push(cur = []); cur.push(i); } else cur = null;
			}
			for (const run of runs) {
				const m = run[run.length >> 1], A = ank[m][k], mi = run.indexOf(m);
				const at = (j) => A.clone().setX(A.x - v * (j - mi) * dt);
				run.forEach((i, j) => { const p = at(j); p.y = ank[i][k].y; T[i] = p; W[i] = 1; });
				// края: 3 кадра до и после — плавный переход к цели
				for (let e = 1; e <= 3; e++) for (const [i, j] of [[(run[0] - e + n) % n, -e], [(run.at(-1) + e) % n, run.length - 1 + e]]) {
					const w = 1 - e / 4;
					if (w > W[i]) { const p = ank[i][k].clone().lerp(at(j).setY(ank[i][k].y), w); T[i] = p; W[i] = w; }
				}
			}
			target[k] = T; weight[k] = W;
		}
		for (let i = 0; i < n; i++) {
			const f = frames[i];
			for (let k = 0; k < 2; k++) {
				if (!weight[k][i]) continue;
				poseScene(f);
				const sd = ['L', 'R'][k], tn = `${sd}_Thigh`, cn = `${sd}_Calf`, fn = `${sd}_Foot`;
				const H = wp(tn), K = wp(cn), A = wp(fn), Tg = target[k][i];
				const L1 = K.distanceTo(H), L2 = A.distanceTo(K);
				const toT = Tg.clone().sub(H), d = Math.min(Math.max(toT.length(), Math.abs(L1 - L2) + 1e-4), (L1 + L2) * 0.9995), dir = toT.normalize();
				const perp = K.clone().sub(H); perp.addScaledVector(dir, -perp.dot(dir)).normalize();
				const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
				const K2 = H.clone().addScaledVector(dir, L1 * cosA).addScaledVector(perp, L1 * sinA), A2 = H.clone().addScaledVector(dir, d);
				const Rt = new THREE.Quaternion().setFromUnitVectors(K.clone().sub(H).normalize(), K2.clone().sub(H).normalize());
				const Wt = Rt.clone().multiply(wq(tn)), Wf = wq(fn);
				const Rc = new THREE.Quaternion().setFromUnitVectors(A.clone().sub(K).applyQuaternion(Rt).normalize(), A2.clone().sub(K2).normalize());
				const Wc = Rc.multiply(Rt).multiply(wq(cn));
				f.local[tn] = wq('Pelvis').invert().multiply(Wt);
				f.local[cn] = Wt.clone().invert().multiply(Wc);
				f.local[fn] = Wc.clone().invert().multiply(Wf);
			}
		}
		for (const b of bones) frames[n].local[b.name] = frames[0].local[b.name].clone();
	}

	for (const C0 of CLIPS) {
		if (C0.only && !C0.only.includes(id)) continue;
		let C = C0, clip = clipOf(C.src);
		if (!clip && C0.alt) { C = { ...C0, lunge: false, hitAuto: false, ...C0.alt }; clip = clipOf(C.src); }
		if (!clip) { console.warn(id, 'нет клипа', C.src.join(':')); continue; }
		let [t0, t1] = C.t ?? [0, clip.duration];
		if (C.loop) [t0, t1] = bestLoop(clip, t0, t1);
		C.used = `${C.src.join(':')} ${t0.toFixed(2)}–${t1.toFixed(2)}`;
		// времена кадров в исходном клипе (у рёва — туда, задержка, обратно)
		let srcTimes;
		if (C.roar) {
			const [a, b, hold] = C.roar, up = Math.round((b - a) * C.fps), h = Math.round(hold * C.fps);
			srcTimes = [...Array(up + 1).keys()].map((i) => a + (b - a) * i / up);
			for (let i = 1; i <= h; i++) srcTimes.push(b + 0.04 * Math.sin(i * 1.7)); // дрожь рёва
			for (let i = up - 1; i >= 0; i--) srcTimes.push(a + (b - a) * i / up);
		} else {
			const n = Math.max(2, Math.round((t1 - t0) * C.fps));
			srcTimes = [...Array(n + 1).keys()].map((i) => t0 + (t1 - t0) * i / n);
		}
		const frames = srcTimes.map((t) => sample(clip, t));
		const times = frames.map((_, i) => i / C.fps);
		if (C.loop) {
			// поза в конце — как в начале: поправка E = q0·qN⁻¹ растёт по циклу от нуля до полной
			const n = frames.length - 1;
			for (const b of bones) {
				const E = frames[0].local[b.name].clone().multiply(frames[n].local[b.name].clone().invert());
				frames.forEach((f, i) => { f.local[b.name] = new THREE.Quaternion().slerp(E, i / n).multiply(f.local[b.name]); });
			}
		}
		// бросок: где руки дальше всего впереди (удар), как далеко таз уходит вперёд (двигает игра)
		if (C.hitAuto) {
			let best = -Infinity, bi = 0;
			frames.forEach((f, i) => { mixer.setTime(0); const tt = srcTimes[i]; sample(clip, tt); const x = (byName.L_Hand.getWorldPosition(new THREE.Vector3()).x + byName.R_Hand.getWorldPosition(new THREE.Vector3()).x) / 2; if (x > best) { best = x; bi = i; } });
			C.hit = srcTimes[bi];
		}
		if (C.lunge) {
			const dx = frames.map((f) => f.hip.x - frames[0].hip.x), D = Math.max(...dx);
			const at = (k) => times[dx.findIndex((v) => v >= D * k)];
			if (D > 0.05) extras.lunge = { t0: +at(0.05).toFixed(3), t1: +at(0.95).toFixed(3), d: +(D * scale).toFixed(3) };
			frames.forEach((f) => { f.hip.x = hipRestW.x + (f.hip.x - frames[0].hip.x) - Math.max(0, f.hip.x - frames[0].hip.x); f.hip.z = hipRestW.z + (f.hip.z - frames[0].hip.z); });
		}
		// ход корня убран: таз по горизонтали — без линейного сноса, в среднем над точкой покоя
		if (C.inPlace || C.derotate) {
			if (C.derotate) {
				// поворот корпуса (рыскание по линии бёдер) — вынуть: ноги переступают на месте, поворачивает игра
				let prev = null, acc = 0;
				const yaw0 = [];
				for (const f of frames) {
					// линия бёдер из мировых поворотов: смещение бедра в осях таза
					const side = byName.R_Thigh.position.clone().sub(byName.L_Thigh.position).applyQuaternion(f.world.Pelvis);
					let y = Math.atan2(side.x, side.z); // поворот вокруг +Y (против часовой, если смотреть сверху)
					if (prev !== null) { let d = y - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; acc += d; }
					prev = y;
					yaw0.push(acc);
				}
				extras.turn = +Math.abs(yaw0.at(-1) / times.at(-1)).toFixed(3);
				frames.forEach((f, i) => {
					const R = new THREE.Quaternion().setFromAxisAngle(UP, -yaw0[i]);
					const wq = R.clone().multiply(f.world.Hip);
					f.local.Hip = f.local.BoneRoot.clone().invert().multiply(wq);
					f.hip = f.hip.clone().sub(hipRestW).applyQuaternion(R).add(hipRestW);
				});
			}
			const n = frames.length - 1;
			const d0 = frames[0].hip.clone(), d1 = frames[n].hip.clone();
			const off = frames.map((f, i) => f.hip.clone().sub(d0.clone().lerp(d1, i / n)));
			const mean = off.reduce((a, v) => a.add(v), V(0, 0, 0)).divideScalar(off.length);
			frames.forEach((f, i) => { f.hip.x = hipRestW.x + off[i].x - mean.x; f.hip.z = hipRestW.z + off[i].z - mean.z; });
		}
		// зеркало: мировые повороты парных костей отражаются, поправка покоя — чтобы в покое совпало с оригиналом
		if (C.mirror) {
			for (const f of frames) {
				const W = {};
				for (const b of bones) {
					const p = partner(b.name);
					if (!byName[p]) { W[b.name] = f.world[b.name]; continue; }
					const corr = mirrorQ(restWorld[p]).invert().multiply(restWorld[b.name]);
					W[b.name] = mirrorQ(f.world[p]).multiply(corr);
				}
				for (const b of bones) f.local[b.name] = b.parent?.isBone ? W[b.parent.name].clone().invert().multiply(W[b.name]) : W[b.name].clone();
				f.hip.z = -f.hip.z;
			}
		}
		// стопы без скольжения: в клипах Tripo (особенно по текстовому описанию) стопа на земле немного едет. Скорость
		// хода v — медиана скорости лодыжки назад в опоре; затем в каждой опоре стопа «прибивается»: едет назад ровно
		// со скоростью v (в игре корень идёт вперёд с той же скоростью — стопа стоит), нога дотягивается IK
		// (бедро → колено → лодыжка, колено — в своей плоскости, поворот стопы — как в клипе); края опоры — плавно.
		if (C.inPlace) await footLock(C, frames, times, extras);
		if (C.hit) extras.hit[C.name] = +(C.hit - t0).toFixed(3);
		extras.src ??= {};
		extras.src[C.name] = C.used;
		out.push({ name: C.name, times, frames });
	}
	// кости, которые двигаются хоть в одном клипе
	const moving = bones.filter((b) => !SKIP.test(b.name) && out.some((c) => c.frames.some((f) => Math.abs(f.local[b.name].dot(restLocal[b.name])) < 0.99995)));

	// ---- сборка файла ----
	const doc = await io.read(join(SRC, `z_${id}_a.glb`));
	const R = doc.getRoot();
	// клипы Tripo — вон вместе с их данными (иначе ключи остаются в файле)
	for (const a of R.listAnimations()) {
		for (const s of a.listSamplers()) { s.getInput()?.dispose(); s.getOutput()?.dispose(); s.dispose(); }
		for (const c of a.listChannels()) c.dispose();
		a.dispose();
	}
	const buffer = R.listBuffers()[0];
	const nodes = Object.fromEntries(R.listNodes().map((n) => [n.getName(), n]));
	for (const c of out) {
		const anim = doc.createAnimation(c.name);
		const input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(c.times)).setBuffer(buffer);
		// повороты — 16-битными нормированными числами (вдвое легче float, точность ~0,005°)
		const track = (node, path, arr, type) => {
			const acc = doc.createAccessor().setType(type).setBuffer(buffer);
			if (path === 'rotation') acc.setArray(Int16Array.from(arr, (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767))).setNormalized(true);
			else acc.setArray(arr);
			const s = doc.createAnimationSampler().setInput(input).setOutput(acc).setInterpolation('LINEAR');
			anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
		};
		for (const b of moving) {
			const arr = new Float32Array(c.frames.length * 4);
			let prev = null;
			c.frames.forEach((f, i) => { const q = f.local[b.name].clone(); if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); prev = q; arr.set([q.x, q.y, q.z, q.w], i * 4); });
			track(nodes[b.name], 'rotation', arr, 'VEC4');
		}
		const hp = new Float32Array(c.frames.length * 3);
		c.frames.forEach((f, i) => { const p = f.hip.clone().applyMatrix4(rootInvOf(f)); hp.set([p.x, p.y, p.z], i * 3); });
		track(nodes.Hip, 'translation', hp, 'VEC3');
	}
	// разворот лицом к +Z и рост: на верхнем узле (Armature)
	const top = R.listScenes()[0].listChildren();
	for (const n of top) {
		n.setScale([scale, scale, scale]);
		n.setRotation(new THREE.Quaternion().setFromAxisAngle(UP, -Math.PI / 2).toArray());
	}
	R.listScenes()[0].setExtras(extras);
	R.listScenes()[0].setName(`z_${id}`);
	for (const m of R.listMaterials()) {
		// только цвет: карты нормалей и шероховатости сверху не видны, а весят больше цвета
		m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
		m.setMetallicFactor(0).setRoughnessFactor(0.85).setName('Zombie');
	}
	await doc.transform(
		dedup(), prune(),
		weld({ tolerance: 0.0002 }),
		...(cfg.ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio: cfg.ratio, error: 0.002 })] : []),
		textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [512, 512], quality: 80 }),
		quantize(), prune(),
		meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
	);
	const file = join(REPO, 'models/game', `z_${id}.glb`);
	await io.write(file, doc);
	let tris = 0;
	for (const mesh of R.listMeshes()) for (const p of mesh.listPrimitives()) tris += p.getIndices().getCount() / 3;
	console.log(`z_${id}.glb: ${Math.round(statSync(file).size / 1024)} КБ, треуг ${tris}, костей с дорожками ${moving.length}, клипы ${out.map((c) => `${c.name} ${c.times.at(-1).toFixed(2)} с`).join(', ')}`);
	console.log('  extras', JSON.stringify(extras));
}

for (const id of (only ? only.split(',') : Object.keys(MODELS))) await buildModel(id);
