// Разные заражённые. Цвет одежды у моделей — в цветах вершин (рубаха, штаны), текстура ткани — светлая,
// с пятнами: поэтому одежда перекрашивается в шейдере (поворот оттенка, насыщенность, яркость — свои у
// каждого заражённого), а варианты текстуры добавляют крови и грязи. Плюс оттенок кожи (бледная, серая,
// в зелень, в желтизну), рост и сложение.

import * as THREE from 'three';

const rand = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** Варианты текстуры одежды map: n штук — грязь и подсохшая кровь поверх ткани, у каждого свои. */
export function clothVariants(map, n = 4, seed = 7) {
	const img = map?.image;
	if (!img?.width || typeof document === 'undefined') return [];
	const rnd = rand(seed);
	const out = [];
	for (let v = 0; v < n; v++) {
		const c = document.createElement('canvas');
		c.width = img.width; c.height = img.height;
		const ctx = c.getContext('2d');
		ctx.drawImage(img, 0, 0);
		if (v === 0) { out.push(map); continue; } // первый — как есть
		// грязь и подсохшая кровь поверх ткани
		const W = c.width, H = c.height;
		for (let i = 0; i < 10; i++) {
			const x = rnd() * W, y = rnd() * H, r = (0.03 + rnd() * 0.08) * W;
			const g = ctx.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, `rgba(42,34,24,${0.18 + rnd() * 0.2})`); g.addColorStop(1, 'rgba(42,34,24,0)');
			ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
		}
		for (let i = 0; i < 4 + rnd() * 8; i++) {
			const x = rnd() * W, y = rnd() * H;
			for (let k = 0; k < 6; k++) {
				const r = (0.008 + rnd() * 0.03) * W;
				ctx.fillStyle = `rgba(${55 + rnd() * 30},${4 + rnd() * 6},${3 + rnd() * 5},${0.45 + rnd() * 0.4})`;
				ctx.beginPath(); ctx.ellipse(x + (rnd() - 0.5) * W * 0.06, y + (rnd() - 0.5) * H * 0.06, r * (1 + rnd()), r, rnd() * 3, 0, Math.PI * 2); ctx.fill();
			}
		}
		const t = new THREE.CanvasTexture(c);
		t.flipY = map.flipY; t.colorSpace = map.colorSpace; t.wrapS = map.wrapS; t.wrapT = map.wrapT;
		t.anisotropy = map.anisotropy; t.channel = map.channel;
		out.push(t);
	}
	return out;
}

// оттенки кожи: множители цвета текстуры
const SKINS = [[1, 1, 1], [0.86, 0.88, 0.9], [0.88, 0.98, 0.84], [1.0, 0.94, 0.8], [0.84, 0.88, 1.0], [0.95, 0.85, 0.82]];

// цвет вершин ткани (рубаха, штаны): поворот оттенка вокруг серой оси, насыщенность, яркость
const CLOTH_COLOR = /* glsl */ `
#if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )
	vec3 vc = vColor.rgb;
	const vec3 grey = vec3( 0.57735 );
	float hc = cos( uHue ), hs = sin( uHue );
	vc = vc * hc + cross( grey, vc ) * hs + grey * dot( grey, vc ) * ( 1.0 - hc );
	float vl = dot( vc, vec3( 0.299, 0.587, 0.114 ) );
	vc = max( ( vec3( vl ) + ( vc - vl ) * uSat ) * uLum, 0.0 );
	diffuseColor.rgb *= vc;
#endif`;

function recolorCloth(m) {
	const hue = Math.random() < 0.25 ? 0 : (Math.random() * 2 - 1) * Math.PI; // каждый четвёртый — в «родной» одежде
	const u = { uHue: { value: hue }, uSat: { value: 0.35 + Math.random() * 0.5 }, uLum: { value: 0.55 + Math.random() * 0.5 } }; // ткань выцветшая, грязная
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, u);
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\nuniform float uHue, uSat, uLum;')
			.replace('#include <color_fragment>', CLOTH_COLOR);
	};
	m.customProgramCacheKey = () => 'zombie-cloth'; // одна программа на всех, оттенки — в uniform
}

/** Одеть заражённого: одежда своего цвета с пятнами из вариантов, оттенок кожи. Материалы у каждого свои (Actor их клонирует). */
export function dressZombie(actor, variants, { recolor = true } = {}) {
	const cloth = variants?.length ? variants[Math.floor(Math.random() * variants.length)] : null;
	const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
	actor.model.traverse((o) => {
		if (!o.isMesh) return;
		for (const m of [o.material].flat()) {
			if (m.name === 'Cloth') { if (cloth) m.map = cloth; if (recolor) recolorCloth(m); }
			if (m.name === 'Skin') m.color.setRGB(...skin);
		}
	});
}

/** Рост и сложение: s — общий масштаб, w — шире или уже в плечах. */
export function bodyVariation() {
	return { s: 0.93 + Math.random() * 0.14, w: 0.94 + Math.random() * 0.14 };
}
