// Процедурная модель зомби: SkinnedMesh со скелетом, PBR-материалами и 5 анимациями.
// Работает и в браузере, и в Node (без DOM), поэтому её можно экспортировать в GLB.

import * as THREE from 'three';
import { createSkeleton, createBodyGeometry } from './body.js';
import { createSkinTextures, createClothTextures } from './textures.js';
import { ANIMATION_NAMES, createZombieAnimations } from './animations.js';

export { ANIMATION_NAMES, createZombieAnimations };

// Текстуры генерируются один раз и переиспользуются всеми экземплярами.
let textures = null;
function getTextures() {
	textures ??= { skin: createSkinTextures(512), cloth: createClothTextures(512) };
	return textures;
}

export function createZombieMaterials() {
	const { skin, cloth } = getTextures();
	return [
		new THREE.MeshStandardMaterial({
			name: 'Skin', vertexColors: true, map: skin.map, normalMap: skin.normalMap,
			normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.6, metalness: 0,
		}),
		new THREE.MeshStandardMaterial({
			name: 'Cloth', vertexColors: true, map: cloth.map, normalMap: cloth.normalMap,
			normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
		}),
		new THREE.MeshStandardMaterial({ name: 'Eye', vertexColors: true, roughness: 0.08, metalness: 0 }),
		new THREE.MeshStandardMaterial({ name: 'Teeth', vertexColors: true, roughness: 0.4, metalness: 0 }),
	];
}

/**
 * Создаёт модель зомби.
 * @returns {{ model: THREE.Group, mesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton, animations: THREE.AnimationClip[] }}
 */
export function createZombie() {
	const bones = createSkeleton();
	const boneList = Object.values(bones);
	const geometry = createBodyGeometry(boneList);

	const mesh = new THREE.SkinnedMesh(geometry, createZombieMaterials());
	mesh.name = 'ZombieMesh';
	mesh.castShadow = true;
	mesh.receiveShadow = true;

	const skeleton = new THREE.Skeleton(boneList);
	mesh.add(bones.Root);
	mesh.bind(skeleton);

	const model = new THREE.Group();
	model.name = 'Zombie';
	model.add(mesh);

	const animations = createZombieAnimations(bones.Root);
	model.animations = animations;
	return { model, mesh, skeleton, animations };
}
