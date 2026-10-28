import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createZombie, ANIMATION_NAMES } from '../src/zombie.js';
import { exportZombieGLB } from '../scripts/export-glb.mjs';
import { buildZombie } from '../scripts/makehuman/build-zombie.mjs';

test('модель — SkinnedMesh со скелетом и 4 материалами', () => {
	const { mesh, skeleton } = createZombie();
	assert.ok(mesh.isSkinnedMesh);
	assert.equal(skeleton.bones.length, 19);
	assert.deepEqual(mesh.material.map((m) => m.name), ['Skin', 'Cloth', 'Eye', 'Teeth']);
	assert.ok(mesh.geometry.attributes.position.count > 10000, 'детализированный меш');
	const pos = mesh.geometry.attributes.position;
	assert.equal(mesh.geometry.attributes.skinIndex.count, pos.count);
	const box = mesh.geometry.boundingBox;
	assert.ok(Math.abs(box.min.y) < 0.01, `ступни на земле (min.y=${box.min.y})`);
	assert.ok(box.max.y > 1.7 && box.max.y < 2.05, `рост ~1.9 м (max.y=${box.max.y})`);
});

test('есть ровно 5 анимаций с нужными именами', () => {
	const { animations } = createZombie();
	assert.deepEqual(animations.map((a) => a.name), ANIMATION_NAMES);
	for (const clip of animations) {
		assert.ok(clip.duration > 0, clip.name);
		assert.ok(clip.validate(), `${clip.name}: дорожки валидны`);
	}
});

test('все дорожки анимаций ссылаются на существующие кости', () => {
	const { model, animations } = createZombie();
	for (const clip of animations) {
		for (const track of clip.tracks) {
			const { nodeName } = THREE.PropertyBinding.parseTrackName(track.name);
			assert.ok(model.getObjectByName(nodeName)?.isBone, `${clip.name}: ${track.name}`);
		}
	}
});

test('каждая анимация реально двигает скелет', () => {
	const { model, mesh, animations } = createZombie();
	const mixer = new THREE.AnimationMixer(model);
	const head = model.getObjectByName('Head');
	const rest = new THREE.Vector3();
	model.updateMatrixWorld(true);
	head.getWorldPosition(rest);
	for (const clip of animations) {
		mixer.stopAllAction();
		mixer.clipAction(clip).play();
		mixer.setTime(clip.duration * 0.5);
		model.updateMatrixWorld(true);
		const p = head.getWorldPosition(new THREE.Vector3());
		assert.ok(p.distanceTo(rest) > 0.01, `${clip.name} двигает голову`);
		assert.ok(Number.isFinite(p.y), clip.name);
	}
	// После смерти зомби лежит на земле.
	mixer.stopAllAction();
	const death = animations.find((a) => a.name === 'Death');
	mixer.clipAction(death).play();
	mixer.setTime(death.duration - 0.001);
	model.updateMatrixWorld(true);
	assert.ok(head.getWorldPosition(new THREE.Vector3()).y < 0.4, 'голова у земли после Death');
	assert.ok(mesh.skeleton.bones.every((b) => b.matrixWorld.elements.every(Number.isFinite)));
});

test('реалистичный GLB (MakeHuman) экспортируется с 5 анимациями', async () => {
	const glb = await exportZombieGLB({ textureSize: 128 });
	const view = new DataView(glb);
	assert.equal(view.getUint32(0, true), 0x46546c67, 'магия glTF');
	const jsonLen = view.getUint32(12, true);
	const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLen)));
	assert.equal(json.animations.length, 5);
	assert.equal(json.skins.length, 1);
	assert.equal(json.skins[0].joints.length, 19);

	// Полная загрузка через GLTFLoader проверяется в браузере (npm run test:e2e),
	// в Node у загрузчика нет декодера картинок — проверяем структуру файла.
	assert.deepEqual(json.animations.map((a) => a.name), ANIMATION_NAMES);
	for (const anim of json.animations) {
		for (const ch of anim.channels) assert.ok(json.skins[0].joints.includes(ch.target.node), `${anim.name}: канал на кость`);
	}
	assert.ok(json.meshes[0].primitives.every((p) => p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined));
	assert.equal(json.materials.length, 4, "4 материала: кожа, ткань, глаза, зубы");
	assert.equal(json.textures.length, 5, "цвет и нормали кожи и ткани + глаза");
});

test('модель MakeHuman: рост, руки опущены, анимации двигают скелет', () => {
	const { model, mesh, animations } = buildZombie({ textureSize: 64 });
	const box = mesh.geometry.boundingBox;
	assert.ok(Math.abs(box.min.y) < 0.01, `ступни на земле (min.y=${box.min.y})`);
	assert.ok(box.max.y > 1.65 && box.max.y < 1.9, `рост ~1.75 м (max.y=${box.max.y})`);
	assert.ok(mesh.geometry.attributes.position.count > 15000, 'детализированный меш');
	model.updateMatrixWorld(true);
	const world = (n) => model.getObjectByName(n).getWorldPosition(new THREE.Vector3());
	for (const s of ['L', 'R']) {
		const shoulder = world(`UpperArm.${s}`), hand = world(`Hand.${s}`);
		assert.ok(shoulder.y - hand.y > 0.45, `рука ${s} опущена вдоль тела`);
		assert.ok(Math.abs(hand.x - shoulder.x) < 0.12, `рука ${s} не отведена в сторону`);
	}
	assert.ok(mesh.skeleton.bones.every((b) => b.quaternion.equals(new THREE.Quaternion())), 'поза привязки без поворотов');
	const mixer = new THREE.AnimationMixer(model);
	const rest = world('Head');
	for (const clip of animations) {
		mixer.stopAllAction();
		mixer.clipAction(clip).play();
		mixer.setTime(clip.duration * 0.5);
		model.updateMatrixWorld(true);
		assert.ok(world('Head').distanceTo(rest) > 0.01, `${clip.name} двигает голову`);
	}
});

test('анимации: ступни не проваливаются под землю, после смерти тело лежит', () => {
	for (const { model, animations } of [createZombie(), buildZombie({ textureSize: 32 })]) {
		const mixer = new THREE.AnimationMixer(model);
		const y = (n) => model.getObjectByName(n).getWorldPosition(new THREE.Vector3()).y;
		model.updateMatrixWorld(true);
		const ankle = y('Foot.L');
		for (const clip of animations) {
			mixer.stopAllAction();
			mixer.clipAction(clip).play();
			for (let t = 0; t <= clip.duration; t += clip.duration / 40) {
				mixer.setTime(Math.min(t, clip.duration - 1e-3));
				model.updateMatrixWorld(true);
				if (clip.name !== 'Death') {
					for (const s of ['L', 'R']) assert.ok(y(`Foot.${s}`) > ankle - 0.02, `${clip.name} t=${t.toFixed(2)}: ступня ${s} над землёй`);
				}
			}
			if (clip.name === 'Death') {
				assert.ok(y('Hips') < 0.3 && y('Head') < 0.35, 'после Death зомби лежит');
				assert.ok(y('Head') > 0.03, 'голова не ушла под землю');
			}
		}
	}
});

test('герой: стандартный скелет Mixamo (65 костей, T-поза), пальцы, крепления оружия, все анимации', async () => {
	const { buildCharacter } = await import('../scripts/makehuman/build-zombie.mjs');
	const { HERO_PROFILE } = await import('../scripts/makehuman/profiles.mjs');
	const { HERO_ANIMATION_NAMES } = await import('../src/hero-animations.js');
	const { MIXAMO_RIG } = await import('../scripts/makehuman/rigs.mjs');
	const { model, mesh, animations } = buildCharacter(HERO_PROFILE, { textureSize: 32 });
	const B = (n) => model.getObjectByName(`mixamorig${n}`);
	// стандарт Mixamo: имена (как их видит three.js), иерархия, концевые кости
	assert.equal(mesh.skeleton.bones.length, 65, '65 костей, как у Mixamo');
	assert.deepEqual(mesh.skeleton.bones.map((b) => b.name), MIXAMO_RIG.names);
	for (const [n, p] of [['Hips', null], ['Spine2', 'Spine1'], ['LeftShoulder', 'Spine2'], ['RightHand', 'RightForeArm'], ['LeftHandIndex4', 'LeftHandIndex3'], ['HeadTop_End', 'Head'], ['RightToe_End', 'RightToeBase']]) {
		assert.ok(B(n)?.isBone, n);
		assert.equal(B(n).parent?.isBone ? B(n).parent.name : null, p && `mixamorig${p}`, `родитель ${n}`);
	}
	// поза покоя — T-поза: повороты костей единичные, руки вытянуты вдоль ±X, ладони вниз
	model.updateMatrixWorld(true);
	for (const b of mesh.skeleton.bones) assert.ok(b.quaternion.angleTo(new THREE.Quaternion()) < 1e-6, `${b.name}: в покое без поворота`);
	const W = (n) => (n.startsWith('Grip') ? model.getObjectByName(n) : B(n)).getWorldPosition(new THREE.Vector3());
	for (const [S, sx] of [['Left', 1], ['Right', -1]]) {
		const arm = W(`${S}Hand`).sub(W(`${S}Arm`)).normalize();
		assert.ok(arm.x * sx > 0.99, `${S}: рука в T-позе вдоль оси X`);
		const curl = W(`${S}HandMiddle4`).sub(W(`${S}HandMiddle1`));
		assert.ok(curl.y < 0, `${S}: пальцы чуть согнуты вниз — ладонь смотрит вниз`);
		assert.ok(W(`${S}HandThumb1`).z > W(`${S}HandPinky1`).z, `${S}: большой палец впереди`);
	}
	for (const n of ['GripR', 'GripL', 'AxeMount', 'HolsterMount']) assert.ok(model.getObjectByName(n), `узел ${n}`);
	assert.deepEqual(animations.map((a) => a.name), HERO_ANIMATION_NAMES);

	const mixer = new THREE.AnimationMixer(model);
	const y = (n) => B(n).getWorldPosition(new THREE.Vector3()).y;
	const ankle = 0.08;
	const finger = () => B('RightHandMiddle2').quaternion.angleTo(new THREE.Quaternion());
	for (const clip of animations) {
		mixer.stopAllAction();
		mixer.clipAction(clip).play();
		for (let t = 0; t <= clip.duration; t += clip.duration / 20) {
			mixer.setTime(Math.min(t, clip.duration - 1e-3));
			model.updateMatrixWorld(true);
			for (const b of mesh.skeleton.bones) assert.ok(Number.isFinite(b.quaternion.w), `${clip.name}: ${b.name} без NaN`);
			if (clip.name !== 'Death') for (const s of ['Left', 'Right']) assert.ok(y(`${s}Foot`) > ankle - 0.025, `${clip.name} t=${t.toFixed(2)}: ступня над землёй`);
		}
		// с оружием в руке пальцы сжаты
		if (['Idle', 'Melee', 'IdlePistol', 'AimPistol', 'Shoot'].includes(clip.name)) {
			mixer.setTime(0.1);
			assert.ok(finger() > 1, `${clip.name}: пальцы правой руки сжаты`);
		}
	}
	const at = (name, t) => { mixer.stopAllAction(); mixer.clipAction(animations.find((a) => a.name === name)).play(); mixer.setTime(t); model.updateMatrixWorld(true); };
	// ключица поднимается при замахе топором
	at('Melee', 0.2);
	assert.ok(B('RightShoulder').quaternion.angleTo(new THREE.Quaternion()) > 0.15, 'ключица работает на замахе');
	// носки стоп смотрят наружу, а не друг на друга
	const toeYaw = (s) => { const d = W(`${s}ToeBase`).sub(W(`${s}Foot`)); return Math.atan2(d.x, d.z) * 180 / Math.PI; };
	for (const name of ['Idle', 'IdlePistol', 'AimPistol', 'Walk', 'WalkPistol', 'Melee', 'Reload']) {
		at(name, 0.3);
		assert.ok(toeYaw('Left') > 2 && toeYaw('Right') < -2, `${name}: носки врозь (L ${toeYaw('Left').toFixed(0)}°, R ${toeYaw('Right').toFixed(0)}°)`);
	}
	// прицел: пистолет на вытянутых руках на уровне плеч, ствол вперёд
	at('AimPistol', 0.5);
	const grip = W('GripR'), shoulder = W('RightArm');
	assert.ok(grip.y > shoulder.y && grip.z - shoulder.z > 0.5, `пистолет в прицеле вытянут вперёд (y ${grip.y.toFixed(2)}, z ${grip.z.toFixed(2)})`);
	// удар топором идёт справа налево: на замахе топор справа, в доводке — слева от тела
	at('Melee', 0.2);
	const windup = W('GripR').x;
	at('Melee', 0.45);
	assert.ok(windup < -0.2 && W('GripR').x > 0.05, `дуга удара справа налево (${windup.toFixed(2)} → ${W('GripR').x.toFixed(2)})`);
});

test('герой: все суставы во всех анимациях в анатомических пределах (без выкрученных рук и ног)', async () => {
	const { buildCharacter } = await import('../scripts/makehuman/build-zombie.mjs');
	const { HERO_PROFILE } = await import('../scripts/makehuman/profiles.mjs');
	const { analyzeClip } = await import('../src/anatomy.js');
	const { model, animations } = buildCharacter(HERO_PROFILE, { textureSize: 32 });
	const problems = animations.flatMap((clip) => analyzeClip(model, clip).violations.map((v) => `${clip.name}: ${v}`));
	assert.deepEqual(problems, [], problems.join('\n'));
});
