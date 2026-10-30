// Предметы кластера: описания для инвентаря и 3D-модели — одни и те же для подбора на земле
// и для иконок (иконки рендерятся из этих моделей, см. icons.js).

import * as THREE from 'three';
import { WEAPONS, makeGrenade } from './weapons.js';

const ROUNDS = ['патрон', 'патрона', 'патронов'];
export const ITEMS = {
	...Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, { name: w.name, type: 'weapon', desc: w.desc }])),
	ammo9: { name: 'Патроны 9×18', type: 'ammo', forms: ROUNDS, desc: 'Пистолетные патроны к ПМ. Лежат в домах: в шкафах, комодах, сундуках.' },
	ammo12: { name: 'Патроны 12 кал.', type: 'ammo', forms: ROUNDS, desc: 'Охотничьи патроны с картечью к обрезу. Чаще всего — у дачников и сторожей.' },
	ammo919: { name: 'Патроны 9×19', type: 'ammo', forms: ROUNDS, desc: 'Пистолетные патроны парабеллум — к «Вектору». Продаёт торговец в стабе.' },
	ammo545: { name: 'Патроны 5,45×39', type: 'ammo', forms: ROUNDS, desc: 'Автоматные патроны к АКС-74У и АК-74. В кластерах редки — проще купить в стабе.' },
	ammo762: { name: 'Патроны 7,62×39', type: 'ammo', forms: ROUNDS, desc: 'Автоматные патроны к АК-47: тяжёлая пуля, сильная отдача.' },
	ammo76254: { name: 'Патроны 7,62×54R', type: 'ammo', forms: ROUNDS, desc: 'Винтовочные патроны к СВД и ПКМ. Дорогие — каждый выстрел должен попасть.' },
	ammo939: { name: 'Патроны 9×39', type: 'ammo', forms: ROUNDS, desc: 'Тяжёлые дозвуковые патроны к ВСС «Винторез» — для тихой стрельбы.' },
	grenade: { name: 'Граната Ф-1', forms: ['граната', 'гранаты', 'гранат'], use: 'Бросить', desc: 'Оборонительная граната: бросок к ближайшим заражённым, взрыв через 2 секунды, разлёт осколков до 6 м — не стой рядом. Кнопка гранаты или G.' },
	zhivchik: { name: 'Живчик', forms: ['живчик', 'живчика', 'живчиков'], use: 'Выпить', desc: 'Лечебное зелье Улья: восстанавливает 45 здоровья.' },
	spore: { name: 'Споран', forms: ['споран', 'спорана', 'споранов'], desc: 'Споровый мешок из затылка заражённого — валюта Улья. В стабе на них покупают оружие и патроны.' },
	pearl: { name: 'Чёрная жемчужина', forms: ['жемчужина', 'жемчужины', 'жемчужин'], use: 'Съесть', desc: 'Редчайшая находка Улья — бывает в споровых мешках руберов и элиты. Знахари говорят, она развивает дар; иммунного делает крепче: съешь — здоровье навсегда +20. Торговец в стабе даёт за неё 150 споранов. Как и спораны с горохом, при гибели остаётся при тебе.' },
	peas: { name: 'Горох', forms: ['горошина', 'горошины', 'горошин'], desc: 'Горошины из споровых мешков топтунов и руберов. Торговец в стабе меняет каждую на 5 споранов.' },
};

/** Порядок предметов в рюкзаке. */
export const BAG_ORDER = ['ammo9', 'ammo919', 'ammo12', 'ammo545', 'ammo762', 'ammo76254', 'ammo939', 'grenade', 'zhivchik', 'pearl', 'spore', 'peas'];
/** Всё, что лежит в рюкзаке (при гибели пропадает, кроме валюты — см. stash.js). */
export const CONSUMABLES = BAG_ORDER;

/** «3 патрона», «5 споранов». */
export function plural(n, [one, few, many]) {
	const a = Math.abs(n) % 100, b = a % 10;
	return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}

const mat = (o) => new THREE.MeshStandardMaterial(o);

/** 3D-модель предмета (без свечения — его добавляет подбор на земле). Начало координат — у дна. */
export function makeItemMesh(kind) {
	const g = new THREE.Group();
	if (WEAPONS[kind]) {
		// оружие на земле: лежит плашмя (ось хвата +Z — вдоль земли)
		const w = WEAPONS[kind].make();
		w.rotation.set(0, 0, Math.PI / 2);
		w.rotateX(-(w.userData.tilt ?? 0));
		w.position.y = 0.04;
		g.add(w);
	} else if (kind === 'ammo12') {
		// пачка охотничьих патронов: красные гильзы с латунным донцем
		const card = mat({ color: 0x3a5a3a, roughness: 0.8 });
		const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.14), card);
		box.position.y = 0.04;
		const label = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), mat({ color: 0xd8c890, roughness: 0.8 }));
		label.position.set(0, 0.04, 0.071);
		const red = mat({ color: 0xa02a20, roughness: 0.45 }), brass = mat({ color: 0xc9a248, roughness: 0.3, metalness: 0.9 });
		const shell = new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10), base = new THREE.CylinderGeometry(0.019, 0.019, 0.016, 10);
		for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
			const x = -0.06 + i * 0.04, z = -0.025 + j * 0.045;
			const s = new THREE.Mesh(shell, red); s.position.set(x, 0.115, z);
			const b = new THREE.Mesh(base, brass); b.position.set(x, 0.088, z);
			g.add(s, b);
		}
		// пара патронов рядом, на боку
		for (const [x, z, r] of [[0.16, 0.04, 0.4], [0.15, -0.05, -0.3]]) {
			const s = new THREE.Mesh(shell, red); s.rotation.set(0, r, Math.PI / 2); s.position.set(x, 0.02, z);
			g.add(s);
		}
		g.add(box, label);
	} else if (kind === 'grenade') {
		const gr = makeGrenade();
		gr.scale.setScalar(1.8);
		gr.rotation.z = 1.2;
		gr.position.y = 0.06;
		g.add(gr);
	} else if (kind === 'ammo76254' || kind === 'ammo939') {
		// картонная пачка и патроны: винтовочные — длинные остроконечные, 9×39 — короткие с тяжёлой тупой пулей
		const long = kind === 'ammo76254';
		const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.12), mat({ color: long ? 0x9a8a62 : 0x5e6a58, roughness: 0.9 }));
		box.position.y = 0.03;
		const brass = mat({ color: long ? 0xb8923e : 0x7a7c74, roughness: 0.3, metalness: 0.9 }), tip = mat({ color: long ? 0x6a5030 : 0x2a2c2e, roughness: 0.4, metalness: 0.7 });
		for (let i = 0; i < 5; i++) {
			const c = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.008, long ? 0.055 : 0.04, 8), brass);
			c.rotation.z = Math.PI / 2; c.position.set(0, 0.07, -0.04 + i * 0.02);
			const b = new THREE.Mesh(new THREE.ConeGeometry(long ? 0.0065 : 0.0075, long ? 0.03 : 0.024, 8), tip);
			b.rotation.z = -Math.PI / 2; b.position.set(long ? 0.042 : 0.032, 0.07, -0.04 + i * 0.02);
			g.add(c, b);
		}
		g.add(box);
	} else if (kind === 'ammo545' || kind === 'ammo762') {
		// цинк-укупорка с патронами в пачках и снаряжённый рожок (у 7,62 — стальной и тёмный цинк)
		const zinc = mat(kind === 'ammo762' ? { color: 0x5a6650, roughness: 0.45, metalness: 0.6 } : { color: 0x8a9088, roughness: 0.35, metalness: 0.8 });
		const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.18), zinc);
		box.position.y = 0.05;
		const pack = mat({ color: 0xb8a878, roughness: 0.9 });
		for (let i = 0; i < 3; i++) {
			const p = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.14), pack);
			p.position.set(-0.085 + i * 0.085, 0.125, 0);
			g.add(p);
		}
		const magMat = kind === 'ammo762' ? mat({ color: 0x2e3032, roughness: 0.4, metalness: 0.6 }) : mat({ color: 0x6a3a22, roughness: 0.5 });
		const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.06), magMat);
		mag.position.set(0.2, 0.03, 0.02);
		mag.rotation.set(Math.PI / 2, 0.3, 0.25);
		g.add(box, mag);
	} else if (kind === 'ammo9' || kind === 'ammo919') {
		// открытая армейская коробка с патронами (9×19 — в серо-синей)
		const olive = mat(kind === 'ammo919' ? { color: 0x3e4a58, roughness: 0.5, metalness: 0.4 } : { color: 0x4d5a36, roughness: 0.55, metalness: 0.35 });
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
	} else if (kind === 'pearl') {
		// чёрная жемчужина: глубокий чёрный перламутр с фиолетовым отливом, в обрывке спорового мешка
		const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 18), mat({ color: 0x0c0a12, roughness: 0.05, metalness: 0.75, emissive: 0x1a1030, emissiveIntensity: 0.6 }));
		pearl.position.y = 0.075;
		const sac = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), mat({ color: 0x6a5a48, roughness: 0.7, side: THREE.DoubleSide }));
		sac.position.y = 0.09;
		g.add(pearl, sac);
	}
	g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
	return g;
}

/** Цвет свечения предмета на земле (r,g,b). */
export const GLOW = { ammo9: '255,220,120', ammo919: '200,220,255', ammo12: '255,190,120', ammo545: '230,230,150', ammo762: '220,230,170', ammo76254: '255,230,160', ammo939: '210,230,200', grenade: '255,200,120', weapon: '200,220,255', zhivchik: '255,120,120', spore: '170,255,120', peas: '200,255,140', pearl: '190,170,255' };
