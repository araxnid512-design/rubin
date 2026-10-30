// Звуки — настоящие записи (assets/sounds, авторы и лицензии — assets/sounds/CREDITS.md): оружие, стоны,
// удары и смерть заражённых, шаги героя по асфальту, траве, грунту и полу, ветер над кластером и дальний гром.
// Грузятся после первого касания; у каждого ствола и каждого заражённого своя высота, дальнее тише и глуше,
// в доме фон приглушён. Интерфейс и кое-что ещё синтезируется WebAudio; пока записи не загрузились — синтез.

import { asset } from './assets.js';

let ctx = null;
const noiseBuf = () => {
	const b = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
	const d = b.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	return b;
};
let noise = null;
let master = null; // общая громкость → компрессор: очередь из пяти стволов не хрипит
const buffers = {};
let voices = 0;
const MAX_VOICES = 28;
const FILES = [
	'pistol', 'shotgun', 'ak1', 'ak2', 'ak3', 'mg', 'svd', 'casing1', 'casing2', 'dry', 'reload_pistol', 'reload_rifle', 'bolt', 'shell', 'explosion',
	'groan1', 'groan2', 'groan3', 'groan4', 'groan5', 'zhit1', 'zhit2', 'zdeath1', 'zdeath2', 'zdeath3', 'gib', 'flesh1', 'flesh2', 'chop',
	'step_road1', 'step_road2', 'step_road3', 'step_grass1', 'step_grass2', 'step_dirt1', 'step_dirt2', 'step_floor1', 'step_floor2',
	'wind', 'thunder',
];
const GROANS = ['groan1', 'groan2', 'groan3', 'groan4', 'groan5'];
const STEPS = { road: ['step_road1', 'step_road2', 'step_road3'], grass: ['step_grass1', 'step_grass2'], dirt: ['step_dirt1', 'step_dirt2'], floor: ['step_floor1', 'step_floor2'] };

function loadSamples() {
	for (const name of FILES) {
		fetch(asset(`assets/sounds/${name}.mp3`))
			.then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
			.then((b) => ctx.decodeAudioData(b))
			.then((buf) => { buffers[name] = buf; if (name === ambient.name) startAmbient(); })
			.catch(() => { /* нет файла — останется синтез */ });
	}
}

/**
 * Запись name: rate — скорость (и высота), gain, pan (-1 слева … 1 справа), lowpass — срез высоких (Гц),
 * delay — через сколько секунд. false — записи нет (звучит синтез).
 */
function play(name, { rate = 1, gain = 1, pan = 0, lowpass = 0, delay = 0 } = {}) {
	const buf = buffers[name];
	if (!ctx || !buf) return false;
	if (voices >= MAX_VOICES || gain < 0.01) return true; // и так грохот — лишний звук не слышен
	const src = ctx.createBufferSource();
	src.buffer = buf;
	src.playbackRate.value = rate;
	let node = src;
	if (lowpass) {
		const f = ctx.createBiquadFilter();
		f.type = 'lowpass'; f.frequency.value = lowpass;
		node = node.connect(f);
	}
	const g = ctx.createGain();
	g.gain.value = gain;
	node = node.connect(g);
	if (pan && ctx.createStereoPanner) {
		const p = ctx.createStereoPanner();
		p.pan.value = pan;
		node = node.connect(p);
	}
	node.connect(master);
	voices++;
	src.onended = () => { voices--; };
	src.start(ctx.currentTime + delay);
	return true;
}

// фон по кругу: свой канал с фильтром (в доме ветер глуше) и плавной громкостью
const ambient = { name: null, gain: 0, src: null, node: null, filter: null, indoor: false };
function startAmbient() {
	const buf = buffers[ambient.name];
	if (!ctx || !buf) return;
	ambient.src?.stop();
	if (!ambient.node) {
		ambient.filter = ctx.createBiquadFilter();
		ambient.filter.type = 'lowpass';
		ambient.filter.frequency.value = ambient.indoor ? 700 : 16000;
		ambient.node = ctx.createGain();
		ambient.node.gain.value = 0;
		ambient.filter.connect(ambient.node).connect(master);
	}
	const src = ctx.createBufferSource();
	src.buffer = buf;
	src.loop = true;
	// края файла (паузы кодировщика MP3) пропускаем: склейка внутри записи бесшовная
	src.loopStart = 0.06; src.loopEnd = buf.duration - 0.06;
	src.connect(ambient.filter);
	src.start(ctx.currentTime, 0.06 + Math.random() * (buf.duration - 0.2));
	ambient.src = src;
	ambient.node.gain.setTargetAtTime(ambient.gain, ctx.currentTime, 1.2);
}

/** Где звучит: d — метров до героя, pan — левее/правее на экране. Дальше — тише и глуше. */
function where({ d = 0, pan = 0 } = {}) {
	return { att: Math.max(0.1, 1 / (1 + d / 12)), pan, lowpass: d > 10 ? Math.max(1800, 12000 - d * 260) : 0 };
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const vary = (k = 0.05) => 1 - k + Math.random() * 2 * k;

// голос ствола: записи, высота (скорость проигрывания), громкость; ВСС — глухой хлопок и лязг затвора
const GUNS = {
	pistol: { s: ['pistol'], rate: 1.06, gain: 0.7 },
	obrez: { s: ['shotgun'], rate: 0.94, gain: 1 },
	shotgun: { s: ['shotgun'], rate: 1, gain: 0.95, pump: true },
	vector: { s: ['pistol'], rate: 1.2, gain: 0.5 },
	aks: { s: ['ak1', 'ak2', 'ak3'], rate: 1.08, gain: 0.75 },
	ak74: { s: ['ak1', 'ak2', 'ak3'], rate: 1, gain: 0.75 },
	ak47: { s: ['ak1', 'ak2', 'ak3'], rate: 0.86, gain: 0.85 },
	vss: { s: ['pistol'], rate: 1.4, gain: 0.2, lowpass: 650, click: true },
	pkm: { s: ['mg'], rate: 0.96, gain: 0.95 },
	svd: { s: ['svd'], rate: 1, gain: 1 },
};
// голоса заражённых: высота записи и громкость
const VOICES = { runner: { rate: 1.02, gain: 0.55 }, stomper: { rate: 0.72, gain: 0.75 }, ruber: { rate: 0.58, gain: 0.9 } };
// перезарядка по устройству оружия
const RELOADS = { pistol: 'pistol', obrez: 'obrez', shotgun: 'pump', pkm: 'belt' };

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
	src.connect(f).connect(g).connect(master);
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
	o.connect(g).connect(master);
	o.start(t); o.stop(t + dur + 0.05);
}

export const Sfx = {
	unlock() {
		if (ctx) return;
		try {
			ctx = new (window.AudioContext || window.webkitAudioContext)();
			noise = noiseBuf();
			const comp = ctx.createDynamicsCompressor();
			comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.2;
			master = ctx.createGain();
			master.gain.value = 0.9;
			master.connect(comp).connect(ctx.destination);
			loadSamples();
			startAmbient();
		} catch { ctx = null; }
	},
	/** Сколько записей загружено (для тестов). */
	get loaded() { return Object.keys(buffers).length; },
	/** Сколько всего записей. */
	get total() { return FILES.length; },
	/** Фон по кругу: name — запись (wind) или null — тишина; gain — громкость. Плавно, без щелчков. */
	ambient(name, gain = 0.2) {
		if (name === ambient.name && gain === ambient.gain) return;
		const same = name === ambient.name;
		ambient.name = name; ambient.gain = gain;
		if (!ctx) return;
		if (!name) { ambient.node?.gain.setTargetAtTime(0, ctx.currentTime, 0.6); return; }
		if (same && ambient.src) ambient.node.gain.setTargetAtTime(gain, ctx.currentTime, 1.2);
		else startAmbient();
	},
	/** Герой в доме: ветер за стенами — глуше. */
	indoor(on) {
		if (on === ambient.indoor) return;
		ambient.indoor = on;
		ambient.filter?.frequency.setTargetAtTime(on ? 700 : 16000, ctx.currentTime, 0.3);
	},
	/** Дальний гром: кластер вот-вот перезагрузится. */
	thunder(power = 1) { play('thunder', { gain: 0.55 * power, rate: vary(0.08), pan: (Math.random() - 0.5) * 0.8 }); },
	/** Шаг героя по покрытию (road | grass | dirt | floor); на бегу — громче. */
	step(surface = 'road', run = false) { play(pick(STEPS[surface] ?? STEPS.road), { gain: run ? 0.32 : 0.2, rate: vary(0.08) }); },
	/**
	 * Выстрел ствола id (kind — запасной синтез: pistol | shotgun | rifle). at — где стреляют ({ d, pan }).
	 * У каждого выстрела чуть своя высота — очередь не звучит как один и тот же сэмпл.
	 */
	gun(id, kind, at) {
		const G = GUNS[id], w = where(at);
		if (!G || !play(pick(G.s), { rate: G.rate * vary(0.04), gain: G.gain * w.att, pan: w.pan, lowpass: G.lowpass || w.lowpass })) {
			if (w.att > 0.3) this.shot(kind);
			return;
		}
		if (G.click) play('dry', { rate: 0.8 * vary(), gain: 0.55 * w.att, pan: w.pan, delay: 0.02 });
		if (G.pump) play('bolt', { rate: 1.3, gain: 0.55 * w.att, pan: w.pan, lowpass: w.lowpass, delay: 0.28 }); // передёрнуть цевьё
	},
	/** Гильза звякает о землю (shell — пластиковая гильза дроби: глуше). */
	casing(kind, at) {
		const w = where(at);
		if (w.att < 0.3 || voices > MAX_VOICES - 10) return; // звон гильз не должен глушить выстрелы
		play(Math.random() < 0.5 ? 'casing1' : 'casing2', { rate: (kind === 'shell' ? 0.7 : 1) * vary(0.12), gain: (kind === 'shell' ? 0.3 : 0.4) * w.att, pan: w.pan, delay: 0.32 + Math.random() * 0.25 });
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
	// взрыв: запись и низкий удар под ней (его в динамиках телефона почти не слышно, в наушниках — грудью)
	explosion(at) {
		const w = where(at);
		if (play('explosion', { gain: Math.min(1, w.att * 1.4), pan: w.pan, lowpass: w.lowpass, rate: vary(0.04) })) { tone({ freq: 62, to: 26, dur: 0.8, type: 'sine', gain: 0.45 * w.att }); return; }
		burst({ dur: 1.4, freq: 900, sweep: 60, gain: 1.0, attack: 0.004 }); tone({ freq: 70, to: 28, dur: 0.9, type: 'sine', gain: 0.6 }); setTimeout(() => burst({ dur: 1.2, freq: 300, sweep: 80, gain: 0.35, attack: 0.1 }), 120);
	},
	coins() { [0, 0.07, 0.14].forEach((d) => setTimeout(() => tone({ freq: 1200 + d * 2000, dur: 0.06, type: 'triangle', gain: 0.1 }), d * 1000)); },
	swing() { burst({ dur: 0.22, freq: 600, sweep: 2400, type: 'bandpass', q: 2, gain: 0.25, attack: 0.05 }); },
	chop() { if (!play('chop', { gain: 0.8, rate: vary(0.08) })) { burst({ dur: 0.12, freq: 900, gain: 0.5 }); tone({ freq: 110, to: 60, dur: 0.12, type: 'square', gain: 0.12 }); } },
	/** Пуля или дробь в тело. */
	flesh(at) {
		const w = where(at);
		if (!play(Math.random() < 0.5 ? 'flesh1' : 'flesh2', { gain: 0.45 * w.att, rate: vary(0.12), pan: w.pan, lowpass: w.lowpass })) burst({ dur: 0.15, freq: 500, sweep: 200, gain: 0.35 });
	},
	/** Разорвало: голова или рука отлетела. */
	gib(at) { const w = where(at); play('gib', { gain: 0.7 * w.att, rate: vary(0.1), pan: w.pan }); },
	/**
	 * Стон заражённого: kind — runner | stomper | ruber (чем крупнее, тем ниже и громче), at — где он.
	 * Записей пять, высота каждый раз своя — толпа не звучит хором одного голоса.
	 */
	growl(kind = 'runner', at) {
		const w = where(at), V = VOICES[kind] ?? VOICES.runner;
		if (w.att < 0.2) return;
		if (!play(pick(GROANS), { rate: V.rate * vary(0.08), gain: V.gain * w.att, pan: w.pan, lowpass: w.lowpass })) {
			const big = kind !== 'runner';
			burst({ dur: big ? 1.1 : 0.7, freq: big ? 180 : 300, sweep: big ? 90 : 160, type: 'bandpass', q: 6, gain: big ? 0.5 : 0.3, attack: 0.15 });
		}
	},
	// рёв рубера: низкий, с хрипом, нарастает и обрывается
	roar(at) {
		const w = where(at);
		// два стона октавой ниже внахлёст и низкий гул под ними
		if (play('groan3', { rate: 0.5, gain: w.att, pan: w.pan }) && play('groan1', { rate: 0.62, gain: 0.7 * w.att, pan: w.pan, delay: 0.25 })) { tone({ freq: 58, to: 40, dur: 1.4, type: 'sawtooth', gain: 0.08 * w.att }); return; }
		burst({ dur: 1.6, freq: 140, sweep: 60, type: 'bandpass', q: 4, gain: 0.8, attack: 0.35 }); tone({ freq: 62, to: 44, dur: 1.5, type: 'sawtooth', gain: 0.12 }); setTimeout(() => burst({ dur: 0.9, freq: 420, sweep: 180, type: 'bandpass', q: 3, gain: 0.35, attack: 0.2 }), 250);
	},
	// удар лапами о землю
	thud() { tone({ freq: 80, to: 36, dur: 0.35, type: 'sine', gain: 0.5 }); burst({ dur: 0.3, freq: 400, sweep: 90, gain: 0.5, attack: 0.005 }); },
	// чёрная жемчужина: звон
	chime() { [0, 0.12, 0.26].forEach((d, i) => setTimeout(() => tone({ freq: [880, 1320, 1760][i], dur: 0.5, type: 'sine', gain: 0.1 }), d * 1000)); },
	/** Смерть: kind — runner | stomper | ruber (записи) или human — погиб наёмник (синтез). */
	death(kind = 'runner', at) {
		const w = where(at), V = VOICES[kind];
		if (V && play(pick(['zdeath1', 'zdeath2', 'zdeath3']), { rate: V.rate * vary(0.06), gain: V.gain * 1.1 * w.att, pan: w.pan, lowpass: w.lowpass })) return;
		const big = kind !== 'runner';
		burst({ dur: big ? 1.2 : 0.8, freq: big ? 220 : 380, sweep: 70, type: 'bandpass', q: 5, gain: 0.4, attack: 0.05 });
	},
	/** Героя ударили или укусили: шлепок удара и короткий выдох. */
	hurt() {
		if (play(Math.random() < 0.5 ? 'zhit1' : 'zhit2', { gain: 0.75, rate: vary(0.1) })) { tone({ freq: 180, to: 110, dur: 0.14, type: 'sawtooth', gain: 0.05 }); return; }
		tone({ freq: 220, to: 120, dur: 0.18, type: 'sawtooth', gain: 0.12 }); burst({ dur: 0.12, freq: 700, gain: 0.25 });
	},
	/**
	 * Перезарядка. Без id — щелчок интерфейса (выдали патроны, взяли бойца). С id — записи по устройству оружия,
	 * растянутые на время перезарядки dur: магазин и затвор, патроны в обрез и в трубку помпы (n — сколько), лента.
	 */
	reload(id, { dur = 2, n = 2, ...at } = {}) {
		const kind = id && (RELOADS[id] ?? 'rifle'), w = where(at);
		const p = (name, delay, rate = 1, gain = 0.8) => play(name, { delay, rate: rate * vary(0.03), gain: gain * w.att, pan: w.pan, lowpass: w.lowpass });
		let ok = false;
		if (kind === 'pistol') ok = p('reload_pistol', Math.max(0, dur - 1.05));
		else if (kind === 'obrez') ok = p('dry', 0.25, 0.6) && p('shell', dur * 0.35) && p('shell', dur * 0.55, 1.05) && p('dry', dur - 0.25, 0.5, 1);
		else if (kind === 'pump') {
			const k = Math.max(1, Math.min(6, n));
			ok = p('shell', 0.3);
			for (let i = 1; i < k; i++) p('shell', 0.3 + (i * (dur - 1.1)) / k, vary(0.05));
			p('bolt', dur - 0.6, 1.25);
		} else if (kind === 'belt') ok = p('bolt', 0.4, 0.8) && p('reload_rifle', dur * 0.35, 0.9) && p('shell', dur * 0.6, 0.8) && p('bolt', dur - 0.8, 0.9, 0.9);
		else if (kind === 'rifle') ok = p('reload_rifle', Math.min(0.3, dur * 0.12)) && p('bolt', dur - 0.65, 1.15);
		if (!ok && w.att > 0.3) { tone({ freq: 900, dur: 0.05, type: 'square', gain: 0.08 }); setTimeout(() => tone({ freq: 650, dur: 0.06, type: 'square', gain: 0.08 }), 600); }
	},
	/** Сердце: два глухих удара. */
	heartbeat() { tone({ freq: 62, to: 40, dur: 0.14, type: 'sine', gain: 0.32 }); setTimeout(() => tone({ freq: 56, to: 38, dur: 0.16, type: 'sine', gain: 0.24 }), 190); },
	pickup() { tone({ freq: 660, to: 1320, dur: 0.18, type: 'sine', gain: 0.15 }); },
	search() { burst({ dur: 0.5, freq: 1400, sweep: 700, type: 'bandpass', q: 1.5, gain: 0.16, attack: 0.08 }); setTimeout(() => burst({ dur: 0.35, freq: 900, type: 'bandpass', q: 2, gain: 0.12, attack: 0.05 }), 450); },
	dry() { if (!play('dry', { gain: 0.7, rate: vary() })) { tone({ freq: 1900, dur: 0.025, type: 'square', gain: 0.07 }); burst({ dur: 0.04, freq: 3000, gain: 0.12 }); } },
	drink() { [0, 0.16, 0.32].forEach((d) => setTimeout(() => tone({ freq: 260, to: 420, dur: 0.12, type: 'sine', gain: 0.14 }), d * 1000)); },
};
