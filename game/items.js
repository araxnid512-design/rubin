// Предметы кластера: описания для инвентаря и 3D-модели — одни и те же для подбора на земле
// и для иконок (иконки рендерятся из этих моделей, см. icons.js).

import * as THREE from 'three';

export const ITEMS = {
	axe: { name: 'Топор', type: 'weapon', desc: 'Тихое оружие ближнего боя. Удар слышно недалеко, патронов не тратит.' },
	pistol: { name: 'ПМ', type: 'weapon', desc: 'Пистолет Макарова, магазин на 8 патронов 9×18. Выстрел слышно издалека.' },
	ammo: { name: 'Патроны 9×18', forms: ['патрон', 'патрона', 'патронов'], desc: 'Патроны к ПМ. Перезарядка берёт их из рюкзака. Попадаются в кластере и у убитых.' },
	zhivchik: { name: 'Живчик', forms: ['живчик', 'живчика', 'живчиков'], use: 'Выпить', desc: 'Лечебное зелье Улья: восстанавливает 45 здоровья.' },
	spore: { name: 'Споран', forms: ['споран', 'спорана', 'споранов'], desc: 'Споровый мешок из затылка заражённого — валюта Улья.' },
	peas: { name: 'Горох', forms: ['горошина', 'горошины', 'горошин'], desc: 'Горошины из споровых мешков топтунов. Ценятся дороже споранов.' },
};

/** Порядок предметов в рюкзаке. */
export const BAG_ORDER = ['ammo', 'zhivchik', 'spore', 'peas'];

/** «3 патрона», «5 споранов». */
export function plural(n, [one, few, many]) {
	const a = Math.abs(n) % 100, b = a % 10;
	return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}

const mat = (o) => new THREE.MeshStandardMaterial(o);

/** 3D-модель предмета (без свечения — его добавляет подбор на земле). Начало координат — у дна. */
export function makeItemMesh(kind) {
	const g = new THREE.Group();
	if (kind === 'ammo') {
		// открытая армейская коробка с патронами
		const olive = mat({ color: 0x4d5a36, roughness: 0.55, metalness: 0.35 });
		const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.18), olive);
		box.position.y = 0.06;
		const lid = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.18), olive);
		lid.position.set(0, 0.16, -0.12);
		lid.rotation.x = -1.15;
		const label = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), mat({ color: 0xd8c25a, roughness: 0.8 }));
		label.position.set(0, 0.065, 0.091);
		const brass = mat({ color: 0xc9a248, roughness: 0.3, metalness: 0.9 });
		const tip = mat({ color: 0x8a6a3a, roughness: 0.35, metalness: 0.8 });
		const shell = new THREE.CylinderGeometry(0.011, 0.011, 0.03, 8), bullet = new THREE.SphereGeometry(0.011, 8, 6);
		for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
			const x = -0.1 + i * 0.04, z = -0.055 + j * 0.037;
			const s = new THREE.Mesh(shell, brass); s.position.set(x, 0.125, z);
			const b = new THREE.Mesh(bullet, tip); b.position.set(x, 0.14, z);
			g.add(s, b);
		}
		g.add(box, lid, label);
	} else if (kind === 'zhivchik') {
		const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 14), mat({ color: 0xa04040, roughness: 0.1, transparent: true, opacity: 0.88, emissive: 0x501010 }));
		flask.position.y = 0.11;
		const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.05, 12), flask.material);
		neck.position.y = 0.245;
		const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 10), mat({ color: 0x2a2420, roughness: 0.7 }));
		cap.position.y = 0.29;
		g.add(flask, neck, cap);
	} else if (kind === 'spore') {
		const pod = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12).scale(1, 1.3, 1), mat({ color: 0x8a8070, roughness: 0.6, emissive: 0x3a5a20, emissiveIntensity: 0.6 }));
		pod.position.y = 0.14;
		const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.06, 6), mat({ color: 0x6a5a48, roughness: 0.8 }));
		stalk.position.y = 0.3;
		g.add(pod, stalk);
	} else if (kind === 'peas') {
		const pea = mat({ color: 0x9cc65a, roughness: 0.35, emissive: 0x2a4a10, emissiveIntensity: 0.5 });
		const geo = new THREE.SphereGeometry(0.035, 12, 10);
		[[0, 0.035, 0], [0.065, 0.035, 0.01], [-0.06, 0.035, 0.02], [0.02, 0.035, 0.06], [-0.02, 0.035, -0.055], [0.01, 0.095, 0.01]]
			.forEach((p) => { const m = new THREE.Mesh(geo, pea); m.position.set(...p); g.add(m); });
	}
	g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
	return g;
}

/** Цвет свечения предмета на земле (r,g,b). */
export const GLOW = { ammo: '255,220,120', zhivchik: '255,120,120', spore: '170,255,120', peas: '200,255,140' };
