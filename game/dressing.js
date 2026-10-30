// Разруха: то, что делает кластер мёртвым и обжитым одновременно. Огонь в бочках и на остовах машин —
// языки пламени, мерцающий свет, столб дыма и искры; сажа, масляные пятна и подтёки на асфальте; мусор,
// газеты и битый кирпич у стен. Всё мелкое сливается в общий меш (один вызов отрисовки на материал),
// источников света — не больше, чем позволяет качество графики.

import * as THREE from 'three';
import { place } from './geom.js';

function canvas(w, h = w) {
	const c = document.createElement('canvas');
	c.width = w; c.height = h;
	return c;
}
function texture(c) {
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
const memo = new Map();
const once = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key); };

/** Язык пламени: снизу белое ядро, выше — жёлтое и оранжевое, верх рваный и прозрачный. */
const flameTexture = () => once('flame', () => {
	const c = canvas(64, 128), ctx = c.getContext('2d');
	ctx.globalCompositeOperation = 'lighter';
	const tongue = (x, w, top, a) => {
		const g = ctx.createLinearGradient(0, 124, 0, top);
		g.addColorStop(0, `rgba(255,240,200,${a})`); g.addColorStop(0.3, `rgba(255,180,70,${a * 0.9})`);
		g.addColorStop(0.7, `rgba(230,80,20,${a * 0.6})`); g.addColorStop(1, 'rgba(160,30,10,0)');
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.moveTo(x - w, 124); ctx.quadraticCurveTo(x - w * 1.1, 70, x, top); ctx.quadraticCurveTo(x + w * 1.1, 70, x + w, 124); ctx.fill();
	};
	tongue(32, 22, 8, 0.85); tongue(20, 12, 40, 0.6); tongue(44, 12, 34, 0.6);
	return texture(c);
});

/** Дым: рыхлое серое облачко с неровным краем. */
const smokeTexture = () => once('smoke', () => {
	const c = canvas(64), ctx = c.getContext('2d');
	for (let i = 0; i < 9; i++) {
		const x = 18 + Math.random() * 28, y = 18 + Math.random() * 28, r = 10 + Math.random() * 14;
		const g = ctx.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, 'rgba(34,32,30,0.6)'); g.addColorStop(1, 'rgba(34,32,30,0)');
		ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
	}
	return texture(c);
});

/** Мягкое пятно (отсвет огня на земле, искра). */
const dotTexture = () => once('dot', () => {
	const c = canvas(64), ctx = c.getContext('2d');
	const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
	g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
	return texture(c);
});

/** Сажа, масло, подтёки: тёмные пятна с рваным мягким краем (4 варианта в одной текстуре 2×2). */
export const grimeTexture = () => once('grime', () => {
	const c = canvas(256), ctx = c.getContext('2d');
	for (let q = 0; q < 4; q++) {
		const ox = (q % 2) * 128, oy = Math.floor(q / 2) * 128;
		for (let i = 0; i < 26; i++) {
			const x = ox + 64 + (Math.random() - 0.5) * (q === 3 ? 90 : 60), y = oy + 64 + (Math.random() - 0.5) * (q === 3 ? 30 : 60), r = 6 + Math.random() * 22;
			const g = ctx.createRadialGradient(x, y, 0, x, y, r);
			const tone = q === 1 ? '24,22,26' : q === 2 ? '40,30,20' : '20,19,17'; // масло отливает, ржавчина — бурая
			g.addColorStop(0, `rgba(${tone},${0.35 + Math.random() * 0.3})`); g.addColorStop(1, `rgba(${tone},0)`);
			ctx.fillStyle = g; ctx.fillRect(ox, oy, 128, 128);
		}
	}
	const t = texture(c);
	t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
	return t;
});

/** Газеты и бумага: светлый лист с колонками строк (4 варианта в одной текстуре 2×2). */
export const paperTexture = () => once('paper', () => {
	const c = canvas(128), ctx = c.getContext('2d');
	for (let q = 0; q < 4; q++) {
		const ox = (q % 2) * 64, oy = Math.floor(q / 2) * 64;
		const tone = 170 + Math.random() * 50;
		ctx.fillStyle = `rgb(${tone},${tone * 0.96},${tone * 0.86})`;
		ctx.fillRect(ox + 2, oy + 2, 60, 60);
		ctx.fillStyle = 'rgba(40,36,30,0.55)';
		if (q < 3) for (let col = 0; col < 3; col++) for (let ln = 0; ln < 11; ln++) ctx.fillRect(ox + 6 + col * 19, oy + 8 + ln * 4.6, 15 - Math.random() * 5, 1.6);
		else { ctx.fillStyle = 'rgba(120,92,60,0.9)'; ctx.fillRect(ox + 2, oy + 2, 60, 60); } // картон
		ctx.fillStyle = 'rgba(60,50,40,0.25)';
		ctx.fillRect(ox + 2 + Math.random() * 30, oy + 2, 2, 60); // сгиб
	}
	return texture(c);
});

/** Бочка с горючим: красная краска в потёках, жёлтая полоса, знак огня и надпись. */
const fuelTexture = () => once('fuel', () => {
	const c = canvas(256, 128), ctx = c.getContext('2d');
	ctx.fillStyle = '#8e1f16'; ctx.fillRect(0, 0, 256, 128);
	for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(${40 + Math.random() * 40},${20 + Math.random() * 20},10,${Math.random() * 0.35})`; ctx.fillRect(Math.random() * 256, Math.random() * 128, 2 + Math.random() * 10, 1 + Math.random() * 14); }
	ctx.fillStyle = '#c9a222'; ctx.fillRect(0, 50, 256, 22);
	for (let k = 0; k < 2; k++) {
		const x = 64 + k * 128;
		ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.moveTo(x, 53); ctx.lineTo(x + 9, 69); ctx.lineTo(x - 9, 69); ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#c9a222'; ctx.beginPath(); ctx.arc(x, 64, 3, 0, Math.PI * 2); ctx.fill();
	}
	ctx.fillStyle = '#e8d8b0'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
	ctx.fillText('ОГНЕОПАСНО', 128, 40); ctx.fillText('ОГНЕОПАСНО', 0, 98); ctx.fillText('ОГНЕОПАСНО', 256, 98);
	for (const y of [6, 122]) { ctx.fillStyle = 'rgba(30,20,15,0.6)'; ctx.fillRect(0, y - 3, 256, 6); } // рёбра жёсткости
	return texture(c);
});

/** UV одного варианта текстуры 2×2. */
export function quadUV(geo, q) {
	const uv = geo.attributes.uv, ox = (q % 2) * 0.5, oy = 0.5 - Math.floor(q / 2) * 0.5;
	for (let i = 0; i < uv.count; i++) uv.setXY(i, ox + uv.getX(i) * 0.5, oy + uv.getY(i) * 0.5);
	return geo;
}

/**
 * Огонь: в бочке, на остове машины или костёр. size — 1 для бочки; light — свой источник света
 * (иначе только отсвет на земле). Возвращает { update(dt, t) }.
 */
export function createFire(root, x, y, z, { size = 1, light = true, smoke = true, tongues: n = 3 } = {}) {
	const group = new THREE.Group();
	group.position.set(x, y, z);
	root.add(group);
	const flameMat = new THREE.SpriteMaterial({ map: flameTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, color: new THREE.Color(1.5, 1.2, 1.0) });
	const tongues = [];
	for (let i = 0; i < n; i++) {
		const s = new THREE.Sprite(flameMat.clone());
		s.center.set(0.5, 0.05);
		const a = (i / n) * Math.PI * 2 + 0.5, r = (n > 3 ? 0.32 : 0.14) * size * (i ? 1 : 0);
		s.userData = { ox: Math.cos(a) * r, oz: Math.sin(a) * r, ph: Math.random() * 10, h: (i ? 0.6 : 0.95) * size };
		group.add(s);
		tongues.push(s);
	}
	// жар у основания пламени: светится сквозь bloom
	const heat = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(1.4, 0.6, 0.2), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
	heat.position.y = 0.25 * size;
	heat.scale.setScalar(1.6 * size);
	group.add(heat);
	// отсвет на земле — работает и без источника света (на слабом телефоне)
	const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dotTexture(), color: 0xff8a3a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
	pool.position.y = 0.04 - y;
	pool.scale.setScalar(4.5 * size);
	group.add(pool);
	const lamp = light ? new THREE.PointLight(0xff8a40, 8 * size, 9 * size, 1.6) : null;
	if (lamp) { lamp.position.y = 0.9 * size; group.add(lamp); }
	// дым и искры — по кругу из небольшого запаса
	const puffs = [], sparks = [];
	if (smoke) {
		const smokeMat = new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, opacity: 0 });
		for (let i = 0; i < 6; i++) {
			const s = new THREE.Sprite(smokeMat.clone());
			s.userData.t = i / 6;
			group.add(s);
			puffs.push(s);
		}
	}
	// искры — одним облаком точек (один вызов отрисовки)
	const sparkPos = new Float32Array(10 * 3);
	const sparkGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
	const sparkCloud = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: dotTexture(), color: new THREE.Color(1.8, 0.9, 0.3), size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
	sparkCloud.frustumCulled = false;
	group.add(sparkCloud);
	for (let i = 0; i < 10; i++) sparks.push({ t: Math.random(), vx: 0, vz: 0 });
	return {
		group,
		update(dt, t) {
			let glow = 0;
			for (const s of tongues) {
				// мерцание — сумма трёх синусов: язык то вытягивается, то оседает
				const u = s.userData, f = 0.75 + Math.sin(t * 11 + u.ph) * 0.12 + Math.sin(t * 23.7 + u.ph * 2) * 0.08 + Math.sin(t * 5.3 + u.ph) * 0.07;
				s.scale.set(u.h * 0.62 * (1.1 - f * 0.25), u.h * f * 1.25, 1);
				s.position.set(u.ox + Math.sin(t * 3 + u.ph) * 0.03, 0, u.oz);
				s.material.opacity = 0.75 + f * 0.25;
				glow += f;
			}
			glow /= tongues.length;
			if (lamp) lamp.intensity = 8 * size * (0.7 + glow * 0.45);
			pool.material.opacity = 0.32 + glow * 0.18;
			heat.material.opacity = 0.35 + glow * 0.25;
			for (const s of puffs) {
				const u = s.userData;
				u.t = (u.t + dt / 4.5) % 1; // клуб поднимается метров на шесть за 4,5 с
				const k = u.t;
				s.position.set(Math.sin(k * 5 + t * 0.3) * 0.25 + k * 1.6, 0.8 * size + k * 6 * size, k * 0.7);
				s.scale.setScalar((0.6 + k * 3) * size);
				s.material.opacity = Math.sin(Math.PI * k) ** 0.7 * 0.55;
				s.material.rotation = k * 1.5;
			}
			sparks.forEach((u, i) => {
				u.t += dt / 1.4;
				if (u.t >= 1) { u.t = 0; u.vx = (Math.random() - 0.5) * 0.8; u.vz = (Math.random() - 0.5) * 0.8; }
				// гаснущая искра уходит вниз под землю — так у облака одна прозрачность на всех
				const alive = Math.sin(t * 30 + i * 7) > -0.7 && u.t < 0.85;
				sparkPos.set([u.vx * u.t * 1.5, alive ? 0.4 * size + u.t * 2.6 * size : -5, u.vz * u.t * 1.5], i * 3);
			});
			sparkGeo.attributes.position.needsUpdate = true;
		},
	};
}

/**
 * Разруха по локации: огонь (spec.fires — [[x, z, вид, высота], …], вид: barrel | car | ground), пятна сажи и масла,
 * мусор и газеты, битый кирпич у стен. free(x, z, m) — свободно ли место (не стена, не в доме, не у выхода).
 * Возвращает { update(dt, t) } — анимация огня.
 */
export function dressLevel({ root, batch, M, rnd, R, free, nearWall, collide, spec, quality }) {
	const fires = [];
	// источников света — по качеству: каждый стоит прохода по всем освещённым объектам
	let lights = quality === 'high' ? 3 : quality === 'medium' ? 2 : 0;
	for (let [x, z, kind = 'barrel', top] of spec.fires ?? []) {
		const size = kind === 'car' ? 1.7 : kind === 'ground' ? 1.15 : 1;
		if (kind !== 'car') {
			// бочку или костёр — на свободное место рядом с заданным
			for (let k = 0; k < 12 && !free(x, z, 0.7); k++) { x += R(-1.5, 1.5); z += R(-1.5, 1.5); }
			collide(x, z, 0.8, 0.8);
		}
		if (kind === 'barrel') batch.add(place(new THREE.CylinderGeometry(0.33, 0.3, 0.9, 12, 1, true), x, 0.45, z), M.metalRust);
		if (kind === 'ground') for (let i = 0; i < 6; i++) batch.add(place(new THREE.BoxGeometry(0.9, 0.12, 0.14), x, 0.08, z, (i / 6) * Math.PI), M.bark);
		// пламя машины — над крышей (top — своя высота, у БТР выше)
		fires.push(createFire(root, x, top ?? (kind === 'barrel' ? 0.85 : kind === 'car' ? 1.25 : 0.1), z, { size, light: lights-- > 0, tongues: kind === 'car' ? 6 : 3 }));
	}

	// пятна сажи, масла и ржавчины — на земле, одним мешем
	const grimeMat = new THREE.MeshStandardMaterial({ map: grimeTexture(), transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
	for (let i = 0; i < (spec.grime ?? 46); i++) {
		const x = R(-45, 45), z = R(-45, 45);
		if (!free(x, z, 0.5)) continue;
		const s = R(1.2, 3.6), g = quadUV(new THREE.PlaneGeometry(s, s * R(0.6, 1)).rotateX(-Math.PI / 2), Math.floor(rnd() * 4));
		batch.add(place(g, x, 0.022 + rnd() * 0.004, z, R(0, Math.PI * 2)), grimeMat, { cast: false });
	}
	// мусор: газеты, картон, пакеты — вокруг мусорных точек и вдоль стен
	const paperMat = new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: 0.95, side: THREE.DoubleSide });
	const litter = (x, z) => {
		const s = R(0.22, 0.42), g = quadUV(new THREE.PlaneGeometry(s, s * R(0.7, 1.3)).rotateX(-Math.PI / 2), Math.floor(rnd() * 4));
		g.rotateX(R(-0.12, 0.12)); // лист лежит неровно
		batch.add(place(g, x, 0.035 + rnd() * 0.01, z, R(0, Math.PI * 2)), paperMat, { cast: false });
	};
	for (let i = 0; i < (spec.litter ?? 26); i++) {
		const x = R(-44, 44), z = R(-44, 44);
		if (!free(x, z, 0.4)) continue;
		for (let k = 0; k < 2 + rnd() * 4; k++) litter(x + R(-1.4, 1.4), z + R(-1.4, 1.4));
	}
	// битый кирпич и куски бетона у стен
	for (let i = 0; i < (spec.rubble ?? 60) && quality !== 'low'; i++) {
		const x = R(-44, 44), z = R(-44, 44);
		if (!free(x, z, 0.3) || !nearWall(x, z)) continue;
		for (let k = 0; k < 3 + rnd() * 5; k++) {
			const s = R(0.08, 0.22);
			batch.add(place(new THREE.BoxGeometry(s * 1.6, s * 0.7, s), x + R(-0.7, 0.7), s * 0.3, z + R(-0.7, 0.7), R(0, 3.1), R(-0.3, 0.3), R(-0.3, 0.3)), rnd() < 0.6 ? M.brick : M.concreteDark);
		}
		if (rnd() < 0.5) litter(x + R(-0.8, 0.8), z + R(-0.8, 0.8));
	}
	// бочки с горючим: от пули или взрыва рвутся (game/main.js); ставим на просторе, чтобы не перегородить проход
	const barrels = [];
	const fuelMat = new THREE.MeshStandardMaterial({ map: fuelTexture(), roughness: 0.55, metalness: 0.35 });
	const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.88, 14);
	for (let i = 0, tries = 0; i < (spec.barrels ?? 5) && tries < 200; tries++) {
		const x = R(-42, 42), z = R(-42, 42);
		if (!free(x, z, 1.3)) continue;
		const mesh = new THREE.Mesh(barrelGeo, fuelMat);
		mesh.position.set(x, 0.44, z);
		mesh.rotation.y = R(0, Math.PI * 2);
		mesh.castShadow = true;
		root.add(mesh);
		barrels.push({ pos: new THREE.Vector3(x, 0, z), mesh, collider: collide(x, z, 0.62, 0.62) });
		i++;
	}
	return {
		fires,
		barrels,
		update(dt, t) { for (const f of fires) f.update(dt, t); },
	};
}
