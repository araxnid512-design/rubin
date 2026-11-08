// Собирает игры в одиночные HTML-файлы.
//   dist/prishly.html, dist/klyk.html — самостоятельные страницы: скачать и открыть, интернет нужен только для шрифтов.
//   dist/*-artifact.html — фрагменты без <html>/<head>/<body> для публикации как Artifact на claude.ai.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const GAMES = [
  { src: 'game', out: 'prishly', artifact: 'artifact' },
  { src: 'orc', out: 'klyk', artifact: 'klyk-artifact' },
];

const between = (s, a, b) => {
  const i = s.indexOf(a), j = s.indexOf(b);
  if (i < 0 || j < 0) throw new Error(`Не найдены метки ${a} / ${b}`);
  return s.slice(i + a.length, j);
};

function build({ src, out, artifact }) {
  const dir = join(root, src);
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const local = (p) => !/^https?:/.test(p);
  const inline = (s) => s
    .replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, p) => (local(p) ? `<style>\n${readFileSync(resolve(dir, p), 'utf8')}\n</style>` : m))
    .replace(/<script src="([^"]+)"><\/script>/g, (m, p) => {
      if (!local(p)) return m;
      const code = readFileSync(resolve(dir, p), 'utf8');
      if (code.includes('</script')) throw new Error(`${p} содержит </script>`);
      return `<script>\n${code}\n</script>`;
    });
  const head = inline(between(html, '<!-- artifact:start -->', '<!-- artifact:head-end -->'));
  const body = inline(between(html, '<!-- artifact:body -->', '<!-- artifact:end -->'));
  writeFileSync(join(dist, `${artifact}.html`), head.trim() + '\n' + body.trim() + '\n');
  writeFileSync(join(dist, `${out}.html`), `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head.trim()}\n</head>\n<body>\n${body.trim()}\n</body>\n</html>\n`);
  console.log(`Готово: dist/${out}.html, dist/${artifact}.html`);
}

mkdirSync(dist, { recursive: true });
for (const g of GAMES) build(g);
