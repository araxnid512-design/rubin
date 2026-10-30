// Облегчение моделей для игры: меньше треугольников при тех же вершинах (meshoptimizer перестраивает только
// индексы — веса костей, развёртка и швы сохраняются), потом неиспользуемые вершины выбрасываются.
// ratios — доля треугольников по материалам ({ Skin: 0.4, Cloth: 0.5, ... }, по умолчанию 1 — не трогать).

import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';

export async function simplifyCharacter(model, ratios, { error = 0.012 } = {}) {
	await MeshoptSimplifier.ready;
	const report = [];
	model.traverse((o) => {
		if (!o.isMesh || !o.geometry.index) return;
		const geo = o.geometry, mats = [o.material].flat();
		const pos = geo.attributes.position.array;
		const src = geo.index.array;
		const groups = geo.groups.length ? geo.groups : [{ start: 0, count: src.length, materialIndex: 0 }];
		const outIdx = [], outGroups = [];
		for (const g of groups) {
			const part = Uint32Array.from(src.subarray(g.start, g.start + g.count));
			const name = mats[g.materialIndex]?.name ?? '';
			const ratio = ratios[name] ?? 1;
			let res = part;
			if (ratio < 1) {
				const target = Math.max(3, Math.floor((part.length * ratio) / 3) * 3);
				[res] = MeshoptSimplifier.simplify(part, pos, 3, target, error, []);
			}
			outGroups.push({ start: outIdx.length, count: res.length, materialIndex: g.materialIndex });
			for (const i of res) outIdx.push(i);
			report.push(`${name} ${part.length / 3}→${res.length / 3}`);
		}
		// неиспользуемые вершины — вон: модель меньше и быстрее грузится
		const used = new Int32Array(geo.attributes.position.count).fill(-1);
		let n = 0;
		for (const i of outIdx) if (used[i] < 0) used[i] = n++;
		const compact = new THREE.BufferGeometry();
		for (const [key, attr] of Object.entries(geo.attributes)) {
			const size = attr.itemSize, arr = new attr.array.constructor(n * size);
			for (let v = 0; v < used.length; v++) if (used[v] >= 0) for (let k = 0; k < size; k++) arr[used[v] * size + k] = attr.array[v * size + k];
			compact.setAttribute(key, new THREE.BufferAttribute(arr, size, attr.normalized));
		}
		compact.setIndex(outIdx.map((i) => used[i]));
		for (const g of outGroups) compact.addGroup(g.start, g.count, g.materialIndex);
		compact.computeBoundingBox();
		compact.computeBoundingSphere();
		o.geometry = compact;
		report.push(`вершин ${geo.attributes.position.count}→${n}`);
	});
	return report.join(', ');
}
