// Отчёт по суставам героя: худшие значения в каждой анимации и выходы за анатомические пределы.
//   node scripts/anatomy-report.mjs
import { buildCharacter } from './makehuman/build-zombie.mjs';
import { HERO_PROFILE } from './makehuman/profiles.mjs';
import { analyzeClip, ANATOMY_LIMITS } from '../src/anatomy.js';

const { model, animations } = buildCharacter(HERO_PROFILE, { textureSize: 32 });
const cols = ['shoulderTwist', 'forearmTwist', 'wrist', 'elbowMin', 'elbow', 'hipTwist', 'kneeMin', 'ankleTwist', 'jump'];
const head = { shoulderTwist: 'плечо', forearmTwist: 'предпл', wrist: 'запяст', elbowMin: 'локоть<', elbow: 'локоть>', hipTwist: 'бедро', kneeMin: 'колено<', ankleTwist: 'лодыж', jump: 'скачок' };
console.log('пределы:', JSON.stringify(ANATOMY_LIMITS));
console.log('клип'.padEnd(12) + cols.map((c) => head[c].padStart(9)).join(''));
let bad = 0;
const notes = [];
for (const clip of animations) {
	const r = analyzeClip(model, clip);
	console.log(clip.name.padEnd(12) + cols.map((c) => `${r.max[c].toFixed(0)}°`.padStart(9)).join('') + (r.violations.length ? '  ✗' : '  ✓'));
	for (const v of r.violations) notes.push(`  ${clip.name}: ${v}`);
	bad += r.violations.length;
}
if (notes.length) console.log(notes.join('\n'));
console.log(bad ? `выходов за пределы: ${bad}` : 'все суставы в анатомических пределах');
process.exitCode = bad ? 1 : 0;
