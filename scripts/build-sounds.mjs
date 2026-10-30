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

// имя → [исходник, с какой секунды, длина, затухание в конце, пик дБ, опции]; ss = null — с первого громкого звука
// (тишина и шорохи до выстрела срезаются, чтобы звук совпадал со вспышкой). Опции: loop — секунд на склейку
// конца с началом (фон играет по кругу без шва), q — качество MP3 (0 — лучшее, 9 — меньше файл).
const SOUNDS = {
	// оружие
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
	// заражённые: стон, удар по герою, смерть, разрыв; попадания в тело
	groan1: ['speech/zombie/speech_zombie_groan.ogg', null, 0.7, 0.2, -2],
	groan2: ['speech/zombie/speech_zombie_groan_1.ogg', null, 0.78, 0.2, -2],
	groan3: ['speech/zombie/speech_zombie_groan_2.ogg', null, 0.8, 0.2, -2],
	groan4: ['speech/zombie/speech_zombie_groan_4.ogg', 0.0, 0.3, 0.1, -2],
	groan5: ['speech/zombie/speech_zombie_groan_4.ogg', 0.38, 0.26, 0.1, -2],
	zhit1: ['melee_attack/monster_melee_hit/monster_melee_hit_1.ogg', null, 0.36, 0.12, -2],
	zhit2: ['melee_attack/monster_melee_hit/monster_melee_hit_3.ogg', null, 0.5, 0.15, -2],
	zdeath1: ['mon_death/zombie_death/zombie_death_3.ogg', null, 0.48, 0.12, -2],
	zdeath2: ['mon_death/zombie_death/zombie_death_4.ogg', null, 0.68, 0.2, -2],
	zdeath3: ['mon_death/zombie_death/zombie_death_1.ogg', null, 0.78, 0.25, -2],
	gib: ['mon_death/zombie_gibbed/zombie_gibbed_1.ogg', null, 1.0, 0.5, -2],
	flesh1: ['melee_hit_flesh/default/unarmed_hit_flesh_1.ogg', null, 0.32, 0.12, -3],
	flesh2: ['melee_hit_flesh/default/unarmed_hit_flesh_3.ogg', null, 0.32, 0.12, -3],
	chop: ['melee_hit_flesh/big_cutting/big_cutting_flesh_1.ogg', null, 0.42, 0.15, -2],
	// шаги героя: асфальт, трава, грунт, пол в доме
	step_road1: ['plmove/walk_t_concrete_1.ogg', null, 0.22, 0.08, -4],
	step_road2: ['plmove/walk_t_concrete_2.ogg', null, 0.22, 0.08, -4],
	step_road3: ['plmove/walk_t_concrete_3.ogg', null, 0.22, 0.08, -4],
	step_grass1: ['plmove/walk_grass/walk_grass_3.ogg', null, 0.3, 0.1, -4],
	step_grass2: ['plmove/walk_grass/walk_grass_4.ogg', null, 0.3, 0.1, -4],
	step_dirt1: ['plmove/walk_t_gravel_1.ogg', null, 0.3, 0.1, -4],
	step_dirt2: ['plmove/walk_t_gravel_2.ogg', null, 0.3, 0.1, -4],
	step_floor1: ['plmove/walk_t_floor/walk_t_floor_1.ogg', null, 0.28, 0.1, -4],
	step_floor2: ['plmove/walk_t_floor/walk_t_floor_2.ogg', null, 0.28, 0.1, -4],
	// фон: ветер над пустым кластером (по кругу) и дальний гром перед перезагрузкой
	wind: ['environment/weather/weather_cloudy/weather_cloudy_autumn.ogg', 1, 20, 0, -6, { loop: 2, q: 7 }],
	thunder: ['environment/weather/thunder_far.ogg', null, 7, 3, -2, { q: 6 }],
};

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const peakOf = (file, af) => +/max_volume: (-?[\d.]+) dB/.exec(spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-af', `${af}volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr)[1];
for (const [name, [file, ss, len, fade, peak, opt = {}]] of Object.entries(SOUNDS)) {
	const input = join(src, file), dst = join(out, `${name}.mp3`);
	const region = ss == null ? '' : `atrim=start=${ss}:duration=${len},`;
	// пик куска → усиление до нужного уровня; тихие записи (шаги) сначала усиливаем, потом режем тишину
	const gain = peak - peakOf(input, region);
	let filter;
	if (opt.loop) {
		// склейка: хвост куска плавно переходит в его начало, конец файла продолжается его же началом
		const X = opt.loop;
		filter = `[1:a]atrim=start=${ss}:duration=${X},asetpts=PTS-STARTPTS[head];[0:a]atrim=start=${ss + X}:duration=${len - X},asetpts=PTS-STARTPTS[body];`
			+ `[body][head]acrossfade=d=${X}:c1=tri:c2=tri,volume=${gain.toFixed(2)}dB`;
	} else {
		filter = [
			ss == null ? `volume=${gain.toFixed(2)}dB,silenceremove=start_periods=1:start_threshold=-24dB:start_silence=0.004` : `atrim=start=${ss},volume=${gain.toFixed(2)}dB`,
			'asetpts=PTS-STARTPTS',
			`atrim=end=${len}`,
			'afade=t=in:d=0.004',
			`afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade}`,
		].join(',');
	}
	ff(['-i', input, ...(opt.loop ? ['-i', input, '-filter_complex'] : ['-af']), filter, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', String(opt.q ?? 4), dst]);
	console.log(`${name}.mp3 ← ${file} (${(statSync(dst).size / 1024).toFixed(1)} KB, ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB)`);
}
