// Звуки синтезируются WebAudio (без файлов): выстрел, взмах, удар, рык, подбор.

let ctx = null;
const noiseBuf = () => {
	const b = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
	const d = b.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	return b;
};
let noise = null;

function env(node, t, a, peak, dur) {
	node.gain.setValueAtTime(0.0001, t);
	node.gain.exponentialRampToValueAtTime(peak, t + a);
	node.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function burst({ dur = 0.2, freq = 1000, q = 1, type = 'lowpass', gain = 0.5, sweep = null, attack = 0.005 }) {
	if (!ctx) return;
	const t = ctx.currentTime;
	const src = ctx.createBufferSource();
	src.buffer = noise;
	const f = ctx.createBiquadFilter();
	f.type = type; f.frequency.value = freq; f.Q.value = q;
	if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
	const g = ctx.createGain();
	env(g, t, attack, gain, dur);
	src.connect(f).connect(g).connect(ctx.destination);
	src.start(t, Math.random() * 0.5);
	src.stop(t + dur + 0.05);
}

function tone({ freq = 440, to = null, dur = 0.2, type = 'sine', gain = 0.2 }) {
	if (!ctx) return;
	const t = ctx.currentTime;
	const o = ctx.createOscillator();
	o.type = type; o.frequency.value = freq;
	if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
	const g = ctx.createGain();
	env(g, t, 0.01, gain, dur);
	o.connect(g).connect(ctx.destination);
	o.start(t); o.stop(t + dur + 0.05);
}

export const Sfx = {
	unlock() {
		if (ctx) return;
		try {
			ctx = new (window.AudioContext || window.webkitAudioContext)();
			noise = noiseBuf();
		} catch { ctx = null; }
	},
	/** Выстрел: pistol — хлопок ПМ, shotgun — гулкий дуплет картечи, rifle — сухой резкий 5,45. */
	shot(kind = 'pistol') {
		if (kind === 'shotgun') { burst({ dur: 0.5, freq: 1600, sweep: 180, gain: 0.85 }); tone({ freq: 95, to: 38, dur: 0.32, type: 'triangle', gain: 0.55 }); return; }
		if (kind === 'rifle') { burst({ dur: 0.16, freq: 3400, sweep: 500, gain: 0.6 }); tone({ freq: 180, to: 70, dur: 0.1, type: 'triangle', gain: 0.35 }); return; }
		burst({ dur: 0.25, freq: 2400, sweep: 300, gain: 0.7 }); tone({ freq: 140, to: 50, dur: 0.18, type: 'triangle', gain: 0.4 });
	},
	/** Гул перезагрузки кластера: низкий нарастающий рокот. */
	rumble(power = 1) { tone({ freq: 48, to: 34, dur: 1.4, type: 'sawtooth', gain: 0.08 * power }); burst({ dur: 1.4, freq: 160, sweep: 60, gain: 0.3 * power, attack: 0.4 }); },
	snap() { burst({ dur: 0.09, freq: 2600, type: 'highpass', gain: 0.6 }); tone({ freq: 320, to: 90, dur: 0.16, type: 'square', gain: 0.12 }); setTimeout(() => burst({ dur: 0.25, freq: 900, sweep: 300, gain: 0.3 }), 90); },
	explosion() { burst({ dur: 1.4, freq: 900, sweep: 60, gain: 1.0, attack: 0.004 }); tone({ freq: 70, to: 28, dur: 0.9, type: 'sine', gain: 0.6 }); setTimeout(() => burst({ dur: 1.2, freq: 300, sweep: 80, gain: 0.35, attack: 0.1 }), 120); },
	coins() { [0, 0.07, 0.14].forEach((d) => setTimeout(() => tone({ freq: 1200 + d * 2000, dur: 0.06, type: 'triangle', gain: 0.1 }), d * 1000)); },
	swing() { burst({ dur: 0.22, freq: 600, sweep: 2400, type: 'bandpass', q: 2, gain: 0.25, attack: 0.05 }); },
	chop() { burst({ dur: 0.12, freq: 900, gain: 0.5 }); tone({ freq: 110, to: 60, dur: 0.12, type: 'square', gain: 0.12 }); },
	flesh() { burst({ dur: 0.15, freq: 500, sweep: 200, gain: 0.35 }); },
	growl(big) { burst({ dur: big ? 1.1 : 0.7, freq: big ? 180 : 300, sweep: big ? 90 : 160, type: 'bandpass', q: 6, gain: big ? 0.5 : 0.3, attack: 0.15 }); },
	// рёв рубера: низкий, с хрипом, нарастает и обрывается
	roar() { burst({ dur: 1.6, freq: 140, sweep: 60, type: 'bandpass', q: 4, gain: 0.8, attack: 0.35 }); tone({ freq: 62, to: 44, dur: 1.5, type: 'sawtooth', gain: 0.12 }); setTimeout(() => burst({ dur: 0.9, freq: 420, sweep: 180, type: 'bandpass', q: 3, gain: 0.35, attack: 0.2 }), 250); },
	// удар лапами о землю
	thud() { tone({ freq: 80, to: 36, dur: 0.35, type: 'sine', gain: 0.5 }); burst({ dur: 0.3, freq: 400, sweep: 90, gain: 0.5, attack: 0.005 }); },
	// чёрная жемчужина: звон
	chime() { [0, 0.12, 0.26].forEach((d, i) => setTimeout(() => tone({ freq: [880, 1320, 1760][i], dur: 0.5, type: 'sine', gain: 0.1 }), d * 1000)); },
	death(big) { burst({ dur: big ? 1.2 : 0.8, freq: big ? 220 : 380, sweep: 70, type: 'bandpass', q: 5, gain: 0.4, attack: 0.05 }); },
	hurt() { tone({ freq: 220, to: 120, dur: 0.18, type: 'sawtooth', gain: 0.12 }); burst({ dur: 0.12, freq: 700, gain: 0.25 }); },
	reload() { tone({ freq: 900, dur: 0.05, type: 'square', gain: 0.08 }); setTimeout(() => tone({ freq: 650, dur: 0.06, type: 'square', gain: 0.08 }), 600); },
	pickup() { tone({ freq: 660, to: 1320, dur: 0.18, type: 'sine', gain: 0.15 }); },
	search() { burst({ dur: 0.5, freq: 1400, sweep: 700, type: 'bandpass', q: 1.5, gain: 0.16, attack: 0.08 }); setTimeout(() => burst({ dur: 0.35, freq: 900, type: 'bandpass', q: 2, gain: 0.12, attack: 0.05 }), 450); },
	dry() { tone({ freq: 1900, dur: 0.025, type: 'square', gain: 0.07 }); burst({ dur: 0.04, freq: 3000, gain: 0.12 }); },
	drink() { [0, 0.16, 0.32].forEach((d) => setTimeout(() => tone({ freq: 260, to: 420, dur: 0.12, type: 'sine', gain: 0.14 }), d * 1000)); },
};
