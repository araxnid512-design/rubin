// Иконки предметов и портреты героя: настоящие 3D-модели игры, отрисованные в картинки (data URL)
// отдельным маленьким рендерером с прозрачным фоном.

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WEAPONS, MOUNTS, CLIPS } from './weapons.js';
import { makeItemMesh } from './items.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Кулак (оружия нет): рисунок вместо 3D-модели. */
const FIST_ICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="#d9b08c" stroke="#5a3a26" stroke-width="2.4" stroke-linejoin="round">
<rect x="20" y="49" width="22" height="11" rx="3" fill="#56603e"/><rect x="14" y="22" width="34" height="30" rx="9"/>
<rect x="14" y="14" width="9" height="17" rx="4.5"/><rect x="22.5" y="11" width="9" height="19" rx="4.5"/><rect x="31" y="11" width="9" height="19" rx="4.5"/><rect x="39.5" y="14" width="9" height="17" rx="4.5"/>
<path d="M15 39c-7-1-8-9-5-13 6-1 12 2 15 7z"/></g></svg>`)}`;

export function createIconFactory() {
	const canvas = document.createElement('canvas');
	let r;
	try {
		r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
	} catch {
		return null;
	}
	r.setPixelRatio(1);
	r.setClearColor(0x000000, 0);
	r.toneMapping = THREE.ACESFilmicToneMapping;
	r.toneMappingExposure = 1.0;
	const scene = new THREE.Scene();
	// окружение для отражений: без него металл (ПМ, лезвие) выглядит чёрным
	const pmrem = new THREE.PMREMGenerator(r);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environmentIntensity = 0.45;
	scene.add(new THREE.HemisphereLight(0xdfe6e0, 0x3a3a30, 1.0));
	const key = new THREE.DirectionalLight(0xfff2e0, 2.2);
	key.position.set(-2, 3, 4);
	const rim = new THREE.DirectionalLight(0xbcd8ff, 1.6);
	rim.position.set(3, 2, -3);
	// заполняющий свет со стороны камеры: тёмный металл (ПМ) не превращается в силуэт
	const fill = new THREE.DirectionalLight(0xffffff, 0.8);
	scene.add(key, rim, fill);
	const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);

	const shoot = (obj, w, h, fov, from, target) => {
		r.setSize(w, h, false);
		camera.fov = fov;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		camera.position.copy(from);
		camera.lookAt(target);
		fill.position.copy(from).sub(target).add(V(0, 0.3, 0));
		scene.add(obj);
		obj.updateMatrixWorld(true);
		r.render(scene, camera);
		scene.remove(obj);
		return canvas.toDataURL('image/png');
	};

	/** Предмет, вписанный в квадрат: view — откуда смотрим. */
	function item(obj, { view = [-0.55, 0.6, 1], size = 128, fill = 0.92 } = {}) {
		obj.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(obj);
		const sphere = box.getBoundingSphere(new THREE.Sphere());
		const fov = 26;
		const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(fov / 2)) / fill;
		return shoot(obj, size, size, fov, sphere.center.clone().addScaledVector(V(...view).normalize(), dist), sphere.center);
	}

	/**
	 * Герой в позе клипа: { obj, bone(name) → мировая позиция }.
	 * gear — { melee, gun }, hold — что из них в руке; второе висит в своём креплении.
	 */
	function posed(gltf, clipName, gear, hold, tint = null) {
		const model = SkeletonUtils.clone(gltf.scene);
		// другая форма (жители стаба): свои копии материалов ткани и снаряжения, перекрашенные
		if (tint) {
			const c = new THREE.Color(...tint);
			model.traverse((o) => {
				if (!o.isMesh) return;
				const mats = [o.material].flat().map((m) => {
					if (!/Cloth|Gear/.test(m.name)) return m;
					const t = m.clone();
					t.color.multiply(c);
					return t;
				});
				o.material = Array.isArray(o.material) ? mats : mats[0];
			});
		}
		const clip = gltf.animations.find((c) => c.name === clipName);
		if (clip) {
			const mixer = new THREE.AnimationMixer(model);
			mixer.clipAction(clip).play();
			mixer.setTime(Math.min(0.5, clip.duration * 0.5));
		}
		const grip = model.getObjectByName('GripR');
		for (const slot of ['melee', 'gun']) {
			const id = gear[slot];
			if (!id) continue;
			const mount = model.getObjectByName(MOUNTS[WEAPONS[id].mount]);
			(slot === hold ? grip : mount ?? grip).add(WEAPONS[id].make());
		}
		model.updateMatrixWorld(true);
		const bone = (n) => model.getObjectByName(`mixamorig${n}`)?.getWorldPosition(V()) ?? V(0, 1.8, 0);
		return { obj: model, bone };
	}

	return {
		/** Иконка оружия: топор — по диагонали лезвием вниз, ствол — вправо, затвором вверх. */
		weapon(id) {
			if (id === 'fists') return FIST_ICON;
			const g = WEAPONS[id].make();
			if (WEAPONS[id].anim === 'axe') {
				g.rotation.x = -g.userData.tilt - Math.PI / 4;
				return item(g, { view: [-1, 0.15, 0.12] });
			}
			g.rotation.x = -Math.PI / 2;
			return item(g, { view: [-1, 0.2, -0.2], fill: WEAPONS[id].anim === 'rifle' ? 1 : 0.92 });
		},
		item: (kind) => item(makeItemMesh(kind)),
		/** Портрет: голова и плечи героя. */
		portrait(gltf, { size = 128, tint = null, gear = { melee: 'axe' } } = {}) {
			const { obj, bone } = posed(gltf, 'Idle', gear, 'melee', tint);
			const t = bone('Head').add(V(0, 0.09, 0.04));
			return shoot(obj, size, size, 24, t.clone().add(V(0.28, 0.03, 0.95)), t);
		},
		/** Герой в полный рост с оружием в руке — для инвентаря. */
		figure(gltf, gear, hold, { w = 200, h = 340 } = {}) {
			const { obj, bone } = posed(gltf, CLIPS[WEAPONS[gear[hold]].anim].idle, gear, hold);
			const hips = bone('Hips'), t = V(hips.x, 1.0, hips.z);
			return shoot(obj, w, h, 30, t.clone().add(V(1.3, 0.35, 4.1)), t);
		},
		dispose() { pmrem.dispose(); r.dispose(); },
	};
}
