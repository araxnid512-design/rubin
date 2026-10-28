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
