// Предметы кластера: описания для инвентаря и 3D-модели — одни и те же для подбора на земле
// и для иконок (иконки рендерятся из этих моделей, см. icons.js).

import * as THREE from 'three';
import { WEAPONS, makeGrenade } from './weapons.js';

const ROUNDS = ['патрон', 'патрона', 'патронов'];
export const ITEMS = {
	...Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, { name: w.name, type: 'weapon', desc: w.desc }])),
	ammo919: { name: 'Патроны 9×19', type: 'ammo', forms: ROUNDS, desc: 'Пистолетные патроны парабеллум — к Glock 17 и MP5. Лежат в домах: в шкафах, комодах, сундуках.' },
	ammo50: { name: 'Патроны .50 AE', type: 'ammo', forms: ROUNDS, desc: 'Тяжёлые пистолетные патроны к Desert Eagle. Редкие — у торговца в стабе или в сейфах.' },
	ammo12: { name: 'Патроны 12 кал.', type: 'ammo', forms: ROUNDS, desc: 'Охотничьи патроны с картечью к двустволке и SPAS-12. Чаще всего — у дачников и сторожей.' },
	ammo545: { name: 'Патроны 5,45×39', type: 'ammo', forms: ROUNDS, desc: 'Автоматные патроны к АКС-74У, АК-74 и АК-107. В кластерах редки — проще купить в стабе.' },
	ammo556: { name: 'Патроны 5,56×45', type: 'ammo', forms: ROUNDS, desc: 'Автоматные патроны НАТО к G36 и Steyr AUG. Продаёт торговец в стабе, изредка — у военных.' },
	ammo762: { name: 'Патроны 7,62×39', type: 'ammo', forms: ROUNDS, desc: 'Автоматные патроны к АК-47 и РПК: тяжёлая пуля, сильная отдача.' },
	ammo76251: { name: 'Патроны 7,62×51', type: 'ammo', forms: ROUNDS, desc: 'Винтовочные патроны НАТО к FN FAL и Arctic Warfare. Дорогие и редкие.' },
	ammo76254: { name: 'Патроны 7,62×54R', type: 'ammo', forms: ROUNDS, desc: 'Винтовочные патроны к СВД. Дорогие — каждый выстрел должен попасть.' },
	ammo127: { name: 'Патроны 12,7×108', type: 'ammo', forms: ROUNDS, desc: 'Крупнокалиберные бронебойные патроны к КСВК: пуля прошивает заражённого насквозь. Бывают на военных складах — аэродром, военная часть.' },
	vog25: { name: 'Выстрелы ВОГ-25', type: 'ammo', forms: ['выстрел', 'выстрела', 'выстрелов'], desc: 'Осколочные гранаты 40 мм к РГ-6: летят навесом, разрыв 3,5 м. В глубине Улья — в оружейках и на складах.' },
	rocket: { name: 'Выстрелы ПГ-7В', type: 'ammo', forms: ['выстрел', 'выстрела', 'выстрелов'], desc: 'Реактивные гранаты к РПГ-7: рвутся у первой цели, разрыв 5 м. Тяжёлые и дорогие — на складах вооружения в Чёрной зоне или у торговца.' },
	grenade: { name: 'Граната Ф-1', forms: ['граната', 'гранаты', 'гранат'], use: 'Бросить', desc: 'Оборонительная граната: бросок к ближайшим заражённым, взрыв через 2 секунды, разлёт осколков до 6 м — не стой рядом. Кнопка гранаты или G.' },
	medkit: { name: 'Аптечка', forms: ['аптечка', 'аптечки', 'аптечек'], use: 'Перевязать', desc: 'Бинты, жгут и обезболивающее: восстанавливает 45 здоровья. Кнопка аптечки или H. Лежит в аптечных шкафчиках и у врачей, продаёт торговец.' },
	zhivchik: { name: 'Живчик', forms: ['живчик', 'живчика', 'живчиков'], desc: 'Напиток из споранов. Без него иммунному не пройти по Улью: каждый переход между кластерами на дороге — живчик, дальний путь — несколько. Продаёт торговец, варят знахарь и медпункт базы. Как спораны и жемчуг, при гибели остаётся при тебе.' },
	spore: { name: 'Споран', forms: ['споран', 'спорана', 'споранов'], desc: 'Споровый мешок из затылка заражённого — валюта Улья. В стабе на них покупают оружие и патроны.' },
	pearl: { name: 'Чёрная жемчужина', forms: ['жемчужина', 'жемчужины', 'жемчужин'], use: 'Съесть', desc: 'Редчайшая находка Улья — бывает в споровых мешках руберов и элиты. Знахари говорят, она развивает дар; иммунного делает крепче: съешь — здоровье навсегда +20. Торговец в стабе даёт за неё 150 споранов. Как и спораны с горохом, при гибели остаётся при тебе.' },
	peas: { name: 'Горох', forms: ['горошина', 'горошины', 'горошин'], desc: 'Горошины из споровых мешков топтунов и руберов. Торговец в стабе меняет каждую на 5 споранов.' },
};

/** Порядок предметов в рюкзаке. */
export const BAG_ORDER = ['ammo919', 'ammo50', 'ammo12', 'ammo545', 'ammo556', 'ammo762', 'ammo76251', 'ammo76254', 'ammo127', 'vog25', 'rocket', 'grenade', 'medkit', 'zhivchik', 'pearl', 'spore', 'peas'];
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
	} else if (kind === 'ammo76254' || kind === 'ammo76251') {
		// картонная пачка и винтовочные патроны — длинные остроконечные (7,62×54R и 7,62×51)
		const long = true;
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
	} else if (kind === 'ammo545' || kind === 'ammo762' || kind === 'ammo556') {
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
	} else if (kind === 'ammo50' || kind === 'ammo919') {
		// открытая армейская коробка с патронами (9×19 — в серо-синей, .50 AE — в коричневой)
		const olive = mat(kind === 'ammo919' ? { color: 0x3e4a58, roughness: 0.5, metalness: 0.4 } : { color: 0x5a4a36, roughness: 0.5, metalness: 0.4 });
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
	} else if (kind === 'rocket') {
		// выстрел ПГ-7В на боку: зелёная граната с конусом, хвостовик и бумажный пороховой заряд
		const olive = mat({ color: 0x55663a, roughness: 0.55, metalness: 0.2 }), paper = mat({ color: 0xb8a878, roughness: 0.9 });
		const along = (geo, m, x) => { const o = new THREE.Mesh(geo, m); o.rotation.z = Math.PI / 2; o.position.set(x, 0.06, 0); g.add(o); };
		along(new THREE.CylinderGeometry(0.057, 0.057, 0.09, 14), olive, 0.06);
		along(new THREE.CylinderGeometry(0.008, 0.057, 0.13, 14), olive, 0.17);
		along(new THREE.CylinderGeometry(0.024, 0.04, 0.04, 10), olive, -0.005);
		along(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), olive, -0.075);
		along(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 10), paper, -0.2);
	} else if (kind === 'vog25') {
		// ящичек с шестью ВОГ-25: тёмные цилиндры с медным пояском, донцем вверх
		const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.14), mat({ color: 0x4a5236, roughness: 0.8 }));
		box.position.y = 0.03;
		g.add(box);
		const body = mat({ color: 0x3a3e30, roughness: 0.5, metalness: 0.5 }), band = mat({ color: 0xb87a3e, roughness: 0.3, metalness: 0.9 });
		for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
			const x = -0.06 + i * 0.06, z = -0.032 + j * 0.064;
			const c = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.06, 10), body); c.position.set(x, 0.09, z);
			const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0275, 0.0275, 0.01, 10), band); b.position.set(x, 0.1, z);
			const d = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), body); d.position.set(x, 0.12, z);
			g.add(c, b, d);
		}
	} else if (kind === 'ammo127') {
		// цинк и крупнокалиберные патроны 12,7×108 с чёрными бронебойными пулями
		const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.16), mat({ color: 0x5a6650, roughness: 0.45, metalness: 0.6 }));
		box.position.y = 0.04;
		g.add(box);
		const brass = mat({ color: 0xc9a248, roughness: 0.3, metalness: 0.9 }), tip = mat({ color: 0x18191a, roughness: 0.4, metalness: 0.7 });
		for (let i = 0; i < 5; i++) {
			const c = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.11, 8), brass);
			c.rotation.z = Math.PI / 2; c.position.set(-0.01, 0.094, -0.06 + i * 0.03);
			const b = new THREE.Mesh(new THREE.ConeGeometry(0.0105, 0.05, 8), tip);
			b.rotation.z = -Math.PI / 2; b.position.set(0.07, 0.094, -0.06 + i * 0.03);
			g.add(c, b);
		}
	} else if (kind === 'medkit') {
		// аптечка: оливковая сумка-коробка с красным крестом и ремешком
		const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.18), mat({ color: 0x5a6a46, roughness: 0.85 }));
		box.position.y = 0.06;
		const red = mat({ color: 0xc83030, roughness: 0.6 });
		const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.006, 0.03), red); c1.position.set(0, 0.124, 0);
		const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.1), red); c2.position.set(0, 0.124, 0);
		const strap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.03), mat({ color: 0x2a2420, roughness: 0.8 }));
		strap.position.set(0, 0.125, -0.06);
		g.add(box, c1, c2, strap);
	} else if (kind === 'zhivchik') {
		// живчик: мутно-зелёный напиток из споранов в бутылке с пробкой
		const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 14), mat({ color: 0x5a9a4a, roughness: 0.1, transparent: true, opacity: 0.88, emissive: 0x1a4a18 }));
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
	} else if (kind === 'tag') {
		// жетон пропавшего: стальная пластинка на цепочке
		const steel = mat({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.85 });
		const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.05), steel);
		plate.position.y = 0.01;
		const chain = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.004, 4, 16), steel);
		chain.rotation.x = Math.PI / 2; chain.position.set(-0.05, 0.005, 0);
		g.add(plate, chain);
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
export const GLOW = { ammo919: '200,220,255', ammo50: '255,220,120', ammo12: '255,190,120', ammo545: '230,230,150', ammo556: '200,240,200', ammo762: '220,230,170', ammo76251: '240,220,180', ammo76254: '255,230,160', ammo127: '255,210,140', vog25: '220,240,160', rocket: '255,180,110', grenade: '255,200,120', weapon: '200,220,255', medkit: '255,140,140', zhivchik: '170,255,180', spore: '170,255,120', peas: '200,255,140', pearl: '190,170,255', tag: '255,240,200' };
