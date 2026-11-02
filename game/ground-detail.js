// Земля без повторов. Текстуры асфальта, травы и грунта повторяются через несколько метров, поэтому:
// 1) groundVariation — крупная неровность цвета по месту (шум от мировых координат прямо в шейдере
//    материала): асфальт где светлее, где темнее, трава где сочнее, где выгорела — ни одного лишнего прохода;
// 2) scatterGroundDetail — разбросанные по локации детали: трещины, заплатки, пятна масла, люки, решётки
//    ливнёвки, песок, следы шин на асфальте; колеи и камни на грунте; листья, проплешины и сухая трава на
//    траве. Все детали — одним материалом (атлас 4×4) и сливаются в статику по участкам: на участок в кадре —
//    один вызов отрисовки.

import * as THREE from 'three';
import { place, planeXZ } from './geom.js';

/**
 * Крупная неровность цвета по месту. amp — насколько светлее/темнее (доля), tint — во что уходят
 * «выгоревшие» места (множитель цвета), tintAmp — насколько.
 */
export function groundVariation(material, { amp = 0.14, tint = [1, 1, 1], tintAmp = 0 } = {}) {
	const prev = material.onBeforeCompile;
	material.onBeforeCompile = (shader, renderer) => {
		prev?.(shader, renderer);
		shader.uniforms.uVarAmp = { value: amp };
		shader.uniforms.uVarTint = { value: new THREE.Vector3(...tint) };
		shader.uniforms.uVarTintAmp = { value: tintAmp };
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>
varying vec2 vGroundXZ;
uniform float uVarAmp, uVarTintAmp;
uniform vec3 uVarTint;
float gvHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gvNoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(gvHash(i), gvHash(i + vec2(1.0, 0.0)), f.x), mix(gvHash(i + vec2(0.0, 1.0)), gvHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`)
			.replace('#include <map_fragment>', `#include <map_fragment>
{
	float gv = gvNoise(vGroundXZ * 0.09) * 0.6 + gvNoise(vGroundXZ * 0.31 + 17.0) * 0.4;
	diffuseColor.rgb *= 1.0 + (gv - 0.5) * 2.0 * uVarAmp;
	float gt = smoothstep(0.5, 0.78, gvNoise(vGroundXZ * 0.05 + 41.0));
	diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uVarTint, gt * uVarTintAmp);
}`);
	};
	material.customProgramCacheKey = () => `ground-variation-${amp}-${tint.join(',')}-${tintAmp}`;
	return material;
}

// ---------- Атлас деталей: 4×4 клетки по 256 px ----------
const CELL = 256, N = 4;
/** Клетки атласа по видам: [номер клетки, ширина м, глубина м]. */
const DETAIL = {
	crack: [[0, 3.2, 3.2], [1, 3.8, 2.2], [2, 2.8, 2.8]],
	patch: [[3, 2.6, 1.8], [4, 1.8, 1.4]],
	oil: [[5, 1.4, 1.2], [6, 1.9, 1.3]],
	manhole: [[7, 0.9, 0.9]],
	grate: [[8, 0.9, 0.5]],
	leaves: [[9, 1.6, 1.6], [10, 2.2, 1.5]],
	sand: [[11, 2.2, 1.6]],
	skid: [[12, 3.6, 0.9]],
	bare: [[13, 2.4, 2]],
	dry: [[14, 3, 2.4]],
	litter: [[15, 1.2, 1.2]],
};

let atlasMat = null;

function rng(seed) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Нарисовать атлас: каждая клетка — прозрачный фон и деталь с мягким краем. */
function drawAtlas() {
	const c = document.createElement('canvas');
	c.width = c.height = CELL * N;
	const ctx = c.getContext('2d');
	const r = rng(9137);
	const R = (a, b) => a + (b - a) * r();
	const cell = (i, draw) => { ctx.save(); ctx.translate((i % N) * CELL, Math.floor(i / N) * CELL); ctx.beginPath(); ctx.rect(2, 2, CELL - 4, CELL - 4); ctx.clip(); draw(); ctx.restore(); };
	const blob = (x, y, rad, color, soft = 0.6) => {
		const g = ctx.createRadialGradient(x, y, rad * (1 - soft), x, y, rad);
		g.addColorStop(0, color); g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
	};
	const speckle = (n, color, x0 = 20, x1 = CELL - 20, size = [1, 3]) => {
		ctx.fillStyle = color;
		for (let k = 0; k < n; k++) { const s = R(...size); ctx.fillRect(R(x0, x1), R(x0, x1), s, s); }
	};
	// трещины: ветвистые ломаные, тёмная середина и светлая кромка
	const crack = (x, y, a, len, w, depth) => {
		let px = x, py = y;
		for (let s = 0; s < len; s++) {
			a += R(-0.5, 0.5);
			const nx = px + Math.cos(a) * 7, ny = py + Math.sin(a) * 7;
			if (nx < 12 || ny < 12 || nx > CELL - 12 || ny > CELL - 12) break;
			ctx.strokeStyle = 'rgba(150,146,138,0.35)'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
			ctx.strokeStyle = 'rgba(18,17,16,0.9)'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
			if (depth > 0 && r() < 0.12) crack(nx, ny, a + R(-1.4, 1.4), len * 0.4, Math.max(1, w * 0.6), depth - 1);
			px = nx; py = ny; w = Math.max(0.8, w * 0.985);
		}
	};
	ctx.lineCap = 'round'; ctx.lineJoin = 'round';
	for (const i of [0, 1, 2]) cell(i, () => { for (let k = 0; k < 3 + i; k++) crack(R(40, 216), R(40, 216), R(0, 6.28), 40, R(3.2, 4.6), 2); });
	// заплатки: прямоугольник свежего тёмного асфальта с неровным краем и швом
	for (const i of [3, 4]) cell(i, () => {
		const w = R(150, 210), h = R(110, 170), x = (CELL - w) / 2, y = (CELL - h) / 2;
		ctx.fillStyle = i === 3 ? 'rgba(54,54,56,0.55)' : 'rgba(104,102,98,0.5)';
		ctx.beginPath(); ctx.moveTo(x, y);
		for (const [ex, ey] of [[x + w, y], [x + w, y + h], [x, y + h]]) ctx.lineTo(ex + R(-6, 6), ey + R(-6, 6));
		ctx.closePath(); ctx.fill();
		ctx.strokeStyle = 'rgba(24,24,24,0.45)'; ctx.lineWidth = 3; ctx.stroke();
		speckle(500, 'rgba(120,118,112,0.35)', x, x + w);
	});
	// пятна масла: тёмные кляксы с потёками
	for (const i of [5, 6]) cell(i, () => {
		for (let k = 0; k < 7; k++) blob(R(80, 176), R(80, 176), R(22, 70), `rgba(${R(10, 22) | 0},${R(10, 18) | 0},${R(8, 14) | 0},${R(0.35, 0.6).toFixed(2)})`, 0.7);
		blob(128, 128, 40, 'rgba(60,40,70,0.12)', 0.9); // радужный отлив
	});
	// люк: чугунная крышка с ромбами и кольцом
	cell(7, () => {
		ctx.fillStyle = 'rgba(70,68,64,1)'; ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = 'rgba(40,38,36,1)'; ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = 'rgba(92,88,82,1)'; ctx.lineWidth = 4;
		ctx.save(); ctx.beginPath(); ctx.arc(128, 128, 98, 0, Math.PI * 2); ctx.clip();
		for (let k = -8; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(128 + k * 22 - 200, -20); ctx.lineTo(128 + k * 22 + 200, 300); ctx.stroke(); ctx.beginPath(); ctx.moveTo(128 + k * 22 + 200, -20); ctx.lineTo(128 + k * 22 - 200, 300); ctx.stroke(); }
		ctx.restore();
		ctx.fillStyle = 'rgba(110,70,45,0.35)'; for (let k = 0; k < 9; k++) blob(R(50, 206), R(50, 206), R(10, 30), 'rgba(110,70,45,0.35)', 0.8);
	});
	// решётка ливнёвки
	cell(8, () => {
		ctx.fillStyle = 'rgba(52,50,46,1)'; ctx.fillRect(18, 56, 220, 144);
		ctx.fillStyle = 'rgba(8,8,8,1)'; for (let k = 0; k < 9; k++) ctx.fillRect(32 + k * 22, 70, 12, 116);
		ctx.strokeStyle = 'rgba(90,86,80,1)'; ctx.lineWidth = 5; ctx.strokeRect(18, 56, 220, 144);
	});
	// листья: россыпь жёлтых, рыжих и бурых
	for (const i of [9, 10]) cell(i, () => {
		const cols = ['166,128,48', '178,96,36', '120,82,44', '140,120,60', '96,70,40'];
		for (let k = 0; k < 160; k++) {
			const a = R(0, 6.28), d = Math.sqrt(r()) * 108, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * (i === 10 ? 0.7 : 1);
			ctx.save(); ctx.translate(x, y); ctx.rotate(R(0, 6.28));
			ctx.fillStyle = `rgba(${cols[(r() * cols.length) | 0]},${R(0.7, 0.95).toFixed(2)})`;
			ctx.beginPath(); ctx.ellipse(0, 0, R(5, 9), R(2.5, 4.5), 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		}
	});
	// песок, нанесённый на асфальт
	cell(11, () => { for (let k = 0; k < 9; k++) blob(R(70, 186), R(80, 176), R(30, 70), 'rgba(150,132,100,0.35)', 0.8); speckle(900, 'rgba(170,152,118,0.5)', 30, 226, [1, 2]); });
	// тормозной след: две тёмные полосы
	cell(12, () => {
		for (const y of [92, 164]) { const g = ctx.createLinearGradient(0, 0, CELL, 0); g.addColorStop(0, 'rgba(14,14,14,0)'); g.addColorStop(0.2, 'rgba(14,14,14,0.5)'); g.addColorStop(0.9, 'rgba(14,14,14,0.55)'); g.addColorStop(1, 'rgba(14,14,14,0)'); ctx.fillStyle = g; ctx.fillRect(10, y - 13, 236, 26); }
	});
	// проплешина: бурая земля с камешками
	cell(13, () => { for (let k = 0; k < 8; k++) blob(R(80, 176), R(80, 176), R(36, 80), 'rgba(98,80,58,0.55)', 0.75); speckle(160, 'rgba(150,144,132,0.8)', 50, 206, [2, 4]); });
	// сухая трава: жёлтые штрихи
	cell(14, () => {
		for (let k = 0; k < 6; k++) blob(R(80, 176), R(80, 176), R(40, 90), 'rgba(150,136,80,0.35)', 0.8);
		ctx.lineWidth = 1.6;
		for (let k = 0; k < 420; k++) { const a = R(0, 6.28), d = Math.sqrt(r()) * 100, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d; const b = R(-0.6, 0.6); ctx.strokeStyle = `rgba(${R(150, 190) | 0},${R(132, 160) | 0},${R(70, 96) | 0},0.75)`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(b) * 10, y - Math.cos(b) * 10); ctx.stroke(); }
	});
	// мусор: окурки, осколки, крышки
	cell(15, () => {
		for (let k = 0; k < 28; k++) {
			ctx.save(); ctx.translate(R(40, 216), R(40, 216)); ctx.rotate(R(0, 6.28));
			const t = r();
			ctx.fillStyle = t < 0.4 ? 'rgba(220,210,180,0.9)' : t < 0.7 ? 'rgba(70,110,80,0.7)' : 'rgba(150,140,120,0.9)';
			if (t < 0.4) ctx.fillRect(-5, -1.5, 10, 3); else if (t < 0.7) { ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(5, -1); ctx.lineTo(0, 4); ctx.fill(); } else { ctx.beginPath(); ctx.arc(0, 0, 3, 0, 6.28); ctx.fill(); }
			ctx.restore();
		}
	});
	return c;
}

function material() {
	if (atlasMat) return atlasMat;
	const tex = new THREE.CanvasTexture(drawAtlas());
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	atlasMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
	return atlasMat;
}

/** Плоская деталь из клетки атласа i: w×d м, в (x, z), повёрнута на ry. */
function detail(i, w, d, x, z, ry, y) {
	const g = planeXZ(w, d, w, d); // uv 0..1
	const uv = g.attributes.uv, cx = i % N, cy = Math.floor(i / N), pad = 2 / (CELL * N);
	for (let k = 0; k < uv.count; k++) {
		const u = uv.getX(k), v = uv.getY(k);
		uv.setXY(k, (cx + pad * N + u * (1 - 2 * pad * N)) / N, 1 - (cy + pad * N + (1 - v) * (1 - 2 * pad * N)) / N);
	}
	return place(g, x, y, z, ry);
}

/**
 * Разбросать детали по земле локации. grounds — покрытия ({ w, d, x, z, ry, kind }), free(x, z) — можно ли
 * класть сюда (не в доме), rnd — генератор локации, play — половина размера игровой зоны.
 */
export function scatterGroundDetail(batch, grounds, free, rnd, play, { density = 1 } = {}) {
	const mat = material();
	const pick = (list) => list[Math.floor(rnd() * list.length)];
	const inside = (g, x, z) => {
		const dx = x - g.x, dz = z - g.z, c = Math.cos(g.ry ?? 0), s = Math.sin(g.ry ?? 0);
		const lx = dx * c - dz * s, lz = dx * s + dz * c;
		return Math.abs(lx) < g.w / 2 && Math.abs(lz) < g.d / 2;
	};
	const onAny = (x, z) => grounds.some((g) => inside(g, x, z));
	let n = 0;
	const put = (kind, x, z, ry, scale = 1) => {
		if (Math.abs(x) > play || Math.abs(z) > play || !free(x, z)) return;
		const [i, w, d] = pick(DETAIL[kind]);
		batch.add(detail(i, w * scale, d * scale, x, z, ry, 0.026 + rnd() * 0.002), mat, { cast: false });
		n++;
	};
	// по покрытиям: асфальт и плиты — трещины, заплатки, масло, люки; грунт — колеи, камни, листья
	const MIX = {
		asphalt: [['crack', 5], ['patch', 3], ['oil', 2], ['sand', 2], ['leaves', 2], ['litter', 1.5], ['skid', 0.8], ['manhole', 0.6], ['grate', 0.6]],
		concrete: [['crack', 4], ['oil', 2], ['sand', 2], ['litter', 1], ['leaves', 1]],
		dirt: [['bare', 3], ['leaves', 2], ['litter', 1], ['skid', 1]],
		sand: [['bare', 2], ['leaves', 1], ['litter', 1]],
	};
	const RATE = { asphalt: 0.02, concrete: 0.012, dirt: 0.008, sand: 0.005 }; // деталей на м²
	const roll = (mix) => { const sum = mix.reduce((a, [, w]) => a + w, 0); let t = rnd() * sum; for (const [k, w] of mix) if ((t -= w) <= 0) return k; return mix[0][0]; };
	for (const g of grounds) {
		const mix = MIX[g.kind];
		if (!mix) continue;
		const count = Math.round(g.w * g.d * RATE[g.kind] * density);
		const c = Math.cos(g.ry ?? 0), s = Math.sin(g.ry ?? 0);
		for (let k = 0; k < count; k++) {
			const kind = roll(mix);
			// люки и решётки — на дороге, по оси или у края; остальное где придётся
			const lx = (rnd() - 0.5) * (g.w - 1), lz = (rnd() - 0.5) * (g.d - 1);
			const x = g.x + lx * c + lz * s, z = g.z - lx * s + lz * c;
			const along = g.w > g.d ? (g.ry ?? 0) : (g.ry ?? 0) + Math.PI / 2;
			const ry = kind === 'skid' || kind === 'grate' ? along + (rnd() - 0.5) * 0.3 : rnd() * Math.PI * 2;
			put(kind, x, z, ry, kind === 'manhole' || kind === 'grate' ? 1 : 0.8 + rnd() * 0.5);
		}
	}
	// трава: проплешины, сухая трава, листья — там, где нет покрытий
	const grassCount = Math.round((2 * play) ** 2 * 0.0035 * density);
	for (let k = 0; k < grassCount; k++) {
		const x = (rnd() * 2 - 1) * play, z = (rnd() * 2 - 1) * play;
		if (onAny(x, z)) continue;
		const t = rnd();
		put(t < 0.4 ? 'dry' : t < 0.75 ? 'bare' : 'leaves', x, z, rnd() * Math.PI * 2, 0.8 + rnd() * 0.7);
	}
	return n;
}
