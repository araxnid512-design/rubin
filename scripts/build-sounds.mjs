// Настоящие звуки оружия для игры: записи из набора CC-Sounds (github.com/Fris0uman/cdda-soundpacks,
// у каждого файла — свой автор и свободная лицензия, см. assets/sounds/CREDITS.md) обрезаются, выравниваются
// по громкости и сохраняются в MP3 (моно, 44,1 кГц) — его понимают все браузеры, включая Safari.
//
//   git clone --depth 1 https://github.com/Fris0uman/cdda-soundpacks
//   node scripts/build-sounds.mjs cdda-soundpacks/sound/CC-Sounds
//
// Нужен ffmpeg с libmp3lame.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-sounds.mjs <path to CC-Sounds>'); process.exit(1); }
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
mkdirSync(out, { recursive: true });

// имя → [исходник, с какой секунды, длина, затухание в конце, пик дБ]; ss = null — с первого громкого звука
// (тишина и шорохи до выстрела срезаются, чтобы звук совпадал со вспышкой)
const SOUNDS = {
	pistol: ['fire_gun/handguns/handgun_1.ogg', null, 0.6, 0.4, -1],
	shotgun: ['fire_gun/shotguns/shotgun_1.ogg', null, 1.2, 0.8, -1],
	ak1: ['fire_gun/rifles/automatic_rifle/outdoor_gunfire/556_auto_rifle_shot_01.ogg', null, 0.6, 0.35, -1],
	ak2: ['fire_gun/rifles/automatic_rifle/outdoor_gunfire/556_auto_rifle_shot_02.ogg', null, 0.6, 0.35, -1],
	ak3: ['fire_gun/rifles/automatic_rifle/outdoor_gunfire/556_auto_rifle_shot_03.ogg', null, 0.6, 0.35, -1],
	mg: ['fire_gun/machineguns/machinegun_1.ogg', null, 0.8, 0.5, -1],
	svd: ['fire_gun/generic/genericgun_1.ogg', null, 1.0, 0.6, -1],
	casing1: ['fire_gun/brass_eject.ogg', 0.04, 0.26, 0.12, -4],
	casing2: ['fire_gun/brass_eject.ogg', 0.56, 0.3, 0.12, -4],
	dry: ['fire_gun/empty_1.ogg', null, 0.15, 0.05, -4],
	reload_pistol: ['reload/pocket_pistol/pocket_pistol_load_01.ogg', 0.1, 0.93, 0.08, -3],
	reload_rifle: ['reload/default.ogg', 0, 0.95, 0.15, -3],
	bolt: ['reload/mag_fed_bolt_action_rifle/bolt_action_rifle_load_01.ogg', 2.17, 0.7, 0.12, -3],
	shell: ['reload/tube_fed_shotgun/shell_load_01.ogg', null, 0.55, 0.1, -4],
	explosion: ['explosion/huge/explosion_huge_1.ogg', null, 3.2, 2.2, -1],
};

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
for (const [name, [file, ss, len, fade, peak]] of Object.entries(SOUNDS)) {
	const cut = [
		ss == null ? 'silenceremove=start_periods=1:start_threshold=-24dB:start_silence=0.004' : `atrim=start=${ss}`,
		'asetpts=PTS-STARTPTS',
		`atrim=end=${len}`,
		`afade=t=in:d=0.004`,
		`afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade}`,
	].join(',');
	// пик после обрезки → усиление до нужного уровня
	const probe = spawnSync('ffmpeg', ['-v', 'info', '-i', join(src, file), '-af', `${cut},volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
	const max = +/max_volume: (-?[\d.]+) dB/.exec(probe)[1];
	const gain = peak - max, dst = join(out, `${name}.mp3`);
	ff(['-i', join(src, file), '-af', `${cut},volume=${gain.toFixed(2)}dB`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '4', dst]);
	console.log(`${name}.mp3 ← ${file} (${(statSync(dst).size / 1024).toFixed(1)} KB, ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB)`);
}
