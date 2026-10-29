// Атмосфера Улья: в воздухе плывут светящиеся споры. Перед перезагрузкой кластера их становится больше,
// и они желтеют. Облако спор следует за камерой, поэтому их немного, но они видны везде.

import * as THREE from 'three';
import { softDotTexture } from './textures.js';

export function createSpores(scene, { count = 260 } = {}) {
	const pos = new Float32Array(count * 3);
	const vel = new Float32Array(count * 3);
	const rnd = (a, b) => a + Math.random() * (b - a);
	for (let i = 0; i < count; i++) {
		pos.set([rnd(-22, 22), rnd(0.3, 4.5), rnd(-18, 18)], i * 3);
		vel.set([rnd(-0.12, 0.12), rnd(-0.04, 0.06), rnd(-0.1, 0.1)], i * 3);
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	const mat = new THREE.PointsMaterial({
		size: 0.11, map: softDotTexture('235,255,190'), color: 0xd0eaa0, transparent: true, opacity: 0.5,
		depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
	});
	const points = new THREE.Points(geo, mat);
	points.frustumCulled = false;
	scene.add(points);
	const normal = new THREE.Color(0xd0eaa0), sour = new THREE.Color(0xf0e070);
	let base = 1;
	return {
		/** Сколько спор видно (0..1): в стабе их меньше. */
		set density(k) { base = k; geo.setDrawRange(0, Math.round(count * k)); },
		/** center — точка, вокруг которой облако (герой); sourK — близость перезагрузки (0..1). */
		update(dt, center, t, sourK = 0) {
			const W = 22, D = 18;
			for (let i = 0; i < count; i++) {
				const j = i * 3;
				pos[j] += (vel[j] + Math.sin(t * 0.7 + i) * 0.05) * dt;
				pos[j + 1] += (vel[j + 1] + Math.sin(t * 1.3 + i * 1.7) * 0.04) * dt;
				pos[j + 2] += (vel[j + 2] + Math.cos(t * 0.6 + i * 0.5) * 0.05) * dt;
				// облако вокруг героя: что вышло за край — появляется с другой стороны
				const dx = pos[j] - center.x, dz = pos[j + 2] - center.z;
				if (dx > W) pos[j] -= 2 * W; else if (dx < -W) pos[j] += 2 * W;
				if (dz > D) pos[j + 2] -= 2 * D; else if (dz < -D) pos[j + 2] += 2 * D;
				if (pos[j + 1] < 0.2) pos[j + 1] = 4.5; else if (pos[j + 1] > 4.8) pos[j + 1] = 0.3;
			}
			geo.attributes.position.needsUpdate = true;
			mat.opacity = 0.42 + sourK * 0.45;
			mat.size = 0.11 + sourK * 0.05;
			mat.color.copy(normal).lerp(sour, sourK);
			geo.setDrawRange(0, Math.round(count * Math.min(1, base + sourK)));
		},
	};
}
