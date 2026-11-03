// Свой голос у каждого ствола: из настоящих записей набора CC-Sounds (github.com/Fris0uman/cdda-soundpacks,
// авторы и лицензии — assets/sounds/CREDITS.md) собираются выстрелы gun_<ствол>.mp3: высота (калибр и длина ствола),
// бас (у 7,62 и .50 — «удар» в грудь), срез верхов/низов (компактные и пистолеты-пулемёты — суше и выше), отражение
// и хвост эха (у винтовок — раскат по округе). Записей в наборе мало (пистолет, дробовик, винтовка, пулемёт,
// автомат 5,56 на улице и в помещении), поэтому голоса — их переработка; изменённые файлы — на тех же условиях.
//
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/Fris0uman/cdda-soundpacks pack
//   (cd pack && git sparse-checkout set sound/CC-Sounds/fire_gun)
//   node scripts/build-gun-voices.mjs pack/sound/CC-Sounds
//
// Нужен ffmpeg с libmp3lame.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-gun-voices.mjs <path to CC-Sounds>'); process.exit(1); }
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
mkdirSync(out, { recursive: true });

const H = 'fire_gun/handguns/handgun_1.ogg';
const S = 'fire_gun/shotguns/shotgun_1.ogg';
const R = 'fire_gun/rifles/rifle_1.ogg';
const MG = 'fire_gun/machineguns/machinegun_1.ogg';
const G = 'fire_gun/generic/genericgun_1.ogg';
const A = (n, where = 'outdoor') => `fire_gun/rifles/automatic_rifle/${where}_gunfire/556_auto_rifle_shot_0${n}.ogg`;

// ствол → { s: исходник, r: высота (скорость), bass: дБ на 100 Гц, hp/lp: срез, Гц, echo: [задержки мс, доли], len: с }
const VOICES = {
	glock17: { s: H, r: 1.08, bass: 0, hp: 150, echo: [[45, 130], [0.22, 0.1]], len: 0.6 },
	deagle: { s: H, r: 0.78, bass: 7, hp: 60, echo: [[60, 200], [0.35, 0.18]], len: 1.0 },
	mp5: { s: H, r: 1.22, bass: 0, hp: 200, lp: 7000, echo: [[35, 100], [0.18, 0.08]], len: 0.45 },
	aks: { s: A(1), r: 1.1, bass: 0, hp: 120, echo: [[40, 140], [0.25, 0.1]], len: 0.5 },
	ak74: { s: A(2), r: 1.0, bass: 3, hp: 80, echo: [[50, 170], [0.3, 0.14]], len: 0.6 },
	ak47: { s: A(3), r: 0.86, bass: 7, hp: 60, echo: [[55, 190], [0.32, 0.16]], len: 0.7 },
	ak107: { s: A(1, 'indoor'), r: 1.0, bass: 2, hp: 90, echo: [[45, 150], [0.26, 0.12]], len: 0.55 },
	g36: { s: A(2, 'indoor'), r: 1.08, bass: 0, hp: 180, echo: [[40, 140], [0.24, 0.1]], len: 0.5 },
	aug: { s: A(3, 'indoor'), r: 0.96, bass: 2, hp: 100, echo: [[45, 150], [0.26, 0.12]], len: 0.55 },
	fnfal: { s: R, r: 0.9, bass: 6, hp: 60, echo: [[70, 240], [0.38, 0.2]], len: 0.85 },
	rpk: { s: MG, r: 1.05, bass: 2, hp: 80, echo: [[50, 180], [0.3, 0.14]], len: 0.7 },
	pkt: { s: MG, r: 0.85, bass: 6, hp: 60, echo: [[60, 210], [0.34, 0.18]], len: 0.8 },
	svd: { s: G, r: 0.95, bass: 4, hp: 60, echo: [[80, 280], [0.4, 0.22]], len: 1.0 },
	awm: { s: R, r: 0.72, bass: 9, hp: 40, echo: [[90, 320, 640], [0.45, 0.26, 0.12]], len: 1.4 },
	spas12: { s: S, r: 1.0, bass: 3, hp: 60, echo: [[60, 220], [0.32, 0.16]], len: 1.0 },
	dbarrel: { s: S, r: 0.88, bass: 6, hp: 50, echo: [[65, 230], [0.36, 0.18]], len: 1.1 },
};

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const peakOf = (file, af) => +/max_volume: (-?[\d.]+) dB/.exec(spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-af', `${af}volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr)[1];

for (const [id, v] of Object.entries(VOICES)) {
	const input = join(src, v.s), dst = join(out, `gun_${id}.mp3`);
	const [ds, as] = v.echo;
	const chain = [
		'silenceremove=start_periods=1:start_threshold=-40dB',   // выстрел — с первого громкого звука (совпадает со вспышкой)
		`asetrate=44100*${v.r}`, 'aresample=44100',
		v.hp ? `highpass=f=${v.hp}` : null,
		v.lp ? `lowpass=f=${v.lp}` : null,
		v.bass ? `bass=g=${v.bass}:f=100:w=0.7` : null,
		`aecho=0.85:0.7:${ds.join('|')}:${as.join('|')}`,
		`atrim=duration=${v.len}`,
		`afade=t=out:st=${(v.len * 0.55).toFixed(3)}:d=${(v.len * 0.45).toFixed(3)}`,
	].filter(Boolean).join(',');
	const gain = -2 - peakOf(input, chain + ",");
	ff(['-i', input, '-af', `${chain},volume=${gain.toFixed(2)}dB`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '4', dst]);
	console.log(`gun_${id}.mp3 ← ${v.s} (высота ${v.r}, бас ${v.bass} дБ)`);
}
