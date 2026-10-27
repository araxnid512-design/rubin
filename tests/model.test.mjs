import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createZombie, ANIMATION_NAMES } from '../src/zombie.js';
import { exportZombieGLB } from '../scripts/export-glb.mjs';

test('модель — SkinnedMesh со скелетом', () => {
	const { mesh, skeleton } = createZombie();
	assert.ok(mesh.isSkinnedMesh);
	assert.equal(skeleton.bones.length, 19);
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

test('GLB экспортируется и загружается обратно с 5 анимациями', async () => {
	const glb = await exportZombieGLB();
	const view = new DataView(glb);
	assert.equal(view.getUint32(0, true), 0x46546c67, 'магия glTF');
	const jsonLen = view.getUint32(12, true);
	const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLen)));
	assert.equal(json.animations.length, 5);
	assert.equal(json.skins.length, 1);
	assert.equal(json.skins[0].joints.length, 19);

	const gltf = await new GLTFLoader().parseAsync(glb, '');
	assert.deepEqual(gltf.animations.map((a) => a.name), ANIMATION_NAMES);
	let skinned = 0;
	gltf.scene.traverse((o) => { if (o.isSkinnedMesh) skinned++; });
	assert.equal(skinned, 1);
});
