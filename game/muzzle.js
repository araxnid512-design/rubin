// Дульная вспышка: язык пламени вдоль ствола (две скрещённые плоскости — сверху видно, куда бьёт выстрел)
// и звезда лучами лицом к камере, каждый раз своей длины и поворота. Вспышка крепится к оружию у дула —
// при отдаче уходит вверх вместе со стволом. Вспышек несколько (стреляют герой и наёмники разом) — берутся
// по кругу; источник света у них один общий, он в main.js.

import * as THREE from 'three';

function canvas(w, h) {
	const c = document.createElement('canvas');
	c.width = w; c.height = h;
	return c;
}
function texture(c) {
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

/** Язык пламени: из левого края вправо — яркое ядро и рваные зубцы, к концу краснеет и тает. */
function flameTexture() {
	const c = canvas(256, 64), ctx = c.getContext('2d');
	ctx.globalCompositeOperation = 'lighter';
	const spike = (len, w, y, alpha) => {
		const g = ctx.createLinearGradient(0, 0, len, 0);
		g.addColorStop(0, `rgba(255,250,220,${alpha})`);
		g.addColorStop(0.35, `rgba(255,190,90,${alpha * 0.8})`);
		g.addColorStop(1, 'rgba(200,60,10,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(0, 32 - w); ctx.quadraticCurveTo(len * 0.45, y - w * 0.6, len, y); ctx.quadraticCurveTo(len * 0.45, y + w * 0.6, 0, 32 + w);
		ctx.fill();
	};
	spike(250, 14, 32, 0.9);
	for (const [len, w, y] of [[170, 10, 18], [190, 10, 46], [120, 8, 8], [130, 8, 56], [210, 6, 26], [200, 6, 39]]) spike(len, w, y, 0.55);
	const core = ctx.createRadialGradient(18, 32, 0, 18, 32, 34);
	core.addColorStop(0, 'rgba(255,255,240,1)'); core.addColorStop(0.5, 'rgba(255,220,140,0.6)'); core.addColorStop(1, 'rgba(255,150,60,0)');
	ctx.fillStyle = core;
	ctx.fillRect(0, 0, 64, 64);
	return texture(c);
}

/** Звезда: белое ядро и тонкие лучи разной длины. */
function starTexture() {
	const c = canvas(128, 128), ctx = c.getContext('2d');
	ctx.globalCompositeOperation = 'lighter';
	ctx.translate(64, 64);
	const rays = [62, 40, 55, 34, 60, 44, 50, 36];
	rays.forEach((len, i) => {
		ctx.save();
		ctx.rotate((i / rays.length) * Math.PI * 2 + (i % 2) * 0.2);
		const g = ctx.createLinearGradient(0, 0, len, 0);
		g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(1, 'rgba(255,140,40,0)');
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(len, 0); ctx.lineTo(0, 5); ctx.fill();
		ctx.restore();
	});
	const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
	core.addColorStop(0, 'rgba(255,255,245,1)'); core.addColorStop(0.45, 'rgba(255,210,130,0.7)'); core.addColorStop(1, 'rgba(255,150,60,0)');
	ctx.fillStyle = core;
	ctx.fillRect(-64, -64, 128, 128);
	return texture(c);
}

const X = new THREE.Vector3(1, 0, 0), BARREL = new THREE.Vector3(0, -1, 0); // ствол оружия смотрит по −Y
const LIFE = 0.05;
const tmp = new THREE.Vector3();

export function createMuzzleFlashes(count = 6) {
	const flameMat = { map: flameTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false };
	const star = starTexture();
	const geo = new THREE.PlaneGeometry(1, 0.34);
	geo.translate(0.5, 0, 0); // от дула вперёд
	const pool = [];
	for (let i = 0; i < count; i++) {
		// ярче белого: на высоком качестве светится через bloom, на среднем — просто насыщенно-жёлтая
		const mat = new THREE.MeshBasicMaterial({ ...flameMat, color: new THREE.Color(1.4, 1.15, 0.85) });
		const g = new THREE.Group();
		const a = new THREE.Mesh(geo, mat), b = new THREE.Mesh(geo, mat);
		b.rotation.x = Math.PI / 2;
		g.add(a, b);
		const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, color: new THREE.Color(1.3, 1.1, 0.9) }));
		g.visible = s.visible = false;
		g.renderOrder = s.renderOrder = 5;
		pool.push({ g, s, mat, life: 0 });
	}
	let next = 0;
	return {
		/** Вспышка у дула оружия gun (userData.muzzle), size: 1 — автомат, 0 — нет вспышки (глушитель). */
		fire(gun, size = 1) {
			if (size <= 0) return;
			const f = pool[next];
			next = (next + 1) % pool.length;
			const muzzle = gun.userData.muzzle, k = size / gun.getWorldScale(tmp).x; // размеры — в метрах мира
			gun.add(f.g, f.s);
			f.g.position.copy(muzzle);
			f.g.quaternion.setFromUnitVectors(X, BARREL);
			f.g.rotateX(Math.random() * Math.PI);
			const len = (0.5 + Math.random() * 0.3) * k, w = k * (0.6 + Math.random() * 0.35);
			f.g.scale.set(len, w, w);
			f.s.position.copy(muzzle).addScaledVector(BARREL, 0.03 * k);
			f.s.scale.setScalar(0.22 * k * (0.8 + Math.random() * 0.4));
			f.s.material.rotation = Math.random() * Math.PI * 2;
			f.mat.opacity = f.s.material.opacity = 1;
			f.life = LIFE;
			f.g.visible = f.s.visible = true;
		},
		update(dt) {
			for (const f of pool) {
				if (f.life <= 0) continue;
				f.life -= dt;
				if (f.life <= 0) { f.g.visible = f.s.visible = false; continue; }
				f.mat.opacity = f.s.material.opacity = Math.min(1, (f.life / LIFE) * 1.6);
			}
		},
	};
}
