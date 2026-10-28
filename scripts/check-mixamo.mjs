// Проверка совместимости скелета героя со стандартом Mixamo.
// Берёт эталонного персонажа Mixamo «X Bot» из примеров three.js, сверяет имена и иерархию костей,
// затем проигрывает его анимации (idle, walk, run) на нашем герое и кадр за кадром сравнивает
// направления костей героя и X Bot. При одинаковой позе покоя и осях костей направления совпадают
// (разница — только в пропорциях тела).
//   node scripts/check-mixamo.mjs [путь к Xbot.glb]   (без пути — скачивается в test-output/)
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { buildCharacter } from './makehuman/build-zombie.mjs';
import { HERO_PROFILE } from './makehuman/profiles.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/models/gltf/Xbot.glb';
let file = process.argv[2];
if (!file) {
	file = join(ROOT, 'test-output', 'Xbot.glb');
	if (!existsSync(file)) {
		mkdirSync(dirname(file), { recursive: true });
		console.log('скачиваю', URL);
		execFileSync('curl', ['-sSL', '--max-time', '120', '-o', file, URL]);
	}
}

// ---------- минимальное чтение GLB: узлы и анимации ----------
const buf = readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
const bin = buf.subarray(20 + jsonLen + 8);
const accessor = (i) => {
	const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView];
	const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
	const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
	return new Float32Array(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + a.count * n * 4));
};
const sanitize = (n) => THREE.PropertyBinding.sanitizeNodeName(n);
const joints = gltf.skins[0].joints;
const parentOf = {};
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parentOf[c] = i)));
// скелет X Bot (без масштаба Armature — на направления он не влияет)
const xbones = {};
for (const j of joints) {
	const n = gltf.nodes[j], b = new THREE.Bone();
	b.name = sanitize(n.name);
	if (n.translation) b.position.fromArray(n.translation);
	if (n.rotation) b.quaternion.fromArray(n.rotation);
	xbones[j] = b;
}
for (const j of joints) if (xbones[parentOf[j]]) xbones[parentOf[j]].add(xbones[j]);
const xroot = xbones[joints[0]];
const clips = gltf.animations.map((a) => new THREE.AnimationClip(a.name, -1, a.channels
	.filter((c) => c.target.path === 'rotation' && joints.includes(c.target.node))
	.map((c) => {
		const s = a.samplers[c.sampler];
		return new THREE.QuaternionKeyframeTrack(`${sanitize(gltf.nodes[c.target.node].name)}.quaternion`, accessor(s.input), accessor(s.output));
	})));

// ---------- герой ----------
const { model } = buildCharacter(HERO_PROFILE, { textureSize: 32 });
const ours = {};
model.traverse((o) => { if (o.isBone) ours[o.name] = o; });
let failed = false;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed = true; };

const xnames = Object.values(xbones).map((b) => b.name).filter((n) => !/Eye$/.test(n));
const missing = xnames.filter((n) => !ours[n]);
const extra = Object.keys(ours).filter((n) => !xnames.includes(n));
check(!missing.length && !extra.length, `кости совпадают с Mixamo (${xnames.length} без глаз)${missing.length ? '; нет: ' + missing.join(', ') : ''}${extra.length ? '; лишние: ' + extra.join(', ') : ''}`);
const badParent = xnames.filter((n) => ours[n] && (ours[n].parent?.isBone ? ours[n].parent.name : null) !== (xroot.getObjectByName(n).parent?.isBone ? xroot.getObjectByName(n).parent.name : null));
check(!badParent.length, `иерархия как у Mixamo${badParent.length ? ': ' + badParent.join(', ') : ''}`);
check(Object.values(ours).every((b) => b.quaternion.angleTo(new THREE.Quaternion()) < 1e-6), 'поза покоя — T-поза, оси костей мировые (как у X Bot)');

// направления сегментов тела у героя и X Bot при одних и тех же локальных поворотах
const SEG = [
	['LeftArm', 'LeftForeArm'], ['LeftForeArm', 'LeftHand'], ['RightArm', 'RightForeArm'], ['RightForeArm', 'RightHand'],
	['LeftHand', 'LeftHandMiddle1'], ['RightHand', 'RightHandMiddle1'],
	['LeftUpLeg', 'LeftLeg'], ['LeftLeg', 'LeftFoot'], ['RightUpLeg', 'RightLeg'], ['RightLeg', 'RightFoot'],
	['Spine', 'Neck'], ['Neck', 'Head'],
];
const dir = (bones, a, b) => bones[`mixamorig${b}`].getWorldPosition(new THREE.Vector3()).sub(bones[`mixamorig${a}`].getWorldPosition(new THREE.Vector3())).normalize();
const xmap = {};
xroot.traverse((o) => { if (o.isBone) xmap[o.name] = o; });
const restDiff = SEG.map(([a, b]) => { model.updateMatrixWorld(true); xroot.updateMatrixWorld(true); return dir(ours, a, b).angleTo(dir(xmap, a, b)) * 180 / Math.PI; });
const restWorst = Math.max(...restDiff), restAt = SEG[restDiff.indexOf(restWorst)].join('→');
check(restWorst < 15, `в T-позе кости смотрят туда же, что у X Bot (расхождение до ${restWorst.toFixed(1)}° — ${restAt}, из-за пропорций тела)`);
for (const clip of clips.filter((c) => ['idle', 'walk', 'run'].includes(c.name))) {
	const m1 = new THREE.AnimationMixer(model), m2 = new THREE.AnimationMixer(xroot);
	m1.clipAction(clip).play(); m2.clipAction(clip).play();
	let worst = 0, where = '';
	for (let t = 0; t < clip.duration; t += 1 / 30) {
		m1.setTime(t); m2.setTime(t);
		model.updateMatrixWorld(true); xroot.updateMatrixWorld(true);
		SEG.forEach(([a, b], i) => {
			// разница сверх той, что есть в позе покоя из-за пропорций
			const d = dir(ours, a, b).angleTo(dir(xmap, a, b)) * 180 / Math.PI - restDiff[i];
			if (d > worst) { worst = d; where = `${a}→${b} t=${t.toFixed(2)}`; }
		});
	}
	check(worst < 12, `анимация Mixamo «${clip.name}» на герое повторяет X Bot (отклонение до ${worst.toFixed(1)}° — ${where})`);
	m1.stopAllAction(); m1.uncacheRoot(model);
}
for (const b of Object.values(ours)) b.quaternion.identity();
console.log(failed ? 'MIXAMO: FAIL' : 'MIXAMO: OK — скелет героя соответствует стандарту Mixamo');
process.exit(failed ? 1 : 0);
