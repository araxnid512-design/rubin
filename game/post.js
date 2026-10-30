// Пост-обработка. Цвет Улья — приглушённые краски, тени в зелень, свет в жёлтое, лёгкий контраст — встроен
// в тональную коррекцию каждого материала (CustomToneMapping): отдельного прохода нет, телефону ничего
// не стоит. На высоком качестве кадр идёт через цепочку проходов: затенение в углах и щелях (GTAO,
// только на компьютере), свечение вспышек, огня и спор (bloom) и плёночное зерно.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

// ACES, затем цвет Улья (вход — линейный HDR, выход — линейный 0..1 для экрана)
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
	'vec3 CustomToneMapping( vec3 color ) { return color; }',
	`vec3 CustomToneMapping( vec3 color ) {
		color = ACESFilmicToneMapping( color );
		float l = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
		color = mix( vec3( l ), color, 0.86 );
		color *= mix( vec3( 0.93, 1.0, 0.97 ), vec3( 1.05, 1.02, 0.91 ), smoothstep( 0.02, 0.45, l ) );
		color = mix( color, color * color * ( 3.0 - 2.0 * color ), 0.14 );
		return clamp( color, 0.0, 1.0 );
	}`,
);

// последний проход цепочки: тональная коррекция с цветом Улья, перевод в sRGB и зерно
const FinalShader = {
	uniforms: { tDiffuse: { value: null }, toneMappingExposure: { value: 1 }, uTime: { value: 0 }, uGrain: { value: 0.03 } },
	vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
	fragmentShader: /* glsl */ `
		#include <tonemapping_pars_fragment>
		uniform sampler2D tDiffuse;
		uniform float uTime, uGrain;
		varying vec2 vUv;
		void main() {
			vec3 c = CustomToneMapping( texture2D( tDiffuse, vUv ).rgb );
			c = sRGBTransferOETF( vec4( c, 1.0 ) ).rgb;
			float n = fract( sin( dot( gl_FragCoord.xy + fract( uTime ) * 97.0, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
			c += ( n - 0.5 ) * uGrain;
			gl_FragColor = vec4( c, 1.0 );
		}`,
};

/**
 * quality: 'low' | 'medium' | 'high'; mobile — телефон или планшет.
 * Возвращает { render(dt), setSize(w, h), passes } — render рисует кадр, setSize — после смены размера или чёткости,
 * passes — включённые проходы по именам (ao, bloom, final).
 */
export function createPost(renderer, scene, camera, { quality, mobile }) {
	renderer.toneMapping = THREE.CustomToneMapping;
	renderer.info.autoReset = false; // кадр рисуется в несколько проходов — считаем вызовы за весь кадр
	const direct = {
		passes: {},
		render() { renderer.info.reset(); renderer.render(scene, camera); },
		setSize() {},
	};
	if (quality !== 'high') return direct;

	const size = renderer.getDrawingBufferSize(new THREE.Vector2());
	const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
	const composer = new EffectComposer(renderer, target);
	composer.addPass(new RenderPass(scene, camera));
	const passes = {};
	if (!mobile) {
		// затенение мягкое и без мелких деталей — считается в половинном разрешении (вчетверо меньше точек)
		const ao = new GTAOPass(scene, camera, Math.ceil(size.x / 2), Math.ceil(size.y / 2));
		const aoSize = ao.setSize.bind(ao);
		ao.setSize = (w, h) => aoSize(Math.ceil(w / 2), Math.ceil(h / 2));
		ao.output = GTAOPass.OUTPUT.Default;
		ao.blendIntensity = 0.9;
		ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.8, thickness: 2.5, scale: 2.2, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
		ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
		// в карту глубины не попадают спрайты, частицы и полупрозрачное (стены, что стали прозрачными, кровь, свечение)
		ao.overrideVisibility = function () {
			const cache = this._visibilityCache;
			this.scene.traverse((o) => {
				cache.set(o, o.visible);
				if (o.isPoints || o.isLine || o.isSprite || (o.material && [o.material].flat().some((m) => m.transparent))) o.visible = false;
			});
		};
		composer.addPass(ao);
		passes.ao = ao;
	}
	const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.5, 0.45, 0.92);
	composer.addPass(bloom);
	passes.bloom = bloom;
	const final = new ShaderPass(FinalShader);
	final.material.toneMapped = false; // тональная коррекция — в самом шейдере
	composer.addPass(final);
	passes.final = final;

	// тени — один раз за кадр (иначе проход нормалей для AO перерисовал бы и карту теней)
	renderer.shadowMap.autoUpdate = false;
	return {
		passes,
		render(dt = 0) {
			renderer.info.reset();
			renderer.shadowMap.needsUpdate = true;
			final.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
			final.uniforms.uTime.value += dt;
			composer.render(dt);
		},
		setSize(w, h) {
			composer.setPixelRatio(renderer.getPixelRatio());
			composer.setSize(w, h);
		},
	};
}
