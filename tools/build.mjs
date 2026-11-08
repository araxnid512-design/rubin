// Собирает игру в один HTML-файл.
//   dist/prishly.html  — самостоятельная страница: скачать и открыть двойным щелчком, интернет не нужен (кроме шрифтов).
//   dist/artifact.html — фрагмент без <html>/<head>/<body> для публикации как Artifact на claude.ai.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'game');
const dist = join(here, '..', 'dist');
const html = readFileSync(join(src, 'index.html'), 'utf8');

const between = (s, a, b) => {
  const i = s.indexOf(a), j = s.indexOf(b);
  if (i < 0 || j < 0) throw new Error(`Не найдены метки ${a} / ${b}`);
  return s.slice(i + a.length, j);
};
const inline = (s) => s
  .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) => `<style>\n${readFileSync(join(src, p), 'utf8')}\n</style>`)
  .replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, p) => {
    const code = readFileSync(join(src, p), 'utf8');
    if (code.includes('</script')) throw new Error(`${p} содержит </script>`);
    return `<script>\n${code}\n</script>`;
  });

const head = inline(between(html, '<!-- artifact:start -->', '<!-- artifact:head-end -->'));
const body = inline(between(html, '<!-- artifact:body -->', '<!-- artifact:end -->'));

mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'artifact.html'), head.trim() + '\n' + body.trim() + '\n');
writeFileSync(join(dist, 'prishly.html'), `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head.trim()}\n</head>\n<body>\n${body.trim()}\n</body>\n</html>\n`);
console.log('Готово: dist/prishly.html, dist/artifact.html');
