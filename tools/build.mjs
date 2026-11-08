// Собирает игру в один HTML-файл: dist/index.html (обычная страница)
// и dist/artifact.html (фрагмент без <html>/<head>/<body> для публикации артефактом).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Старые WebView (Android 7–10 без обновлений) не понимают ?. и ??: переводим код в синтаксис Chrome 58.
let esbuild = null;
try { esbuild = createRequire(import.meta.url)('esbuild'); } catch (e) { console.warn('esbuild не найден (npm install): код не будет переведён для старых WebView'); }
const lower = (code, file) => esbuild ? esbuild.transformSync(code, { target: 'chrome58', loader: 'js', charset: 'utf8', sourcefile: file }).code : code;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'src/style.css'), 'utf8');

html = html.replace('<link rel="stylesheet" href="src/style.css">', () => `<style>\n${css}</style>`);
html = html.replace(/<script src="(src\/[^"]+)"><\/script>\n?/g, (_, p) => `<script>\n${lower(readFileSync(join(root, p), 'utf8'), p)}</script>\n`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), html);

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\n?/, '')
  .replace(/<meta name="viewport"[^>]*>\n?/, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync(join(root, 'dist/artifact.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('dist/index.html', (html.length / 1024).toFixed(1) + ' KB');
