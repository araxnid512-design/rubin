// Частицы одним мешем (THREE.Points): капли крови, крошка и пыль от пуль, пыль из-под ног, пороховой дымок, дымный
// след ракеты. Раньше каждая частица была отдельным спрайтом — отдельной командой видеокарте: при стрельбе по толпе
// и взрывах в кадре висели сотни таких команд (замер: 16 убитых бегунов — +550 вызовов отрисовки), на телефоне FPS
// проседал вдвое. Теперь все частицы — одна команда. Частица летит с гравитацией, растёт, гаснет к концу жизни;
// коснулась земли — land() (капля крови оставляет пятно) и исчезает.

import * as THREE from 'three';
import { softDotTexture } from './textures.js';

const tmp = new THREE.Color();
/** Цвет 'r,g,b' (sRGB, как у softDotTexture) → линейные компоненты для вершинных цветов. */
const colors = {};
export function rgb(s) {
	if (!colors[s]) { const [r, g, b] = s.split(',').map((x) => +x / 255); tmp.setRGB(r, g, b, THREE.SRGBColorSpace); colors[s] = [tmp.r, tmp.g, tmp.b]; }
	return colors[s];
}

/**
 * Пул частиц на max штук (старые вытесняются новыми). camera — для перевода размера частицы из метров в пиксели.
 * spawn(p): p = { x, y, z, vx, vy, vz, g (гравитация, м/с²), rise (подъём, м/с), size (м), grow (рост за секунду, доля),
 * life (с), alpha, color: [r, g, b] (линейные, см. rgb), fade: 'life' — гаснет всю жизнь, иначе — последние 30 %,
 * floor (высота земли), land(x, y, z, vx, vz) — коснулась земли }.
 */
export function createParticles(scene, camera, max = 900) {
	const geo = new THREE.BufferGeometry();
	const pos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
	const col = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
	const psz = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
	geo.setAttribute('position', pos);
	geo.setAttribute('color', col);
	geo.setAttribute('psize', psz);
	geo.setDrawRange(0, 0);
	const mat = new THREE.PointsMaterial({ map: softDotTexture('255,255,255'), vertexColors: true, transparent: true, depthWrite: false, size: 1, sizeAttenuation: true });
	// размер — свой у каждой частицы (атрибут psize)
	mat.onBeforeCompile = (sh) => {
		sh.vertexShader = sh.vertexShader.replace('uniform float size;', 'uniform float size;\nattribute float psize;').replace('gl_PointSize = size;', 'gl_PointSize = size * psize;');
	};
	mat.customProgramCacheKey = () => 'particles-psize';
	const points = new THREE.Points(geo, mat);
	points.frustumCulled = false;
	points.renderOrder = 2;
	points.name = 'Particles';
	scene.add(points);
	let list = [];
	const P = pos.array, C = col.array, S = psz.array;
	return {
		points,
		get count() { return list.length; },
		spawn(p) {
			if (list.length >= max) list.shift();
			p.life0 = p.life;
			p.vx ??= 0; p.vy ??= 0; p.vz ??= 0;
			list.push(p);
			return p;
		},
		update(dt) {
			// PointsMaterial: пиксели = size · (высота/2) / глубина — домножаем на 1/tan(fov/2), чтобы size был в метрах
			const k = camera.projectionMatrix.elements[5];
			let w = 0;
			for (let i = 0; i < list.length; i++) {
				const p = list[i];
				p.life -= dt;
				if (p.life <= 0) continue;
				if (p.g) p.vy -= p.g * dt;
				p.x += p.vx * dt; p.y += (p.vy + (p.rise ?? 0)) * dt; p.z += p.vz * dt;
				if (p.grow) p.size *= 1 + p.grow * dt;
				if (p.g && p.y < (p.floor ?? 0.05) && p.vy < 0) { p.land?.(p.x, p.y, p.z, p.vx, p.vz); continue; }
				const f = p.life / p.life0, a = (p.alpha ?? 1) * (p.fade === 'life' ? f : Math.min(1, f / 0.3));
				P[w * 3] = p.x; P[w * 3 + 1] = p.y; P[w * 3 + 2] = p.z;
				C[w * 4] = p.color[0]; C[w * 4 + 1] = p.color[1]; C[w * 4 + 2] = p.color[2]; C[w * 4 + 3] = a;
				S[w] = p.size * k;
				list[w++] = p;
			}
			list.length = w;
			geo.setDrawRange(0, w);
			if (w) { pos.needsUpdate = true; col.needsUpdate = true; psz.needsUpdate = true; }
			points.visible = w > 0;
		},
		/** Новая локация: частицы прошлой — долой. */
		clear() { list = []; geo.setDrawRange(0, 0); points.visible = false; },
	};
}

/**
 * Летящие куски одним мешем (InstancedMesh): ошмётки при расчленении, комья земли и обломки от взрыва. Летят дугой,
 * крутятся, падают и отскакивают, лежат, к концу жизни сжимаются. spawn(p): p = { x, y, z, vx, vy, vz, spin, scale,
 * life, bounce (доля скорости после удара о землю; 0 — сразу лежит), land(x, z, vx, vz) — первое касание земли }.
 */
export function createChunks(scene, geo, mat, max = 160) {
	const mesh = new THREE.InstancedMesh(geo, mat, max);
	mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	mesh.count = 0;
	mesh.frustumCulled = false;
	mesh.castShadow = true;
	scene.add(mesh);
	let list = [];
	const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
	return {
		mesh,
		spawn(p) {
			if (list.length >= max) list.shift();
			p.rx = Math.random() * 6; p.ry = Math.random() * 6; p.rz = 0;
			p.sx = (Math.random() - 0.5) * (p.spin ?? 12); p.sy = (Math.random() - 0.5) * (p.spin ?? 12);
			p.moving = true;
			list.push(p);
		},
		update(dt) {
			let w = 0;
			for (const p of list) {
				p.life -= dt;
				if (p.life <= 0) continue;
				if (p.moving) {
					p.vy -= (p.g ?? 18) * dt;
					p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
					p.rx += p.sx * dt; p.ry += p.sy * dt;
					const floor = p.floor ?? 0.04;
					if (p.y < floor) {
						p.y = floor;
						if (!p.landed) { p.landed = true; p.land?.(p.x, p.z, p.vx, p.vz); }
						const b = p.bounce ?? 0.3;
						p.vy *= -b; p.vx *= 0.5; p.vz *= 0.5; p.sx *= 0.5; p.sy *= 0.5;
						if (!b || Math.abs(p.vy) < 0.6) p.moving = false;
					}
				}
				const k = p.life < 0.8 ? p.life / 0.8 : 1; // к концу жизни сжимается
				m.compose(v.set(p.x, p.y, p.z), q.setFromEuler(e.set(p.rx, p.ry, p.rz)), s.setScalar(p.scale * k));
				mesh.setMatrixAt(w, m);
				list[w++] = p;
			}
			list.length = w;
			mesh.count = w;
			if (w) mesh.instanceMatrix.needsUpdate = true;
			mesh.visible = w > 0;
		},
		clear() { list = []; mesh.count = 0; mesh.visible = false; },
	};
}
